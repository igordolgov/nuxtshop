// app/composables/useProducts.ts
// ============================================
// Composable: useProducts
// Управление состоянием товаров.
// На SSR — свежий инстанс на каждый запрос.
// Административные операции (create/update/delete)
// НЕ имеют локальных fallback: ошибка сервера — ошибка в UI.
// Избранное: делегация в useFavorites, реактивность автоматическая.
// Подтверждение удаления (confirm) — ответственность вызывающего компонента.
//
// SSR-каталог: состояние товаров живёт в useState('catalog-products') —
// Nuxt сериализует его в payload, и гидратация получает каталог БЕЗ
// повторного запроса /api/products. Заполняет состояние на сервере
// страница каталога (useAsyncData в index.vue); остальные страницы
// на сервере видят пустой список, как и раньше.
//
// Разбивка (этап 6): тип CatalogProduct + чистые утилиты каталога —
// catalogProduct.ts, API-мутации (update/create/delete/bulk) —
// useProductMutations.ts (стейт передаётся через контекст).
// ============================================

import { ref, computed, watch, effectScope, type EffectScope } from 'vue';
import type { CatalogProduct, ProductFilters } from './catalogProduct';
import {
  catalogProductsByCategory,
  cleanProductsForStorage,
  filterCatalogProducts,
  fixProductImages,
  searchCatalogProducts,
  sortCatalogProducts,
  updateProductStockStatus,
} from './catalogProduct';
import { useProductMutations } from './useProductMutations';
// serverMessageTr — серверные коды ошибок (server.* в словарях) вне setup;
// tr — перевод вне setup-контекста (см. composables/tr.ts)
import { serverMessageTr } from './useServerMessage';
import { tr } from './tr';
let productsState: ReturnType<typeof createProducts> | null = null;
let isInitialized = false;
// Detached-scope для вотча флагов избранного: живёт на уровне
// модуля-синглтона, а не компонента, чей setup первым вызвал
// useProducts (иначе вотч умирает при размонтировании той страницы)
let favoriteFlagsScope: EffectScope | null = null;
// Дедупликация параллельных loadProducts: после app:suspense:resolve
// инициализацию запускают auth-init.global.ts и AdminProducts.onMounted
// (плюс ленивые вызовы из шапки/страниц) — без общего промиса это 2–3
// одинаковых запроса /api/products за первый рендер. force=true
// («Обновить» руками) — мимо кэша.
let productsInFlight: Promise<CatalogProduct[]> | null = null;
// Дедупликация параллельных ensureFullProducts: карточный слепок из
// SSR-payload добирается до полных данных из нескольких мест (инициализация
// после гидратации, «в сравнение» из карточки, админ-редактирование) —
// все должны получить ОДИН и тот же фоновый запрос.
let fullInFlight: Promise<CatalogProduct[]> | null = null;

export const useProducts = () => {
  if (import.meta.server) return createProducts();

  if (productsState) return productsState;
  productsState = createProducts();
  return productsState;
};

function createProducts() {
  const { $notify } = useNuxtApp();

  // useState вместо ref: на сервере значение попадает в payload запроса,
  // на клиенте при гидратации ref сразу инициализируется данными с сервера.
  // Все присваивания products.value = ... работают как раньше.
  const products = useState<CatalogProduct[]>('catalog-products', () => []);
  // Полный ли каталог в state? На сервере state — карточный слепок
  // (лёгкий payload, см. toCatalogCardProduct); клиент после гидратации
  // добирает полные данные. Гидратация при этом не расходится: и SSR,
  // и клиент стартуют с одного и того же слепка из payload.
  const catalogFull = useState<boolean>('catalog-full', () => false);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const favorites = useFavorites();

  let cachedCategories: string[] = [];
  let lastProductsForCategories = '';

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    if (!import.meta.client) return;
    if ($notify) {
      if (type === 'success') $notify.success(message);
      else if (type === 'error') $notify.error(message);
      else $notify.info(message);
      return;
    }
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  // Человекочитаемое сообщение из ошибки $fetch: серверный код → server.*
  // (словарь), иначе русский текст сервера как последний фолбэк — он хотя
  // бы содержит детали (админ-операции), но ДО него всегда пробуем словарь.
  const errorMessage = (err?: unknown): string => {
    const coded = serverMessageTr(err);
    if (coded) return coded;
    const e = err as {
      data?: { message?: string; statusMessage?: string };
      message?: string;
    } | null;
    return (
      e?.data?.message ||
      e?.data?.statusMessage ||
      e?.message ||
      tr('checkout.unknownError', 'Неизвестная ошибка')
    );
  };

  const persist = () => {
    if (!import.meta.client) return;
    try {
      localStorage.setItem('products', JSON.stringify(cleanProductsForStorage(products.value)));
    } catch (e) {
      console.warn('[useProducts] localStorage save failed:', (e as Error).message);
    }
  };

  // ─── Загрузка ─────────────────────────────────────────────

  /** /api/products с одиночным повтором на сервере: чтение KV иногда
   *  спотыкается на холодном изоляте воркера — без повтора посетитель
   *  получал скелет вместо SSR-каталога (медленный прогон PageSpeed). */
  const fetchCatalog = async (): Promise<CatalogProduct[] | { products?: CatalogProduct[] }> => {
    try {
      return await $fetch<CatalogProduct[] | { products?: CatalogProduct[] }>('/api/products');
    } catch (err) {
      if (!import.meta.server) throw err;
      await new Promise((resolve) => setTimeout(resolve, 250));
      return await $fetch<CatalogProduct[] | { products?: CatalogProduct[] }>('/api/products');
    }
  };

  const loadProducts = async (force = false): Promise<CatalogProduct[]> => {
    if (products.value.length > 0 && !force) return products.value;
    // Уже грузится другим вызовом — возвращаем тот же промис
    if (!force && productsInFlight) return productsInFlight;

    loading.value = true;
    error.value = null;

    const request = (async (): Promise<CatalogProduct[]> => {
      try {
        const response = await fetchCatalog();
        const list = Array.isArray(response) ? response : response?.products || [];

        products.value = list.map((product) =>
          updateProductStockStatus(
            fixProductImages({
              ...product,
              isFavorite: favorites.isFavorite(product.id),
            }) as CatalogProduct,
          ),
        );
        if (import.meta.server) {
          // SSR-payload — карточный слепок: галереи/характеристики не нужны
          // витрине каталога (−70 КБ на страницу), клиент доберёт фоном
          products.value = products.value.map(
            (product) => toCatalogCardProduct(product) as CatalogProduct,
          );
          catalogFull.value = false;
        } else {
          catalogFull.value = true;
        }
        persist();
        return products.value;
      } catch (err) {
        console.error('[useProducts] Ошибка загрузки товаров:', err);
        error.value = errorMessage(err);
        showNotification('error', tr('catalog.loadError', 'Ошибка загрузки товаров'));

        // Офлайн-фолбэк на чтение — легитимен для PWA
        if (import.meta.client) {
          try {
            const cached = localStorage.getItem('products');
            if (cached) {
              products.value = (JSON.parse(cached) as CatalogProduct[]).map((product) =>
                updateProductStockStatus(
                  fixProductImages({
                    ...product,
                    isFavorite: favorites.isFavorite(product.id),
                  }) as CatalogProduct,
                ),
              );
              showNotification(
                'info',
                tr('catalog.cachedData', 'Используются кэшированные данные'),
              );
            }
          } catch (localStorageError) {
            console.warn(
              '[useProducts] localStorage read failed:',
              (localStorageError as Error).message,
            );
          }
        }
        return [];
      } finally {
        loading.value = false;
        productsInFlight = null;
      }
    })();

    if (!force) productsInFlight = request;
    return request;
  };

  /** Полные данные каталога (с характеристиками/галереями): карточный
   *  слепок из SSR-payload добирается одним фоновым запросом. Все
   *  потребители (сравнение из карточки, админ-редактирование, фон-инициализация)
   *  получают один и тот же промис — двойных запросов нет. */
  const ensureFullProducts = (): Promise<CatalogProduct[]> => {
    if (catalogFull.value) return Promise.resolve(products.value);
    if (products.value.length === 0) return loadProducts();
    if (!fullInFlight) {
      fullInFlight = loadProducts(true).finally(() => {
        fullInFlight = null;
      });
    }
    return fullInFlight;
  };

  // ─── CRUD и массовые операции: реализация в useProductMutations.ts ───
  const {
    toggleFavorite,
    updateProduct,
    createProduct,
    deleteProduct,
    bulkUpdateProducts,
    bulkDeleteProducts,
  } = useProductMutations({
    products,
    loading,
    error,
    favorites,
    persist,
    showNotification,
    errorMessage,
  });

  // ─── Поиск ────────────────────────────────────────────────

  const getProductBySlug = async (slug: string): Promise<CatalogProduct | null> => {
    try {
      // Слепок из SSR-payload не годится потребителям, которым нужны
      // характеристики/галереи: как полный товар его не возвращаем
      const local = products.value.find(
        (p) => (p.slug === slug || String(p.id) === String(slug)) && isFullCatalogProduct(p),
      );
      if (local) return local;

      if (!loading.value) {
        await loadProducts(true);
        const refreshed = products.value.find(
          (p) => (p.slug === slug || String(p.id) === String(slug)) && isFullCatalogProduct(p),
        );
        if (refreshed) return refreshed;
      }

      try {
        const response = await $fetch<{ product?: CatalogProduct } & Partial<CatalogProduct>>(
          `/api/product/${slug}`,
        );
        // Новый эндпоинт: { success, product, similarProducts }; старый: товар напрямую
        const raw = (response?.product ?? response) as CatalogProduct | null | undefined;
        if (raw) {
          const product = updateProductStockStatus(
            fixProductImages({
              ...raw,
              isFavorite: favorites.isFavorite(raw.id),
            }) as CatalogProduct,
          );
          products.value.push(product);
          return product;
        }
      } catch (apiError) {
        console.warn('[useProducts] Ошибка API поиска товара:', apiError);
      }
      return null;
    } catch (err) {
      console.error('[useProducts] Ошибка поиска товара по slug:', err);
      return null;
    }
  };

  const getProductById = (id: string | number): CatalogProduct | undefined =>
    products.value.find((p) => String(p.id) === String(id));

  const getProductsByCategory = (category?: string | null): CatalogProduct[] =>
    catalogProductsByCategory(products.value, category);

  const searchProducts = (query?: string | null): CatalogProduct[] =>
    searchCatalogProducts(products.value, query);

  const filterProducts = (filters: ProductFilters): CatalogProduct[] =>
    filterCatalogProducts(products.value, filters);

  const sortProducts = (
    list: CatalogProduct[],
    sortBy?: { field?: string; direction?: 'asc' | 'desc' },
  ): CatalogProduct[] => sortCatalogProducts(list, sortBy);

  const updateProductQuantity = (productId: string | number, newQuantity: number): boolean => {
    const idx = products.value.findIndex((p) => String(p.id) === String(productId));
    if (idx === -1) return false;
    products.value[idx] = {
      ...products.value[idx],
      stockQuantity: newQuantity,
      inStock: newQuantity > 0,
    };
    persist();
    return true;
  };

  const decreaseProductQuantity = (productId: string | number, amount = 1): number => {
    const idx = products.value.findIndex((p) => String(p.id) === String(productId));
    if (idx === -1) return -1;
    const newQuantity = Math.max(0, products.value[idx].stockQuantity - amount);
    products.value[idx] = {
      ...products.value[idx],
      stockQuantity: newQuantity,
      inStock: newQuantity > 0,
    };
    persist();
    return newQuantity;
  };

  // ─── Инициализация (только клиент, только один раз) ───────
  if (import.meta.client && !isInitialized) {
    isInitialized = true;

    // ⚠️ Здесь БЫЛ синхронный вызов loadProducts() при пустом каталоге.
    // Он запускал fetch ещё в фазе middleware (до монтирования): пока
    // vue-router догружал chunk страницы (macrotask), ответ с localhost
    // успевал заполнить catalog-products, гидратация рендерила таблицу
    // вместо SSR-пустого состояния — hydration mismatch повреждал DOM
    // (гонка, проявлялась через раз). Загрузку каталога выполняет
    // initializeApp из auth-init.global.ts — сразу ПОСЛЕ гидратации
    // (и onMounted админ-страниц — для SPA-переходов).

    // Флаги isFavorite на товарах синхронизируем РЕАКТИВНО от избранного.
    // Раньше здесь был разовый forEach из синхронного localStorage-загруза
    // useFavorites (load() при создании инстанса выше). Теперь useFavorites
    // подгружает сохранённое ПОСЛЕ гидратации (см. комментарий там —
    // синхронный загруз до первого кадра давал hydration mismatch), поэтому
    // вотч переносит флаги в момент приезда избранного и при каждом
    // изменении (добавление/удаление/синхронизация между вкладками).
    // Мутируем на месте: замена массива оставила бы уже отрендеренные
    // карточки со ссылками на устаревшие объекты.
    favoriteFlagsScope = effectScope(true);
    favoriteFlagsScope.run(() => {
      watch(
        favorites.favoriteIds,
        () => {
          products.value.forEach((product) => {
            product.isFavorite = favorites.isFavorite(product.id);
          });
        },
        { immediate: true },
      );
    });
  }

  // ─── Публичный API ────────────────────────────────────────
  return {
    products: computed(() => products.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),

    categories: computed(() => {
      const current = products.value;
      const key = current.map((p) => p.id).join(',');
      if (key === lastProductsForCategories) return cachedCategories;
      lastProductsForCategories = key;
      const all = current.flatMap((p) => p.categories || []);
      cachedCategories = [...new Set(all)].sort((a, b) => a.localeCompare(b));
      return cachedCategories;
    }),

    // Реактивно без триггеров: isFavorite читает computed из useFavorites
    favoriteProducts: computed(() => products.value.filter((p) => favorites.isFavorite(p.id))),

    isFavorite: (productId: string | number) => favorites.isFavorite(productId),
    favoritesCount: computed(() => favorites.favoritesCount.value),

    loadProducts,
    ensureFullProducts,
    catalogFull: computed(() => catalogFull.value),
    updateProduct,
    createProduct,
    deleteProduct,
    bulkUpdateProducts,
    bulkDeleteProducts,
    getProductBySlug,
    getProductById,

    getProductsByCategory,
    searchProducts,
    filterProducts,
    sortProducts,
    toggleFavorite,
    updateProductQuantity,
    decreaseProductQuantity,
  };
}
