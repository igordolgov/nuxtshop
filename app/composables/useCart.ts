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
// Синк корзины с аккаунтом: чистая логика merge/санитизации (общая с сервером).
// cartSync — полностью автономный модуль (без импортов из composables): он же
// подключается сервером (cartHelpers), и любые ссылки на DOM-зависимые
// композаблы ломали бы серверный tsconfig-граф.
import {
  cartSignature,
  normalizeRemoteCart,
  planCartSync,
  type CartSyncMarker,
  type SyncableCart,
  type SyncCartItem,
  type SyncPromo,
} from '../utils/cartSync';

const STORAGE_KEY = 'cart';
// Владелец локальной корзины (id пользователя, с которым она синхронизирована
// в последний раз): вход в ДРУГОЙ аккаунт на этом устройстве не переносит
// чужую корзину в новую учётку — берём серверную корзину целиком.
const OWNER_KEY = 'cart-owner';
// Маркер последнего синка { userId, signature }: слепок локальной корзины,
// который сервер уже получил (успешный PUT или adopt после pull). По нему
// pull при загрузке страницы отличает «локаль не менялась с последнего
// синка → принять серверную как есть» от «есть несинхронизированные
// изменения → слить». Без маркера merge выполнялся бы при каждой
// перезагрузке и удваивал количество (баг релиза синка).
const SYNC_MARKER_KEY = 'cart-sync-marker';
// Задержка пуша после мутации: склеиваем серии изменений
// (например, +1 шт. кликами по счётчику) в один PUT.
const PUSH_DEBOUNCE_MS = 1200;

const DELIVERY_METHOD_IDS: DeliveryMethodId[] = ['courier', 'pickup', 'post'];

/**
 * Позиция корзины — снапшот товара, замороженный при добавлении.
 * Каноническая форма — SyncCartItem в utils/cartSync.ts (его же валидация
 * хранит на сервере); здесь алиас ради совместимости всех импортов CartItem.
 */
export type CartItem = SyncCartItem;

/** Применённый промокод: валидация на сервере, скидка пересчитывается локально */
export type AppliedPromo = SyncPromo;

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

  // ─── Синк с аккаунтом ───────────────────────────────────
  // id пользователя, с которым корзина синхронизируется в ЭТОЙ сессии
  // (null — гость: только localStorage, никаких запросов к /api/my/cart).
  const syncUserId = ref<string | null>(null);
  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  // Слепок последнего удачно отправленного состояния: не гоняем одинаковые
  // корзины при каждом изменении (PUT только на реальные диффы).
  let lastPushedSignature: string | null = null;
  // Дедупликация pull при входе (login-страница + initializeApp могут
  // вызвать handleAuthLogin почти одновременно).
  let pullInFlight: Promise<void> | null = null;

  const readOwner = (): string | null => {
    try {
      return localStorage.getItem(OWNER_KEY);
    } catch {
      return null;
    }
  };

  const writeOwner = (userId: string): void => {
    try {
      localStorage.setItem(OWNER_KEY, userId);
    } catch {
      // приватный режим — синк продолжает работать в рамках сессии
    }
  };

  /** Маркер последнего синка: null — нет/битый (трактуем как «нет синка») */
  const readSyncMarker = (): CartSyncMarker | null => {
    try {
      const raw = localStorage.getItem(SYNC_MARKER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<CartSyncMarker>;
      return typeof parsed.userId === 'string' && typeof parsed.signature === 'string'
        ? { userId: parsed.userId, signature: parsed.signature }
        : null;
    } catch {
      return null;
    }
  };

  /** Сервер получил корзину с этой сигнатурой — запоминаем */
  const writeSyncMarker = (userId: string, signature: string): void => {
    try {
      localStorage.setItem(SYNC_MARKER_KEY, JSON.stringify({ userId, signature }));
    } catch {
      // приватный режим — merge-ветка planCartSync остаётся безопасной
    }
  };

  const pushCart = async (): Promise<void> => {
    if (!import.meta.client || !syncUserId.value) return;
    const payload: SyncableCart = {
      items: state.value.items,
      promo: state.value.promo,
      deliveryMethod: state.value.deliveryMethod,
    };
    const signature = cartSignature(payload);
    if (signature === lastPushedSignature) return;
    if (pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
    }
    try {
      await $fetch('/api/my/cart', {
        method: 'PUT',
        credentials: 'include',
        body: { cart: payload },
      });
      lastPushedSignature = signature;
      // Сервер получил это состояние — обновляем маркер синка
      if (syncUserId.value) writeSyncMarker(syncUserId.value, signature);
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 401) {
        // Сессия истекла на сервере: гасим синк, локальная корзина остаётся
        syncUserId.value = null;
        lastPushedSignature = null;
        return;
      }
      // Сеть/сервер упали — отправим при следующей мутации (signature не запомнен)
      console.warn('[useCart] Не удалось сохранить корзину на сервере:', error);
    }
  };

  const schedulePush = (): void => {
    if (!import.meta.client || !syncUserId.value) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      void pushCart();
    }, PUSH_DEBOUNCE_MS);
  };

  /** Стандартная реакция на мутацию корзины: localStorage + UI + сервер */
  const markMutated = (): void => {
    saveCartToStorage();
    emitUpdated();
    schedulePush();
  };

  /**
   * Вход в аккаунт / загрузка страницы с живой сессией: подтянуть серверную
   * корзину и принять/объединить с локальной (planCartSync в cartSync.ts).
   * Вызывается из useAuth.login/register и из initializeApp после checkAuth —
   * то есть при КАЖДОЙ загрузке страницы с сессией, поэтому:
   *  - маркер синка совпадает (локаль не менялась) → adopt — серверная корзина
   *    принимается как есть, ничего не суммируется (раньше merge-сумма при
   *    каждой перезагрузке удваивала количество);
   *  - маркера нет / локаль менялась (гостевые правки, сорванный PUT,
   *    чужой аккаунт) → merge — max-слияние, идемпотентное само по себе.
   */
  const handleAuthLogin = (user: { id?: string | number | null } | null): Promise<void> => {
    if (!import.meta.client) return Promise.resolve();
    const userId = user?.id != null ? String(user.id) : null;
    if (!userId || syncUserId.value === userId) return Promise.resolve();
    if (pullInFlight) return pullInFlight;

    pullInFlight = (async () => {
      // Локальное сохранённое ДОЛЖНО быть прочитано до merge: initializeApp
      // может дойти до checkAuth раньше, чем отработает fetchCart после
      // suspense:resolve — иначе merge примет гостевую корзину за пустую,
      // а отложенный fetchCart затрёт результат своим стейтом.
      if (!loaded.value) fetchCart();

      let remote: SyncableCart | null = null;
      try {
        const resp = await $fetch<{ success: boolean; cart: unknown }>('/api/my/cart', {
          credentials: 'include',
        });
        remote = normalizeRemoteCart(resp?.cart);
      } catch (error) {
        if ((error as { status?: number }).status === 401) return; // сессии нет
        console.warn('[useCart] Не удалось загрузить корзину аккаунта:', error);
        return; // сеть упала — подтянем при следующем входе/загрузке
      }

      // На этом устройстве уже синхронизировали ДРУГОЙ аккаунт — локальную
      // корзину (его) не переносим в новую учётку
      const owner = readOwner();
      const discardLocal = owner != null && owner !== userId;
      const localIds = new Set(state.value.items.map((item) => item.id));

      const plan = planCartSync(
        discardLocal
          ? null
          : {
              items: state.value.items,
              promo: state.value.promo,
              deliveryMethod: state.value.deliveryMethod,
            },
        remote,
        readSyncMarker(),
        userId,
      );

      state.value.items = plan.cart.items;
      state.value.promo = plan.cart.promo;
      state.value.deliveryMethod = plan.cart.deliveryMethod;
      syncUserId.value = userId;
      writeOwner(userId);
      saveCartToStorage();
      emitUpdated();

      // Пушим только реальный дифф с сервером (пустая серверная + пустая локальная
      // → PUT не нужен вовсе). Маркер синка пишем сразу, когда локальный стейт
      // УЖЕ равен серверному (adopt и merge без диффа): серверное состояние
      // получено. При диффе маркер запишет pushCart после успешного PUT —
      // если PUT сорвётся, локаль останется «изменённой» и pull повторит merge.
      const current = cartSignature({
        items: state.value.items,
        promo: state.value.promo,
        deliveryMethod: state.value.deliveryMethod,
      });
      const remoteSignature = remote ? cartSignature(remote) : null;
      if (current !== remoteSignature) {
        lastPushedSignature = null;
        void pushCart();
      } else {
        lastPushedSignature = current;
        writeSyncMarker(userId, current);
      }

      // Тост — только когда с сервера приехали новые позиции
      const added = (remote?.items ?? []).filter((item) => !localIds.has(item.id)).length;
      if (added > 0) {
        try {
          const notify = (
            useNuxtApp() as unknown as { $notify?: { success?: (m: string) => void } }
          ).$notify;
          notify?.success?.(
            tr('cart.syncMerged', 'В корзину добавлено товаров из вашего аккаунта: {count}', {
              count: added,
            }),
          );
        } catch {
          // вне Nuxt-контекста — без тоста
        }
      }
    })();

    pullInFlight.finally(() => {
      pullInFlight = null;
    });
    return pullInFlight;
  };

  /**
   * Выход из аккаунта: синк гасится, локальная корзина остаётся гостевой.
   * Owner и маркер синка не трогаем — повторный вход в тот же аккаунт
   * сравнит локаль с последним синком (adopt) или сольёт гостевые правки.
   */
  const handleAuthLogout = (): void => {
    if (!import.meta.client) return;
    if (pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
    }
    syncUserId.value = null;
    lastPushedSignature = null;
  };

  // Финальный пуш при уходе со страницы/скрытии таба: debounce не дождётся
  if (import.meta.client) {
    const flush = () => {
      if (!pushTimer) return;
      clearTimeout(pushTimer);
      pushTimer = null;
      void pushCart();
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', flush);
  }

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

    markMutated();
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

    markMutated();
  };

  const removeFromCart = async (itemId: string): Promise<void> => {
    state.value.items = state.value.items.filter((i) => i.id !== itemId);
    markMutated();
  };

  const clearCart = async (): Promise<void> => {
    state.value.items = [];
    state.value.promo = '';
    // Синк отдаст на сервер пустую корзину — там ключ удаляется
    markMutated();
  };

  /**
   * Выбор способа доставки: единая точка для корзины и чекаута —
   * выбор в корзине сразу виден в итогах чекаута и наоборот.
   */
  const setDeliveryMethod = (methodId: DeliveryMethodId): void => {
    if (!DELIVERY_METHOD_IDS.includes(methodId)) return;
    state.value.deliveryMethod = methodId;
    saveCartToStorage();
    schedulePush();
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
    markMutated();
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
      markMutated();
      return false;
    } catch {
      return true;
    }
  };

  const removePromoCode = async (): Promise<void> => {
    state.value.promo = '';
    markMutated();
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
    // Синк с аккаунтом (вызывает useAuth: login/register/logout, initializeApp)
    handleAuthLogin,
    handleAuthLogout,
    proceedToCheckout,
    getMaxQuantity,
    getProductUrl,
    slugify,
  };
}
