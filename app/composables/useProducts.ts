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
// ============================================

import { ref, computed, watch, effectScope, type EffectScope } from 'vue';

/** Товар каталога на клиенте: серверный Product + рейтинг отзывов + флаг избранного.
 *  type-alias (не interface): нужен неявный index signature для передачи в
 *  localizedProduct/buildCategoryLabelMap (T extends Record<string, unknown>). */
export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  gallery?: Array<string | null | undefined>;
  categories?: string[];
  inStock: boolean;
  stockQuantity: number;
  characteristics?: Record<string, string>;
  variants?: Array<{
    id: string | number;
    name?: string | null;
    nameEn?: string | null;
    nameEs?: string | null;
    price?: number | null;
    inStock?: boolean | null;
    stockQuantity?: number | null;
  }>;
  variantName?: string | null;
  variantNameEn?: string | null;
  variantNameEs?: string | null;
  // Локализованные поля (nameEn/…/categoriesEs) — см. productHelpers
  nameEn?: string | null;
  nameEs?: string | null;
  descriptionEn?: string | null;
  descriptionEs?: string | null;
  categoriesEn?: string[] | null;
  categoriesEs?: string[] | null;
  rating?: { count: number; average: number } | null;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
  // Legacy-поле из старых схем данных (toggleFavorite читает на всякий случай)
  _id?: string | number | null;
};

/** Фильтры каталога для filterProducts */
export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  search?: string;
}

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
  const loading = ref(false);
  const error = ref<string | null>(null);

  const favorites = useFavorites();

  let cachedCategories: string[] = [];
  let lastProductsForCategories = '';

  // ─── Утилиты ──────────────────────────────────────────────

  const fixImageUrl = (url?: string | null): string => {
    if (!url || url === 'null' || url === 'undefined') return '/images/placeholder.jpg';
    if (url.startsWith('data:')) return url;
    if (url.startsWith('photo-') || url.match(/^photo-[a-zA-Z0-9-]+/))
      return `https://images.unsplash.com/${url}`;
    if (url.includes('unsplash.com')) return url;
    if (url.startsWith('images/') || url.startsWith('products/')) return `/${url}`;
    if (url.includes('.') && !url.includes('/')) return `/images/${url}`;
    if (url.startsWith('/')) return url;
    if (url.startsWith('http')) return url;
    return '/images/placeholder.jpg';
  };

  const fixProductImages = <
    T extends { image?: string | null; gallery?: Array<string | null | undefined> | null },
  >(
    product?: T | null,
  ): T | null => {
    if (!product) return product;
    const fixed = { ...product };
    if (fixed.image) fixed.image = fixImageUrl(fixed.image);
    if (Array.isArray(fixed.gallery)) {
      fixed.gallery = fixed.gallery
        .map((img) => fixImageUrl(img))
        .filter((img) => img && img !== '/images/placeholder.jpg');
    }
    return fixed;
  };

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

  // Человекочитаемое сообщение из ошибки $fetch (h3 кладёт тело в error.data)
  const errorMessage = (err?: unknown): string => {
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

  const updateProductStockStatus = <T extends { stockQuantity?: number | null }>(
    product: T,
  ): T & { inStock: boolean } => ({
    ...product,
    inStock: (product.stockQuantity ?? 0) > 0,
  });

  const cleanProductsForStorage = (list: CatalogProduct[]): CatalogProduct[] => {
    if (!Array.isArray(list)) return [];
    return list.map((product) => {
      const cleaned = { ...product };
      if (cleaned.image?.startsWith('data:') && cleaned.image.length > 100000) {
        cleaned.image = '/images/placeholder.jpg';
      }
      if (Array.isArray(cleaned.gallery)) {
        cleaned.gallery = cleaned.gallery
          .map((img) =>
            img?.startsWith('data:') && img.length > 100000 ? '/images/placeholder.jpg' : img,
          )
          .filter((img): img is string => Boolean(img));
      }
      return cleaned;
    });
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

  const loadProducts = async (force = false): Promise<CatalogProduct[]> => {
    if (products.value.length > 0 && !force) return products.value;
    // Уже грузится другим вызовом — возвращаем тот же промис
    if (!force && productsInFlight) return productsInFlight;

    loading.value = true;
    error.value = null;

    const request = (async (): Promise<CatalogProduct[]> => {
      try {
        const response = await $fetch<CatalogProduct[] | { products?: CatalogProduct[] }>(
          '/api/products',
        );
        const list = Array.isArray(response) ? response : response?.products || [];

        products.value = list.map((product) =>
          updateProductStockStatus(
            fixProductImages({
              ...product,
              isFavorite: favorites.isFavorite(product.id),
            }) as CatalogProduct,
          ),
        );
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

  // ─── CRUD ─────────────────────────────────────────────────

  const toggleFavorite = async (
    productOrId?: CatalogProduct | string | number | null,
  ): Promise<boolean> => {
    try {
      const isObject = !!productOrId && typeof productOrId === 'object';
      const id = isObject ? productOrId.id || productOrId._id : productOrId;

      if (!id) {
        console.warn('[useProducts] toggleFavorite: не передан ID или объект');
        return false;
      }

      const idx = products.value.findIndex((p) => String(p.id) === String(id));
      const product = idx !== -1 ? products.value[idx] : isObject ? productOrId : null;

      if (!product) {
        console.warn('[useProducts] toggleFavorite: товар не найден по ID', id);
        return false;
      }

      favorites.toggleFavorite(product);

      if (idx !== -1) {
        products.value[idx] = {
          ...products.value[idx],
          isFavorite: favorites.isFavorite(id),
        };
        persist();
      }

      return true;
    } catch (err) {
      console.error('[useProducts] Ошибка переключения избранного:', err);
      showNotification('error', 'Ошибка при обновлении избранного');
      return false;
    }
  };

  const updateProduct = async (
    productId: string | number,
    updatedData: Record<string, unknown> & { stockQuantity?: number },
  ): Promise<CatalogProduct> => {
    loading.value = true;
    error.value = null;

    try {
      const finalData = { ...updatedData, inStock: (updatedData.stockQuantity ?? 0) > 0 };
      const response = await $fetch<{
        success: boolean;
        product?: CatalogProduct;
        message?: string;
      }>(`/api/products/${productId}`, {
        method: 'PUT',
        body: finalData,
      });

      if (!response.success || !response.product) {
        throw new Error(response.message || 'Сервер не подтвердил обновление');
      }

      const index = products.value.findIndex((p) => String(p.id) === String(productId));
      const wasFavorite = favorites.isFavorite(productId);

      const base = (index !== -1 ? products.value[index] : {}) as CatalogProduct;
      const merged = updateProductStockStatus(
        fixProductImages({
          ...base,
          ...response.product,
          isFavorite: wasFavorite,
        }) as CatalogProduct,
      );

      if (index !== -1) {
        products.value[index] = merged;
      } else {
        products.value.push(merged);
      }
      persist();
      return merged;
    } catch (err) {
      console.error('[useProducts] Ошибка обновления товара:', err);
      error.value = errorMessage(err);
      showNotification('error', `Ошибка обновления товара: ${errorMessage(err)}`);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createProduct = async (
    productData: Record<string, unknown> & { stockQuantity?: number },
  ): Promise<CatalogProduct> => {
    loading.value = true;
    error.value = null;

    try {
      const finalData = { ...productData, inStock: (productData.stockQuantity ?? 0) > 0 };
      const response = await $fetch<{
        success: boolean;
        product?: CatalogProduct;
        message?: string;
      }>('/api/products', { method: 'POST', body: finalData });

      if (!response.success || !response.product) {
        throw new Error(response.message || 'Сервер не подтвердил создание');
      }

      const newProduct = updateProductStockStatus(
        fixProductImages({ ...response.product, isFavorite: false }) as CatalogProduct,
      );
      products.value = [newProduct, ...products.value];
      persist();
      return newProduct;
    } catch (err) {
      console.error('[useProducts] Ошибка создания товара:', err);
      error.value = errorMessage(err);
      showNotification('error', `Ошибка создания товара: ${errorMessage(err)}`);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteProduct = async (productId: string | number): Promise<boolean> => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{ success: boolean; message?: string }>(
        `/api/products/${productId}`,
        { method: 'DELETE' },
      );
      if (!response.success) throw new Error(response.message || 'Ошибка при удалении товара');

      const idx = products.value.findIndex((p) => String(p.id) === String(productId));
      if (idx === -1) return false;
      const name = products.value[idx].name;
      products.value.splice(idx, 1);
      persist();
      if (favorites.isFavorite(productId)) favorites.removeFromFavorites(productId);
      showNotification('success', `Товар "${name}" удален`);
      return true;
    } catch (err) {
      console.error('[useProducts] Ошибка удаления товара:', err);
      error.value = errorMessage(err);
      // 401 — сессия истекла (например, после рестарта dev-сервера)
      showNotification('error', `Ошибка удаления товара: ${errorMessage(err)}`);
      return false;
    } finally {
      loading.value = false;
    }
  };

  // ─── Массовые операции ────────────────────────────────────

  // Один PATCH на весь выбор: сервер применяет патч атомарно (одно
  // чтение и одна запись KV) и возвращает только реально изменённые
  // товары — мерджим их в стейт, сохраняя isFavorite этого устройства.
  const bulkUpdateProducts = async (
    ids: Array<string | number>,
    patch: Record<string, unknown>,
  ) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{
        success: boolean;
        products?: CatalogProduct[];
        message?: string;
      }>('/api/products/bulk', {
        method: 'PATCH',
        body: { ids, ...patch },
      });
      if (!response.success) {
        throw new Error(response.message || 'Сервер не подтвердил обновление');
      }

      const byId = new Map((response.products || []).map((p) => [String(p.id), p]));
      products.value = products.value.map((p) => {
        const upd = byId.get(String(p.id));
        if (!upd) return p;
        return updateProductStockStatus(
          fixProductImages({ ...upd, isFavorite: favorites.isFavorite(p.id) }) as CatalogProduct,
        );
      });
      persist();
      return response;
    } catch (err) {
      console.error('[useProducts] Ошибка массового обновления товаров:', err);
      error.value = errorMessage(err);
      showNotification('error', `Массовое обновление: ${errorMessage(err)}`);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // DELETE с телом { ids } — h3 readBody читает тело и из DELETE.
  // Удалённые id приходят в deletedIds — вычищаем стейт и избранное.
  const bulkDeleteProducts = async (ids: Array<string | number>) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{
        success: boolean;
        deletedIds?: Array<string | number>;
        message?: string;
      }>('/api/products/bulk', {
        method: 'DELETE',
        body: { ids },
      });
      if (!response.success) {
        throw new Error(response.message || 'Сервер не подтвердил удаление');
      }

      const gone = new Set((response.deletedIds || []).map(String));
      products.value = products.value.filter((p) => !gone.has(String(p.id)));
      gone.forEach((id) => {
        if (favorites.isFavorite(id)) favorites.removeFromFavorites(id);
      });
      persist();
      return response;
    } catch (err) {
      console.error('[useProducts] Ошибка массового удаления товаров:', err);
      error.value = errorMessage(err);
      showNotification('error', `Массовое удаление: ${errorMessage(err)}`);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // ─── Поиск ────────────────────────────────────────────────

  const getProductBySlug = async (slug: string): Promise<CatalogProduct | null> => {
    try {
      const local = products.value.find((p) => p.slug === slug || String(p.id) === String(slug));
      if (local) return local;

      if (!loading.value) {
        await loadProducts(true);
        const refreshed = products.value.find(
          (p) => p.slug === slug || String(p.id) === String(slug),
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

  const getProductsByCategory = (category?: string | null): CatalogProduct[] => {
    if (!category) return products.value;
    return products.value.filter((p) => p.categories?.includes(category));
  };

  const searchProducts = (query?: string | null): CatalogProduct[] => {
    if (!query) return products.value;
    const term = query.toLowerCase();
    return products.value.filter(
      (p) =>
        p.name?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term) ||
        p.categories?.some((c) => c.toLowerCase().includes(term)),
    );
  };

  const filterProducts = (filters: ProductFilters): CatalogProduct[] => {
    let filtered = products.value;
    if (filters.category)
      filtered = filtered.filter((p) => p.categories?.includes(filters.category));
    if (filters.minPrice !== undefined)
      filtered = filtered.filter((p) => p.price >= (filters.minPrice ?? 0));
    if (filters.maxPrice !== undefined)
      filtered = filtered.filter((p) => p.price <= (filters.maxPrice ?? Infinity));
    if (filters.inStock !== undefined)
      filtered = filtered.filter((p) => p.inStock === filters.inStock);
    if (filters.search) {
      const term = filters.search.toLowerCase();
      filtered = filtered.filter(
        (p) => p.name?.toLowerCase().includes(term) || p.description?.toLowerCase().includes(term),
      );
    }
    return filtered;
  };

  const sortProducts = (
    list: CatalogProduct[],
    sortBy?: { field?: string; direction?: 'asc' | 'desc' },
  ): CatalogProduct[] => {
    if (!sortBy?.field) return list;
    const { field, direction = 'asc' } = sortBy;
    const mult = direction === 'desc' ? -1 : 1;
    return [...list].sort((a, b) => {
      switch (field) {
        case 'name':
          return mult * a.name.localeCompare(b.name);
        case 'price':
          return mult * (a.price - b.price);
        case 'date':
          return mult * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        default:
          return 0;
      }
    });
  };

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
