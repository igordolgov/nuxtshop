// server/lib/orderHelpers.ts
// Хранилище заказов в Workers KV (ключ data:orders — массив всех заказов).
// Паттерн тот же, что productHelpers/userHelpers: доступ через event.
// ⚠️ Масштабирование: единый массив рассчитан на ~5–10 тыс. заказов
// (лимит значения KV — 25 МБ). При росте — миграция на ключ-на-заказ.
// ⚠️ Гонки: read-modify-write без транзакций; вероятность столкновения
// ничтожна на малых объёмах, при росте решается тем же переездом.

import type { H3Event } from 'h3';
import { createError } from 'h3';
import { kvGetJSON, kvPutJSON } from './storage';
import { readProducts, writeProducts, type Product } from './productHelpers';
import {
  readPromoCodes,
  writePromoCodes,
  findPromoByCode,
  promoIssue,
  calcDiscount,
  type PromoCode,
} from './promoHelpers';
// Конфиг витрины: способы оплаты и цифры доставки — один источник на клиент
// (app/utils/deliveryPrice.ts) и сервер (см. store.config.ts)
import {
  DELIVERY_PRICE_COURIER,
  DELIVERY_PRICE_POST,
  FREE_DELIVERY_FROM,
  STORE_PAYMENT_METHODS,
} from '../../store.config';

const ORDERS_KEY = 'data:orders';

// ─── Статусы ─────────────────────────────────────────────────────────

export type OrderStatus = 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

// ⚙️ НАСТРОЙКА: допустимые статусы и человекочитаемые названия —
// используются валидацией эндпоинтов, админкой и Telegram-ботом (этап 1)
export const ORDER_STATUSES: OrderStatus[] = [
  'new',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  shipped: 'Передан в доставку',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};

// ─── Отмена заказа покупателем (ЛК) ─────────────────────────────────

/**
 * Статусы, в которых покупатель может отменить заказ сам: до передачи
 * в доставку. shipped/delivered — только через админку/поддержку.
 * Зеркалится в app/pages/user/orders.vue (список CANCELLABLE).
 */
export const CUSTOMER_CANCELLABLE_STATUSES: OrderStatus[] = ['new', 'confirmed'];

/**
 * Может ли пользователь отменить этот заказ: только свой и только
 * в статусе до отправки. Чистая функция — покрыта тестами.
 */
export function canCustomerCancel(order: Order, userId: string): boolean {
  if (!order || order.customer?.userId !== userId) return false;
  return CUSTOMER_CANCELLABLE_STATUSES.includes(order.status);
}

// ─── Правила ценообразования.
// СЕРВЕР — единственный источник правды: клиентские суммы игнорируются,
// цены/названия/наличие берутся из KV товаров.
// Промокоды живут в KV data:promocodes (админка /admin/promocodes);
// скидка валидируется и считается сервером, клиентский subtotal — только превью.
// ⚙️ НАСТРОЙКА: цифры доставки — в store.config.ts (FREE_DELIVERY_FROM /
// DELIVERY_PRICE_*; символ валюты в цифры НЕ входит — выводит formatMoney).
// Курьер — бесплатно от порога, почта — всегда платно, самовывоз — всегда 0
// (согласовано с формой checkout через app/utils/deliveryPrice.ts)

// ─── Типы ────────────────────────────────────────────────────────────

export type DeliveryMethod = 'courier' | 'pickup' | 'post';
// Способы оплаты: список активных задаётся в store.config.ts (STORE_PAYMENT_METHODS)
export type PaymentMethod = 'card' | 'cash' | 'transfer';

export interface OrderItem {
  id: string;
  slug: string | null;
  name: string;
  /** Снапшоты переводов названия на момент заказа (i18n): нет поля —
   *  витрина фолбэчит на русский name (контракт как у товаров). */
  nameEn?: string;
  nameEs?: string;
  price: number; // цена за штуку на момент заказа (из KV; у варианта — его цена)
  quantity: number;
  image: string | null;
  category: string | null;
  // Вариант товара (цвет/память). null — товар без вариантов.
  // id позиции в корзине — «productId::variantId»: серверу достаточно
  // клиентского id, отдельного поля вариант-товара в каталоге нет.
  variantId: string | null;
  variantName: string | null;
  /** Снапшоты переводов метки варианта (тоже могут отсутствовать). */
  variantNameEn?: string | null;
  variantNameEs?: string | null;
}

export interface OrderCustomer {
  userId: string | null; // null — гостевой заказ
  name: string;
  email: string;
  phone: string;
  address?: string; // обязателен для courier и post
  city?: string; // обязателен для courier и post
  postalCode?: string; // обязателен для post (6 цифр)
}

export interface OrderNotify {
  email: string; // канал гарантированных уведомлений клиенту
  pushSubscribed: boolean;
  telegramChat: string | null; // заполнится при привязке бота (этап 4)
}

export interface Order {
  id: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  promoCode: string | null;
  deliveryMethod: DeliveryMethod;
  deliveryPrice: number;
  paymentMethod: PaymentMethod;
  total: number;
  customer: OrderCustomer;
  notify: OrderNotify;
  comment: string;
  statusHistory: Array<{ status: OrderStatus; at: string; comment?: string }>;
  /** true — заказанное количество уже списано со склада (при подтверждении);
   *  undefined у заказов, созданных до введения списания, трактуется как false */
  stockApplied?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderInput {
  // Клиент присылает ТОЛЬКО id и количество — всё остальное сервер добирает из KV
  items: Array<{ id: string | number; quantity: number }>;
  deliveryMethod: string;
  paymentMethod: string;
  promoCode?: string | null;
  customer: {
    name: string;
    email: string;
    phone: string;
    address?: string;
    city?: string;
    postalCode?: string;
    userId?: string | null; // проставляется сервером из сессии
  };
  notify?: { email?: string; pushSubscribed?: boolean };
  comment?: string;
}

// ─── Базовые операции ────────────────────────────────────────────────

export async function readOrders(event: H3Event): Promise<Order[]> {
  return (await kvGetJSON<Order[]>(event, ORDERS_KEY)) ?? [];
}

export async function writeOrders(event: H3Event, orders: Order[]) {
  if (!Array.isArray(orders)) throw new Error('Orders must be an array');
  await kvPutJSON(event, ORDERS_KEY, orders);
}

export async function getOrderById(event: H3Event, id: string): Promise<Order | null> {
  const orders = await readOrders(event);
  return orders.find((o) => o.id === id) ?? null;
}

/** Человекочитаемый уникальный номер: ORD-<base36 времени><4 случайных> */
function generateOrderId(): string {
  const time = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 6);
  return `ORD-${time}${rnd}`;
}

/** Валидация контактов покупателя; возвращает нормализованные значения */
function validateCustomer(customer: CreateOrderInput['customer'], deliveryMethod: DeliveryMethod) {
  const name = customer?.name?.trim() ?? '';
  if (name.length < 2 || name.length > 100) {
    throw createError({
      statusCode: 400,
      message: 'Укажите имя (2–100 символов)',
      data: { code: 'missingName' },
    });
  }

  const email = customer?.email?.trim().toLowerCase() ?? '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({
      statusCode: 400,
      message: 'Укажите корректный email',
      data: { code: 'badEmail' },
    });
  }

  const phone = customer?.phone?.trim() ?? '';
  if (phone.replace(/\D/g, '').length < 10) {
    throw createError({
      statusCode: 400,
      message: 'Укажите корректный телефон (минимум 10 цифр)',
      data: { code: 'badPhone' },
    });
  }

  const needsAddress = deliveryMethod === 'courier' || deliveryMethod === 'post';

  const address = customer?.address?.trim() ?? '';
  if (needsAddress && address.length < 5) {
    throw createError({
      statusCode: 400,
      message: 'Укажите адрес доставки',
      data: { code: 'missingAddress' },
    });
  }

  const city = customer?.city?.trim() ?? '';
  if (needsAddress && city.length < 2) {
    throw createError({
      statusCode: 400,
      message: 'Укажите город',
      data: { code: 'missingCity' },
    });
  }

  // Почта России: индекс обязателен, ровно 6 цифр
  const postalCode = customer?.postalCode?.trim() ?? '';
  if (deliveryMethod === 'post' && !/^\d{6}$/.test(postalCode)) {
    throw createError({
      statusCode: 400,
      message: 'Почтовый индекс: 6 цифр',
      data: { code: 'badZip' },
    });
  }

  return { name, email, phone, address, city, postalCode };
}

// ─── Создание заказа ─────────────────────────────────────────────────

export async function createOrder(event: H3Event, input: CreateOrderInput): Promise<Order> {
  // 1. Позиции: схлопываем дубликаты id, отбрасываем мусор
  const qtyById = new Map<string, number>();
  for (const item of input?.items ?? []) {
    const id = String(item?.id ?? '');
    const qty = Number(item?.quantity);
    if (!id || !Number.isInteger(qty) || qty < 1) continue;
    qtyById.set(id, (qtyById.get(id) ?? 0) + qty);
  }
  if (qtyById.size === 0) {
    throw createError({
      statusCode: 400,
      message: 'Корзина пуста',
      data: { code: 'emptyCart' },
    });
  }

  // 2. Способы доставки/оплаты — только допустимые значения
  const deliveryMethod: DeliveryMethod | null = (['courier', 'pickup', 'post'] as const).includes(
    input.deliveryMethod as DeliveryMethod,
  )
    ? (input.deliveryMethod as DeliveryMethod)
    : null;
  if (!deliveryMethod) {
    throw createError({
      statusCode: 400,
      message: 'Выберите способ доставки',
      data: { code: 'missingDelivery' },
    });
  }
  // Способы оплаты — только включённые в store.config (STORE_PAYMENT_METHODS)
  const paymentMethod: PaymentMethod | null = (STORE_PAYMENT_METHODS as readonly string[]).includes(
    input.paymentMethod as string,
  )
    ? (input.paymentMethod as PaymentMethod)
    : null;
  if (!paymentMethod) {
    throw createError({
      statusCode: 400,
      message: 'Выберите способ оплаты',
      data: { code: 'missingPayment' },
    });
  }

  // 3. Товары из KV: цены и наличие — серверные.
  // Корзинная позиция варианта приходит составным id «productId::variantId»
  // (см. useCart.addToCart): склад и цена берутся из варианта, а не товара.
  const products = await readProducts(event);
  const items: OrderItem[] = [];
  for (const [lineId, quantity] of qtyById) {
    const sep = String(lineId).indexOf('::');
    const productId = sep === -1 ? String(lineId) : String(lineId).slice(0, sep);
    const variantId = sep === -1 ? null : String(lineId).slice(sep + 2) || null;
    const product = products.find((p) => String(p.id) === productId);
    if (!product) {
      throw createError({
        statusCode: 400,
        message: `Товар с ID ${productId} не найден`,
        data: { code: 'productNotFound' },
      });
    }
    let price = product.price;
    let stock = product.stockQuantity ?? 0;
    let variantName: string | null = null;
    let variantNameEn: string | null = null;
    let variantNameEs: string | null = null;
    let variantImage: string | null = null;
    if (variantId !== null) {
      const variant = product.variants?.find((v) => v.id === variantId);
      if (!variant) {
        throw createError({
          statusCode: 400,
          message: `У товара «${product.name}» нет варианта ${variantId}`,
          data: { code: 'variantMissing', params: { name: product.name, variant: variantId } },
        });
      }
      price = variant.price ?? product.price;
      stock = variant.stockQuantity ?? product.stockQuantity ?? 0;
      variantName = variant.name;
      variantNameEn = variant.nameEn ?? null;
      variantNameEs = variant.nameEs ?? null;
      variantImage = variant.image ?? null;
    }
    if (quantity > stock) {
      throw createError({
        statusCode: 409,
        message: `«${product.name}${variantName ? ` (${variantName})` : ''}»: доступно ${stock} шт., запрошено ${quantity}`,
        data: {
          code: 'stockShortage',
          params: { name: product.name, available: stock, requested: quantity },
        },
      });
    }
    items.push({
      id: product.id,
      slug: product.slug ?? null,
      name: product.name,
      nameEn: product.nameEn,
      nameEs: product.nameEs,
      price,
      quantity,
      image: variantImage ?? product.image ?? null,
      category: product.categories?.[0] ?? null,
      variantId,
      variantName,
      variantNameEn,
      variantNameEs,
    });
  }

  // 4. Деньги — считает только сервер (клиентские суммы игнорируются).
  // Промокод: валидируется по KV (active/срок/лимит); невалидный или
  // неизвестный код НЕ блокирует заказ — просто скидка 0.
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const promoInput = input.promoCode?.trim().toUpperCase() || null;
  let appliedPromo: PromoCode | null = null;
  if (promoInput) {
    const promo = findPromoByCode(await readPromoCodes(event), promoInput);
    if (promo && !promoIssue(promo)) appliedPromo = promo;
  }
  const promoCode = appliedPromo?.code ?? null;
  const discount = appliedPromo ? calcDiscount(appliedPromo, subtotal) : 0;
  const deliveryPrice =
    deliveryMethod === 'pickup'
      ? 0
      : deliveryMethod === 'post'
        ? DELIVERY_PRICE_POST
        : subtotal > FREE_DELIVERY_FROM
          ? 0
          : DELIVERY_PRICE_COURIER;
  const total = subtotal - discount + deliveryPrice;

  // 5. Контакты (userId — из сессии, проставлен index.post.js) и уведомления
  const customer: OrderCustomer = {
    userId: input.customer?.userId ?? null,
    ...validateCustomer(input.customer, deliveryMethod),
  };
  const notify = {
    email: customer.email,
    pushSubscribed: Boolean(input.notify?.pushSubscribed),
    telegramChat: null,
  };

  // 6. Сборка и сохранение (новые сверху)
  const now = new Date().toISOString();
  const order: Order = {
    id: generateOrderId(),
    status: 'new',
    items,
    subtotal,
    discount,
    promoCode,
    deliveryMethod,
    deliveryPrice,
    paymentMethod,
    total,
    customer,
    notify,
    comment: (input.comment ?? '').trim().slice(0, 500),
    statusHistory: [{ status: 'new', at: now }],
    createdAt: now,
    updatedAt: now,
  };

  const orders = await readOrders(event);
  orders.unshift(order);
  await writeOrders(event, orders);

  // Счётчик применений пишем ПОСЛЕ заказа (как склад при подтверждении):
  // упавшая запись промокода не отменит уже созданный заказ — usedCount
  // отстанет на 1 (админ увидит и поправит), покупатель ничего не теряет.
  if (appliedPromo) {
    try {
      const promos = await readPromoCodes(event);
      const promo = promos.find((p) => p.id === appliedPromo.id);
      if (promo) {
        promo.usedCount = (promo.usedCount ?? 0) + 1;
        promo.updatedAt = new Date().toISOString();
        await writePromoCodes(event, promos);
      }
    } catch (error) {
      console.error('[promo] не удалось увеличить usedCount:', error);
    }
  }

  return order;
}

// ─── Склад: списание/возврат позиций заказа ──────────────────────────

/**
 * Списывает (mode 'deduct') или возвращает (mode 'restore') позиции заказа
 * на складе. Возвращает обновлённый каталог — или null, если писать нечего.
 * Недостаток товара при списании — 409 со списком нехваток: статус заказа
 * при этом НЕ меняется, админ сначала пополняет остаток или отменяет заказ.
 * Товары, удалённые из каталога, пропускаются (списывать нечего) —
 * подтверждение заказа на такой товар не блокируется.
 */
async function adjustStockForOrder(
  event: H3Event,
  order: Order,
  mode: 'deduct' | 'restore',
): Promise<Product[] | null> {
  const products = await readProducts(event);
  const byId = new Map(products.map((p) => [String(p.id), p]));

  if (mode === 'deduct') {
    // Сначала проверяем ВСЕ позиции и только потом списываем —
    // иначе ошибка на середине оставила бы склад списанным наполовину
    // Структурированные нехватки: клиент локализует по server.stockShortageItem
    const shortages: Array<{ name: string; available: number; requested: number }> = [];
    for (const item of order.items) {
      const product = byId.get(String(item.id));
      if (!product) continue;
      const stock = product.stockQuantity ?? 0;
      if (item.quantity > stock) {
        shortages.push({ name: product.name, available: stock, requested: item.quantity });
      }
    }
    if (shortages.length) {
      const ruList = shortages
        .map((s) => `«${s.name}»: на складе ${s.available} шт., в заказе ${s.requested}`)
        .join('; ');
      throw createError({
        statusCode: 409,
        message: `Недостаточно товара на складе: ${ruList}`,
        data: { code: 'stockShortage', params: { items: shortages } },
      });
    }
  }

  let changed = false;
  for (const item of order.items) {
    const product = byId.get(String(item.id));
    if (!product) continue;
    const stock = product.stockQuantity ?? 0;
    const next = mode === 'deduct' ? Math.max(0, stock - item.quantity) : stock + item.quantity;
    if (next !== stock) {
      product.stockQuantity = next;
      product.inStock = next > 0;
      product.updatedAt = new Date().toISOString();
      changed = true;
    }
  }
  return changed ? products : null;
}

// ─── Смена статуса ───────────────────────────────────────────────────

export async function updateOrderStatus(
  event: H3Event,
  id: string,
  status: OrderStatus,
  comment?: string,
): Promise<Order> {
  if (!ORDER_STATUSES.includes(status)) {
    throw createError({
      statusCode: 400,
      message: `Недопустимый статус. Допустимо: ${ORDER_STATUSES.join(', ')}`,
      data: { code: 'invalidStatus' },
    });
  }

  const orders = await readOrders(event);
  const order = orders.find((o) => o.id === id);
  if (!order) {
    throw createError({
      statusCode: 404,
      message: 'Заказ не найден',
      data: { code: 'orderNotFound' },
    });
  }

  // Идемпотентность: повторная установка того же статуса не дублирует
  // историю и не трогает склад (важно для повторных вызовов из вебхука)
  if (order.status === status) return order;

  // Склад: подтверждение списывает заказанное количество, отмена
  // подтверждённого — возвращает. Флаг stockApplied делает списание
  // одноразовым: повторные вызовы и ретраи вебхука не спишут дважды,
  // а повторное подтверждение после отмены спишет заново.
  const deduct = status === 'confirmed' && !order.stockApplied;
  const restore = status === 'cancelled' && Boolean(order.stockApplied);
  const updatedProducts = deduct
    ? await adjustStockForOrder(event, order, 'deduct')
    : restore
      ? await adjustStockForOrder(event, order, 'restore')
      : null;

  order.status = status;
  if (deduct) order.stockApplied = true;
  if (restore) order.stockApplied = false;
  order.statusHistory.push({
    status,
    at: new Date().toISOString(),
    comment: comment?.trim() || undefined,
  });
  order.updatedAt = new Date().toISOString();
  await writeOrders(event, orders);

  // Склад пишем ПОСЛЕ заказа: если упадёт запись каталога, статус уже
  // «confirmed» и stockApplied=true — повторный вызов не спишет дважды
  // (остаток корректируется вручную). Обратный порядок опаснее: упавшая
  // запись заказа оставила бы склад списанным при статусе «new», а ретрай
  // списал бы снова.
  if (updatedProducts) await writeProducts(event, updatedProducts);
  return order;
}
