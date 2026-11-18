// app/utils/cartSync.ts
// ============================================
// Чистая логика синхронизации корзины с аккаунтом (без Vue/KV/доменных
// импортов — файл подключается и клиентом, и СЕРВЕРОМ: любые runtime-импорты
// из app/composables затянули бы DOM-зависимый код в серверный tsconfig-граф;
// type-only тоже нельзя — tsc следует за типами). Поэтому канонические типы
// позиции/промокода определены ЗДЕСЬ, а useCart их алиасит.
//   mergeCarts         — объединение локальной и серверной корзины;
//   normalizeRemoteCart— санитизация ответа GET /api/my/cart;
//   cartSignature      — стабильный слепок корзины для дедупликации PUT;
//   planCartSync       — adopt/merge по маркеру последнего синка (см. ниже).
//
// Идемпотентность — критична: handleAuthLogin вызывается при КАЖДОЙ загрузке
// страницы с живой сессией (initializeApp), а merge ранее уже сливал эти же
// данные. Сумма количеств при повторном merge удваивала корзину
// (1 → 2 → 4 → 8…, баг релиза синка) — поэтому количество одинаковой позиции
// теперь БОЛЬШЕЕ из двух (max идемпотентен), а неизменённая с последнего
// синка локальная корзина вообще не сливается, а принимается с сервера
// (planCartSync, маркер в localStorage на клиенте).
// Композабл useCart — тонкий клиентский слой вокруг этих функций
// (тот же паттерн, что useRecentlyViewed / useFavorites).
// ============================================

import type { DeliveryMethodId } from './deliveryPrice';

/**
 * Позиция корзины — снапшот товара, замороженный при добавлении.
 * Каноническое определение (структурно совпадает с CartItem из useCart:
 * CartItem = SyncCartItem — см. там же).
 */
export interface SyncCartItem {
  id: string;
  name: string;
  variantId?: string | number | null;
  variantName?: string | null;
  description?: string;
  price: number;
  currentPrice?: number | null;
  originalPrice?: number | null;
  quantity: number;
  image?: string;
  category?: string | null;
  stockQuantity?: number | null;
  inStock?: boolean;
  discount?: number;
  slug?: string | null;
}

/** Применённый промокод: валидация на сервере, скидка пересчитывается локально */
export interface SyncPromo {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
}

/** Корзина в синхронизируемом виде (то, что хранится и на сервере, и в localStorage) */
export interface SyncableCart {
  items: SyncCartItem[];
  promo: SyncPromo | '';
  deliveryMethod: DeliveryMethodId;
}

/** Сколько позиций максимум в одной корзине (лимит и клиента, и сервера) */
export const SYNC_CART_MAX_ITEMS = 100;

/** Дефолтный лимит склада, когда у позиции он неизвестен (как в useCart.getMaxQuantity) */
const DEFAULT_STOCK = 999;

const DELIVERY_METHOD_IDS: DeliveryMethodId[] = ['courier', 'pickup', 'post'];

const asFiniteNumber = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

const asClampedInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = asFiniteNumber(value);
  if (n === null) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

const asCappedString = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.slice(0, max);
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Санитизация одной позиции с сервера/localStorage: белый список полей
 * (лишнее/мусор не попадает в стейт и в KV), числовые капы, quantity ≥ 1.
 */
const sanitizeItem = (raw: unknown): SyncCartItem | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;

  const id = asCappedString(item.id, 120);
  if (!id) return null;

  const price = asFiniteNumber(item.price) ?? 0;
  const currentPrice = asFiniteNumber(item.currentPrice);
  const originalPrice = asFiniteNumber(item.originalPrice);
  const stockQuantity = asFiniteNumber(item.stockQuantity);

  const sanitized: SyncCartItem = {
    id,
    name: asCappedString(item.name, 300) ?? '',
    price: Math.max(0, price),
    // quantity с капом по складу: сервер не доверяет присылаемым числам
    quantity: asClampedInt(
      item.quantity,
      1,
      stockQuantity !== null ? Math.max(1, stockQuantity) : DEFAULT_STOCK,
      1,
    ),
    variantId:
      typeof item.variantId === 'string' ||
      typeof item.variantId === 'number' ||
      item.variantId === null
        ? item.variantId
        : null,
    variantName: asCappedString(item.variantName, 200),
    description: asCappedString(item.description, 2000) ?? '',
    currentPrice: currentPrice !== null ? Math.max(0, currentPrice) : null,
    originalPrice: originalPrice !== null ? Math.max(0, originalPrice) : null,
    image: asCappedString(item.image, 5000) ?? '',
    category: asCappedString(item.category, 100),
    stockQuantity: stockQuantity !== null ? Math.round(stockQuantity) : null,
    inStock: item.inStock === undefined ? true : !!item.inStock,
    discount: Math.min(99, Math.max(0, asClampedInt(item.discount, 0, 99, 0))),
    slug: asCappedString(item.slug, 200),
  };
  return sanitized;
};

const sanitizePromo = (raw: unknown): SyncPromo | '' => {
  if (!raw || typeof raw !== 'object') return '';
  const promo = raw as Record<string, unknown>;
  const code = asCappedString(promo.code, 60);
  const type = promo.type === 'percent' || promo.type === 'fixed' ? promo.type : null;
  const value = asFiniteNumber(promo.value);
  if (!code || !type || value === null || value < 0) return '';
  return { code, type, value: Math.round(value) };
};

const sanitizeDeliveryMethod = (raw: unknown): DeliveryMethodId =>
  DELIVERY_METHOD_IDS.includes(raw as DeliveryMethodId) ? (raw as DeliveryMethodId) : 'courier';

/**
 * Санитизация серверной корзины перед merge. Битые записи отбрасываются
 * поштучно (валидные позиции сохраняются), полностью битый ответ → null
 * («на сервере ничего осмысленного нет»).
 */
export const normalizeRemoteCart = (raw: unknown): SyncableCart | null => {
  if (!raw || typeof raw !== 'object') return null;
  const cart = raw as Record<string, unknown>;
  if (!Array.isArray(cart.items)) return null;

  const items = cart.items
    .slice(0, SYNC_CART_MAX_ITEMS)
    .map(sanitizeItem)
    .filter((item): item is SyncCartItem => item !== null);

  return {
    items,
    promo: sanitizePromo(cart.promo),
    deliveryMethod: sanitizeDeliveryMethod(cart.deliveryMethod),
  };
};

/**
 * Объединение корзин при входе в аккаунт / загрузке страницы с сессией.
 *
 * Правила:
 *  - локальная пуста → берём серверную целиком (вход на новом устройстве);
 *  - иначе позиции объединяются по id: одна и та же → количество = БОЛЬШЕЕ
 *    из двух, с капом по складу. НЕ СУММА: merge выполняется при каждой
 *    загрузке страницы с сессией, и сумма удваивала корзину на каждой
 *    перезагрузке (merge(merge(L,R),R) ≠ merge(L,R)); max идемпотентен —
 *    повторный merge ничего не меняет;
 *  - снапшот позиции остаётся локальным (он заморожен в языке страницы);
 *    новые с сервера дописываются в конец;
 *  - промокод и способ доставки остаются локальные (сервер всё равно
 *    перепроверит промокод при заказе, а доставку выбрали на этом устройстве);
 *  - серверной корзины нет (null) → локальная без изменений.
 *
 * Вызов «когда сливать, а когда принимать серверное как есть» — planCartSync.
 */
export const mergeCarts = (
  local: SyncableCart | null,
  remote: SyncableCart | null,
): SyncableCart => {
  const localItems = local?.items ?? [];
  const remoteItems = remote?.items ?? [];

  if (localItems.length === 0) {
    // Пустая локальная — серверная целиком (или пустая, если и её нет)
    return {
      items: remoteItems.map((item) => ({ ...item })),
      promo: remote?.promo ?? '',
      deliveryMethod: remote?.deliveryMethod ?? local?.deliveryMethod ?? 'courier',
    };
  }

  if (remoteItems.length === 0) {
    return {
      items: localItems.map((item) => ({ ...item })),
      promo: local?.promo ?? '',
      deliveryMethod: local?.deliveryMethod ?? 'courier',
    };
  }

  // Копии локальных позиций: merge не мутирует вход (локальный стейт и
  // серверные снапшоты остаются нетронутыми)
  const merged: SyncCartItem[] = localItems.map((item) => ({ ...item }));
  const mergedById = new Map(merged.map((item) => [item.id, item]));

  for (const remoteItem of remoteItems) {
    const existing = mergedById.get(remoteItem.id);
    if (!existing) {
      merged.push({ ...remoteItem });
      continue;
    }
    // Один и тот же товар на двух устройствах: БОЛЬШЕЕ из двух количеств,
    // но не выше склада. Max, а не сумма: merge идемпотентен — повторный
    // merge той же пары корзин (перезагрузка страницы, повторный вход)
    // не меняет результат и не удваивает количество.
    const stocks = [existing.stockQuantity, remoteItem.stockQuantity].filter(
      (s): s is number => typeof s === 'number' && s > 0,
    );
    const stockCap = stocks.length > 0 ? Math.min(...stocks) : DEFAULT_STOCK;
    existing.quantity = Math.min(stockCap, Math.max(existing.quantity, remoteItem.quantity));
  }

  return {
    items: merged.slice(0, SYNC_CART_MAX_ITEMS),
    promo: local?.promo || remote?.promo || '',
    deliveryMethod: local?.deliveryMethod ?? remote?.deliveryMethod ?? 'courier',
  };
};

/**
 * Стабильный слепок корзины для дедупликации PUT (не гоняем одинаковые
 * корзины на сервер при каждом открытии страницы). JSON.stringify с
 * отсортированными ключами на верхнем уровне позиций.
 */
export const cartSignature = (
  cart: Pick<SyncableCart, 'items' | 'promo' | 'deliveryMethod'>,
): string => {
  const items = cart.items.map((item) => {
    const sorted: Record<string, unknown> = {};
    const source = item as unknown as Record<string, unknown>;
    for (const key of Object.keys(source).sort()) {
      sorted[key] = source[key];
    }
    return sorted;
  });
  return JSON.stringify({ items, promo: cart.promo, deliveryMethod: cart.deliveryMethod });
};

/**
 * Маркер последнего синка корзины (хранится в localStorage на клиенте):
 * слепок локальной корзины на момент, когда сервер её уже получил
 * (успешный PUT / adopt после pull).
 */
export interface CartSyncMarker {
  userId: string;
  signature: string;
}

/** Решение pull-а: принять серверную корзину как есть или сливать с локальной */
export type CartSyncPlan = { mode: 'adopt' | 'merge'; cart: SyncableCart };

/**
 * Что делать с серверной корзиной при входе / загрузке страницы с сессией.
 *
 *  - Маркер совпадает (тот же пользователь, локальная корзина сигнатурно
 *    не изменилась с последнего подтверждённого синка) → ADOPT: сервер —
 *    источник истины, принимаем его корзину целиком (в т.ч. удаления и
 *    уменьшения количества, сделанные на другом устройстве). Серверной нет
 *    (null) → пустая корзина с локальным способом доставки.
 *    Ничего не суммируем — именно здесь удваивалась корзина при каждой
 *    перезагрузке.
 *  - Маркера нет / он чужой / локальная менялась после синка (гостевые
 *    правки, неуспешный PUT, смена аккаунта) → MERGE: mergeCarts (max,
 *    идемпотентен), результат уйдёт на сервер PUT-ом.
 *
 * marker — то, что вернул клиент из localStorage (null — нет/битый).
 */
export const planCartSync = (
  local: SyncableCart | null,
  remote: SyncableCart | null,
  marker: CartSyncMarker | null,
  userId: string,
): CartSyncPlan => {
  const localCart: SyncableCart = local ?? {
    items: [],
    promo: '',
    deliveryMethod: 'courier',
  };

  const unchangedSinceSync =
    !!marker && marker.userId === userId && marker.signature === cartSignature(localCart);

  if (unchangedSinceSync) {
    // Сервер — источник истины: локальное не расходилось с последним синком.
    // null (ключа нет — очищено на другом устройстве / истёк TTL 90 дней)
    // → пустая корзина; выбор доставки остаётся за этим устройством.
    const adopted: SyncableCart = remote ?? {
      items: [],
      promo: '',
      deliveryMethod: localCart.deliveryMethod,
    };
    return { mode: 'adopt', cart: adopted };
  }

  return { mode: 'merge', cart: mergeCarts(localCart, remote) };
};
