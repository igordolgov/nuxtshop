// app/composables/useCart.ts
// ============================================
// Composable: useCart — корзина (singleton на клиенте).
// Снапшоты товаров в localStorage; все суммы — computed.
// Промокод: валидируется на сервере (POST /api/promocodes/validate),
// в localStorage хранится { code, type, value }; скидка пересчитывается
// на клиенте по тем же правилам, что и на сервере (promoHelpers),
// окончательный расчёт всё равно делает сервер при заказе.
// ============================================

import { ref, computed } from 'vue';
// tr() — перевод вне setup-контекста (синглтон useCart живёт в middleware);
// serverMessageTr — серверные коды ошибок (server.* в словарях)
import { tr } from './tr';
import { serverMessageTr } from './useServerMessage';
// Правила доставки — единый модуль (зеркало server/lib/orderHelpers.ts):
// до него чекаут держал собственный статический список цен и суммы
// корзина/чекаут расходились (аудит F3)
import { getDeliveryPrice, type DeliveryMethodId } from '../utils/deliveryPrice';
// Варианты товара: составной id позиции, цена/склад варианта, заморозка
// названия в языке страницы (контракт — server/lib/productHelpers.ts)
import {
  cartLineId,
  variantPrice,
  variantStock,
  cartVariantTitle,
  firstVariant,
  type ProductVariantLike,
} from '../utils/productVariants';

const STORAGE_KEY = 'cart';

const DELIVERY_METHOD_IDS: DeliveryMethodId[] = ['courier', 'pickup', 'post'];

/** Позиция корзины — снапшот товара, замороженный при добавлении */
export interface CartItem {
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
export interface AppliedPromo {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
}

/** Товар, который можно положить в корзину (витринный снапшот) */
export interface CartProductInput {
  id?: string | number | null;
  name?: string | null;
  slug?: string | null;
  description?: string | null;
  image?: string | null;
  originalPrice?: number | null;
  discount?: number | null;
  price?: number | null;
  variants?: ProductVariantLike[] | null;
  variantName?: string | null;
  variantNameEn?: string | null;
  variantNameEs?: string | null;
  inStock?: boolean | null;
  stockQuantity?: number | null;
  category?: string | { name?: string | null } | null;
  categories?: Array<string | { name?: string | null }> | null;
}

interface CartState {
  items: CartItem[];
  promo: AppliedPromo | '';
  deliveryMethod: DeliveryMethodId;
  processing: boolean;
  error: string;
}

/** Текущая локаль в не-setup контексте (как в tr.ts — через синглтон). */
const currentLocale = (): string => {
  try {
    return useNuxtApp().$i18n?.locale?.value || 'ru';
  } catch {
    return 'ru';
  }
};

const slugify = (str?: string | null): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

/**
 * Достаёт название категории из товара в любом из встречающихся форматов:
 *   category: 'Электроника'                    → строка
 *   category: { name: 'Электронica', slug }    → объект
 *   categories: ['Электроника']                → массив строк
 *   categories: [{ name: 'Электроника' }]      → массив объектов
 * Ничего не нашлось — 'Другое'.
 * (Раньше читался только categories?.[0], которого в товарах нет,
 *  — все позиции в корзине получали категорию «Другое»)
 */
const resolveCategory = (product?: CartProductInput | null): string => {
  const raw = product?.category ?? product?.categories?.[0];
  if (!raw) return 'Другое';
  return typeof raw === 'string' ? raw : raw.name || 'Другое';
};

let cartInstance: ReturnType<typeof createCart> | null = null;

export const useCart = () => {
  // SSR: свежий инстанс на каждый запрос
  if (import.meta.server) return createCart();

  if (cartInstance) return cartInstance;
  cartInstance = createCart();
  return cartInstance;
};

function createCart() {
  const router = useRouter();
  // Витринные ссылки сохраняют префикс локали (/en/cart/checkout и т.д.);
  // в админке локаль ru без префикса — путь остаётся прежним
  const localePath = useLocalePath();

  const state = ref<CartState>({
    items: [],
    // Применённый промокод: { code, type: 'percent'|'fixed', value } или ''
    promo: '',
    // Способ доставки: выбирается в корзине, чекаут читает тот же
    // источник (синхронизация корзина ↔ чекаут, аудит F3)
    deliveryMethod: 'courier',
    processing: false,
    error: '',
  });

  const loaded = ref(false);

  // ─── Computed ─────────────────────────────────────────────

  const cartItems = computed(() => state.value.items);
  const appliedPromo = computed(() => state.value.promo);
  const isProcessing = computed(() => state.value.processing);
  const promoError = computed(() => state.value.error);

  const subtotal = computed(() =>
    cartItems.value.reduce((sum, item) => {
      const price = item.currentPrice || item.price || 0;
      return sum + price * (item.quantity || 0);
    }, 0),
  );

  // Правила расчёта зеркалят server/lib/promoHelpers.calcDiscount:
  // percent — с округлением до рубля, fixed — не больше суммы корзины.
  // Итог при заказе пересчитает сервер — расхождение не страшно,
  // но и этого хватает, чтобы UI и заказ почти всегда совпадали.
  const discount = computed(() => {
    const promo = state.value.promo;
    if (!promo || typeof promo !== 'object' || !promo.code) return 0;
    const base = subtotal.value;
    if (base <= 0) return 0;
    const raw = promo.type === 'percent' ? (base * promo.value) / 100 : promo.value;
    return Math.max(0, Math.min(Math.round(raw), Math.round(base)));
  });

  // Цена доставки по выбранному способу и сумме — правила в
  // app/utils/deliveryPrice.ts (зеркало серверных)
  const deliveryPrice = computed(() =>
    getDeliveryPrice(state.value.deliveryMethod, subtotal.value),
  );

  const total = computed(() => subtotal.value - discount.value + deliveryPrice.value);

  const totalItems = computed(() =>
    cartItems.value.reduce((sum, item) => sum + (item.quantity || 0), 0),
  );

  const discountPercent = computed(() =>
    subtotal.value > 0 ? Math.round((discount.value / subtotal.value) * 100) : 0,
  );

  const hasOutOfStockItems = computed(() =>
    cartItems.value.some((item) => (item.quantity || 0) > (item.stockQuantity || 999)),
  );

  const deliveryMethod = computed(() => state.value.deliveryMethod);

  // ─── Storage ──────────────────────────────────────────────

  const saveCartToStorage = () => {
    if (!import.meta.client) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          items: state.value.items,
          promo: state.value.promo,
          deliveryMethod: state.value.deliveryMethod,
        }),
      );
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  };

  const fetchCart = () => {
    if (!import.meta.client || loaded.value) return;
    loaded.value = true;

    try {
      const savedCart = localStorage.getItem(STORAGE_KEY);
      if (!savedCart) return;

      const parsed = JSON.parse(savedCart);
      state.value.items = Array.isArray(parsed.items) ? parsed.items : [];
      // Миграция: раньше промокод хранился строкой (жёсткий SALE10);
      // теперь объект с типом скидки — старую строку сбрасываем.
      const savedPromo = parsed.promo;
      state.value.promo =
        savedPromo && typeof savedPromo === 'object' && savedPromo.code ? savedPromo : '';
      // Способ доставки: сохранённый валидный — восстанавливаем,
      // мусор/старые записи без поля — дефолт «курьером»
      if (DELIVERY_METHOD_IDS.includes(parsed.deliveryMethod)) {
        state.value.deliveryMethod = parsed.deliveryMethod;
      }
      console.log('📥 Корзина загружена:', state.value.items.length, 'товаров');
    } catch (error) {
      console.error('Error loading cart:', error);
      state.value.items = [];
      state.value.promo = '';
    }
  };

  const emitUpdated = () => {
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('cart-updated'));
    }
  };

  // ─── Методы ───────────────────────────────────────────────

  const addToCart = async (
    product?: CartProductInput | null,
    variant: ProductVariantLike | null = null,
  ): Promise<boolean> => {
    if (!product?.id) {
      console.error('Invalid product:', product);
      return false;
    }

    // Вариант (цвет/память): позиция ключуется составным id
    // «productId::variantId» — два цвета лежат в корзине как две строки;
    // сервер (orderHelpers.createOrder) разбирает id сам.
    // Вариант не указан (быстрый «+» из списков) — берём первый: он несёт
    // базовую цену товара (контракт seeds, см. productVariants.ts).
    const effectiveVariant = variant ?? firstVariant(product);
    const lineId = cartLineId(product.id, effectiveVariant?.id);
    const stock = variantStock(product, effectiveVariant);
    const price = variantPrice(product, effectiveVariant);

    const existing = state.value.items.find((item) => item.id === lineId);

    if (existing) {
      const nextQty = existing.quantity + 1;
      const max = stock.stockQuantity || 0;
      if (nextQty > max) {
        // Локализованный текст: тост корзины показывает error.message
        throw new Error(
          tr('cart.maxQuantity', 'Нельзя добавить больше {max} шт. товара «{name}»', {
            max,
            name: product.name,
          }),
        );
      }
      existing.quantity = nextQty;
    } else {
      if ((stock.stockQuantity || 0) === 0) {
        // Локализованный текст: тост корзины показывает error.message
        throw new Error(
          tr('cart.outOfStock', 'Товар «{name}» отсутствует на складе', {
            name: product.name,
          }),
        );
      }

      const productSlug = product.slug || slugify(product.name);
      const variantTitle = cartVariantTitle(effectiveVariant, currentLocale());

      state.value.items.push({
        id: lineId,
        name: product.name || tr('cart.unnamedProduct', 'Без названия'),
        variantId: effectiveVariant?.id ?? null,
        variantName: variantTitle,
        description: product.description || '',
        price,
        currentPrice: price,
        originalPrice: product.originalPrice || price,
        quantity: 1,
        image: effectiveVariant?.image || product.image || '',
        // Категория через resolveCategory: строка / объект / массив —
        // всё покрывается (раньше только categories?.[0] → всегда «Другое»)
        category: resolveCategory(product),
        stockQuantity: stock.stockQuantity || 0,
        inStock: stock.inStock,
        discount: product.discount || 0,
        slug: productSlug || null,
      });
    }

    saveCartToStorage();
    emitUpdated();
    console.log('➕ Товар добавлен, всего:', totalItems.value);
    return true;
  };

  const updateItemQuantity = async (itemId: string, newQuantity: number): Promise<void> => {
    const item = state.value.items.find((i) => i.id === itemId);
    if (!item) return;

    const max = item.stockQuantity || 999;
    if (newQuantity > max) {
      // Локализованный текст: тост корзины показывает error.message
      throw new Error(
        tr('cart.maxQuantity', 'Нельзя добавить больше {max} шт. товара «{name}»', {
          max,
          name: item.name,
        }),
      );
    }

    item.quantity = Math.max(0, newQuantity);

    if (item.quantity === 0) {
      state.value.items = state.value.items.filter((i) => i.id !== itemId);
    }

    saveCartToStorage();
    emitUpdated();
  };

  const removeFromCart = async (itemId: string): Promise<void> => {
    state.value.items = state.value.items.filter((i) => i.id !== itemId);
    saveCartToStorage();
    emitUpdated();
  };

  const clearCart = async (): Promise<void> => {
    state.value.items = [];
    state.value.promo = '';
    saveCartToStorage();
    emitUpdated();
  };

  /**
   * Выбор способа доставки: единая точка для корзины и чекаута —
   * выбор в корзине сразу виден в итогах чекаута и наоборот.
   */
  const setDeliveryMethod = (methodId: DeliveryMethodId): void => {
    if (!DELIVERY_METHOD_IDS.includes(methodId)) return;
    state.value.deliveryMethod = methodId;
    saveCartToStorage();
  };

  interface PromoValidateResponse {
    valid: boolean;
    message?: string;
    // причина отказа — ключ локализации server.promo* на клиенте
    reason?: 'not_found' | 'inactive' | 'expired' | 'limit';
    // valid: true → сервер всегда возвращает promo
    promo: { code: string; type: 'percent' | 'fixed'; value: number };
  }

  // причина отказа сервера → ключ словаря (секция server.*)
  const PROMO_REASON_KEYS: Record<NonNullable<PromoValidateResponse['reason']>, string> = {
    not_found: 'server.promoNotFound',
    inactive: 'server.promoInactive',
    expired: 'server.promoExpired',
    limit: 'server.promoLimit',
  };

  const applyPromoCode = async (code?: string | null): Promise<boolean> => {
    const trimmed = String(code || '').trim();
    if (!trimmed) throw new Error(tr('cart.promoEnter', 'Введите промокод'));

    // Валидация на сервере: список промокодов живёт в KV (админка
    // /admin/promocodes). Клиентские суммы не участвуют в заказе.
    const resp = await $fetch<PromoValidateResponse>('/api/promocodes/validate', {
      method: 'POST',
      body: { code: trimmed, subtotal: subtotal.value },
    }).catch((error) => {
      // код сервера → server.* (сейчас promoEmpty), иначе локализованный фолбэк
      throw new Error(
        serverMessageTr(error) || tr('cart.promoCheckFailed', 'Не удалось проверить промокод'),
      );
    });

    if (!resp?.valid) {
      // Русский текст сервера не показываем: причина (reason) → server.promo*
      const reasonKey = resp?.reason ? PROMO_REASON_KEYS[resp.reason] : null;
      const invalid = tr('cart.promoInvalid', 'Неверный промокод');
      const msg = reasonKey ? tr(reasonKey, invalid) : invalid;
      state.value.error = msg;
      throw new Error(msg);
    }

    state.value.promo = {
      code: resp.promo.code,
      type: resp.promo.type,
      value: resp.promo.value,
    };
    state.value.error = '';
    saveCartToStorage();
    emitUpdated();
    return true;
  };

  /**
   * Перепроверка сохранённого промокода (срок/лимиты могли истечь
   * между сессиями). Невалидный удаляется из корзины. Ошибка сети
   * не наказывается: считаем промокод действующим, сервер перепроверит
   * при заказе.
   */
  const revalidatePromo = async (): Promise<boolean> => {
    const promo = state.value.promo;
    if (typeof promo !== 'object' || !promo.code) return true;
    try {
      const resp = await $fetch<PromoValidateResponse>('/api/promocodes/validate', {
        method: 'POST',
        body: { code: promo.code, subtotal: subtotal.value },
      });
      if (resp?.valid) {
        state.value.promo = {
          code: resp.promo.code,
          type: resp.promo.type,
          value: resp.promo.value,
        };
        saveCartToStorage();
        return true;
      }
      state.value.promo = '';
      saveCartToStorage();
      emitUpdated();
      return false;
    } catch {
      return true;
    }
  };

  const removePromoCode = async (): Promise<void> => {
    state.value.promo = '';
    saveCartToStorage();
    emitUpdated();
  };

  const proceedToCheckout = async (): Promise<void> => {
    state.value.processing = true;
    try {
      await router.push(localePath('/cart/checkout'));
    } finally {
      state.value.processing = false;
    }
  };

  /**
   * Лимит склада для позиции корзины.
   * Принимает и id, и объект позиции: страница корзины вызывает
   * getMaxQuantity(item), другие места — getMaxQuantity(id).
   * (Раньше при передаче объекта сравнение i.id === объект всегда
   *  было false → возврат 999 → блок «Доступно: N шт.» не показывался)
   */
  const getMaxQuantity = (productOrId?: CartItem | string | number | null): number => {
    const id = typeof productOrId === 'object' ? productOrId?.id : productOrId;
    const item = state.value.items.find((i) => i.id === id);
    return item?.stockQuantity || 999;
  };

  const getProductUrl = (
    product?: { slug?: string | null; name?: string | null; id?: string | number } | null,
  ): string => {
    if (!product) return localePath('/');
    const slug = product.slug || slugify(product.name) || product.id;
    return localePath(`/product/${slug}`);
  };

  // Инициализация — один раз при первом вызове на клиенте.
  // ⚠️ localStorage-загруз НЕ синхронно до гидратации: сервер рендерит
  // «корзина пуста» (бейдж в шапке/нижнем меню), клиент к первому кадру
  // уже видел сохранённое — hydration mismatch (как у useFavorites).
  // Первый кадр «пусто» (= SSR), сохранённое приезжает сразу после
  // гидратации реактивной сменой состояния.
  if (import.meta.client) {
    let nuxtApp: ReturnType<typeof useNuxtApp> | null = null;
    try {
      nuxtApp = useNuxtApp();
    } catch {
      // вне Nuxt-контекста (тесты) — грузим синхронно, как раньше
    }
    if (nuxtApp?.isHydrating) {
      nuxtApp.hooks.hookOnce('app:suspense:resolve', () => fetchCart());
    } else {
      fetchCart();
    }
  }

  return {
    cartItems,
    appliedPromo,
    isProcessing,
    promoError,

    subtotal,
    discount,
    total,
    totalItems,
    deliveryPrice,
    deliveryMethod,
    setDeliveryMethod,
    discountPercent,
    hasOutOfStockItems,

    addToCart,
    clearCart,
    updateItemQuantity,
    removeFromCart,
    applyPromoCode,
    revalidatePromo,
    removePromoCode,
    fetchCart,
    proceedToCheckout,
    getMaxQuantity,
    getProductUrl,
    slugify,
  };
}
