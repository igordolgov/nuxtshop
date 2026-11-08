// app/composables/useFilters.ts
import { ref, computed, type Ref } from 'vue';
import { localizedProduct, storeLocaleFromPath } from '../utils/localizedProduct';
// Фолбэк локали (путь без префикса) — дефолт из store.config: кубинская
// копия с дефолтом 'es' должна локализовать каталог, а не откатываться на 'ru'
import { STORE_DEFAULT_LOCALE } from '../../store.config';
import type { CatalogProduct } from './catalogProduct';
// Фасетные фильтры по характеристикам (паттерн маркетплейсов): чистые
// функции в utils — здесь только стейт и проводка в displayedProducts
import { buildSpecFacets, filterBySpecSelection } from '../utils/specFacets';
import type { SpecFacetGroup, SpecSelection } from '../utils/specFacets';
// Сортировка каталога — чистая функция в utils (тестируется в node):
// раньше при отсутствии даты компаратор подставлял id как дату
// (new Date('33') → 2033 год, '27'…'30' → Invalid Date) — из-за NaN
// новый товар оказывался в конце списка при «сначала новые»
import { sortProductsByConfig } from '../utils/catalogSort';

/** Локализованная копия товара (localizedProduct добавляет categoriesRaw) */
export type LocalizedCatalogProduct = CatalogProduct & { categoriesRaw?: string[] };

/** Конфиг сортировки каталога */
export interface CatalogSortConfig {
  field?: string;
  order?: string;
}

/** Состояние фильтров каталога */
export interface CatalogFiltersState {
  categories: string[];
  onlyInStock: boolean;
  onlyFavorites: boolean;
  priceRange: { min: number | null; max: number | null };
  /** Фасеты характеристик: лейбл → отмеченные значения (сырые тексты витрины) */
  specs: SpecSelection;
}

export const useFilters = (products: Ref<CatalogProduct[]>) => {
  // Локаль витрины — из пути маршрута (см. useStoreLocale): доступна и в
  // middleware (клиентский singleton создаётся там), и в setup; вне Nuxt
  // (юнит-тесты на node) — 'ru'.
  let route: ReturnType<typeof useRoute> | null = null;
  try {
    route = useRoute();
  } catch {
    route = null;
  }
  const getInitialSort = (): { field: string; order: string } => {
    if (import.meta.client) {
      try {
        const savedSort = localStorage.getItem('productSort');
        if (savedSort) {
          const parsed = JSON.parse(savedSort);
          if (parsed?.field && parsed.order) {
            // Гидратация: сервер не видит localStorage и рендерит каталог
            // с дефолтной сортировкой — первый кадр обязан совпасть с ним,
            // иначе Vue засыпает hydration-варнингами (порядок карточек).
            // Сохранённую сортировку применяем сразу после монтирования —
            // список пересортируется реактивно, без рассинхрона.
            if (useNuxtApp().isHydrating) {
              onNuxtReady(() => {
                sort.value = parsed;
              });
              return { field: 'createdAt', order: 'desc' };
            }
            return parsed;
          }
        }
      } catch {
        // ignore
      }
    }
    return { field: 'createdAt', order: 'desc' };
  };

  const searchQuery = ref('');
  const filters = ref<CatalogFiltersState>({
    categories: [],
    onlyInStock: false,
    onlyFavorites: false,
    priceRange: { min: null, max: null },
    specs: {},
  });
  const sort = ref(getInitialSort());

  const sortProducts = <T extends CatalogProduct>(
    list: T[],
    config?: CatalogSortConfig | null,
  ): T[] => sortProductsByConfig(list, config);

  // ─── Базовая выборка: всё, КРОМЕ фасетов характеристик ────────────────
  // На ней считаются счётчики фасетов (паттерн маркетплейсов: выбор в одной
  // характеристике не обнуляет счётчики других) и из неё же displayedProducts.
  const scopeProducts = computed<LocalizedCatalogProduct[]>(() => {
    const productsValue = products.value;
    if (!productsValue?.length) return [];

    // Локализованные КОПИИ товаров (ru — без копий, см. localizedProduct):
    // фильтр поиска, сортировка по имени и выдача карточек работают на
    // языке страницы. Категорийные фильтры матчят СЫРЫЕ значения
    // (categoriesRaw) — сами значения фильтров локали не зависят.
    // storeLocaleFromPath знает все три префикса (/en, /es, /ru): на копии
    // с дефолтом 'es' русская витрина живёт под /ru — прежняя /^\/(en|es)/
    // её не видела и отдавала испанский каталог на русской локали
    const locale = storeLocaleFromPath(route?.path, STORE_DEFAULT_LOCALE);
    let filtered = productsValue.map((p) => localizedProduct(p, locale) as LocalizedCatalogProduct);

    const query = searchQuery.value?.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(
        (p) =>
          p.name?.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query) ||
          p.categories?.some((cat) => cat?.toLowerCase().includes(query)) ||
          p.categoriesRaw?.some((cat) => cat?.toLowerCase().includes(query)),
      );
    }

    const selectedCategories = filters.value.categories;
    if (selectedCategories?.length > 0) {
      filtered = filtered.filter((p) =>
        (p.categoriesRaw ?? p.categories)?.some((cat) => selectedCategories.includes(cat)),
      );
    }

    if (filters.value.onlyInStock) filtered = filtered.filter((p) => p.inStock);
    if (filters.value.onlyFavorites) filtered = filtered.filter((p) => p.isFavorite);

    const min = filters.value.priceRange?.min;
    const max = filters.value.priceRange?.max;
    if (min !== null && min !== undefined) filtered = filtered.filter((p) => p.price >= min);
    if (max !== null && max !== undefined) filtered = filtered.filter((p) => p.price <= max);

    return filtered;
  });

  // Фасеты характеристик по базовой выборке (с учётом чужого spec-выбора,
  // без собственного — счётчики выбранного не обнуляются)
  const specFacets = computed<SpecFacetGroup[]>(() =>
    buildSpecFacets(scopeProducts.value, filters.value.specs ?? {}),
  );

  const displayedProducts = computed<LocalizedCatalogProduct[]>(() =>
    sortProducts(filterBySpecSelection(scopeProducts.value, filters.value.specs ?? {}), sort.value),
  );

  const actualPriceRange = computed(() => {
    const productsValue = products.value;
    if (!productsValue?.length) return { min: 0, max: 1000 };
    const prices = productsValue.map((p) => p.price).filter((p) => !isNaN(p));
    if (!prices.length) return { min: 0, max: 1000 };
    return { min: Math.min(...prices), max: Math.max(...prices) };
  });

  const handleSearchUpdate = (value: string): void => {
    searchQuery.value = value;
  };

  const handleFiltersUpdate = (newFilters: Partial<CatalogFiltersState>): void => {
    filters.value = { ...filters.value, ...newFilters };
  };

  const handleSortUpdate = (newSort?: CatalogSortConfig | null): void => {
    if (!newSort?.field) return;
    sort.value = { ...sort.value, ...newSort, field: newSort.field };
    if (import.meta.client) {
      try {
        localStorage.setItem('productSort', JSON.stringify(sort.value));
      } catch {
        // ignore
      }
    }
  };

  const resetCatalogFilters = (): void => {
    filters.value = {
      categories: [],
      onlyInStock: false,
      onlyFavorites: false,
      priceRange: { min: null, max: null },
      specs: {},
    };
  };

  const resetFilters = (): void => {
    resetCatalogFilters();
    searchQuery.value = '';
  };

  const resetAll = (): void => {
    resetFilters();
    sort.value = { field: 'createdAt', order: 'desc' };
    if (import.meta.client) {
      localStorage.setItem('productSort', JSON.stringify(sort.value));
    }
  };

  return {
    searchQuery: computed(() => searchQuery.value),
    filters: computed(() => filters.value),
    sort: computed(() => sort.value),
    displayedProducts,
    scopeProducts,
    specFacets,
    actualPriceRange,
    handleSearchUpdate,
    handleFiltersUpdate,
    handleSortUpdate,
    resetFilters,
    resetCatalogFilters,
    resetAll,
  };
};
