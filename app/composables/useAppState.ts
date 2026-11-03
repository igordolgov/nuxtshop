// app/composables/useAppState.ts
// ============================================
// Composable: useAppState
// Централизованный стейт приложения.
//
// На сервере (SSR) каждый запрос получает свежий инстанс — никакого
// шаринга между пользователями. На клиенте — singleton.
//
// Избранное: единственный источник правды — useFavorites.
// Здесь только делегация под старым API (favorites.*) для совместимости.
// ============================================

import { useProducts, type CatalogProduct } from './useProducts';
import {
  useFilters,
  type LocalizedCatalogProduct,
  type CatalogFiltersState,
  type CatalogSortConfig,
} from './useFilters';
import { useAuth } from './useAuth';
import { useFavorites } from './useFavorites';
import { localizedProduct } from '../utils/localizedProduct';
import { computed, watch } from 'vue';

/** Товар в результатах поиска: локализованная копия + подсветка совпадений */
export type SearchItem = LocalizedCatalogProduct & {
  highlights: Record<string, string>;
  // Legacy-поле, которое читает selectSuggestion у некоторых источников
  title?: string | null;
};

let globalState: ReturnType<typeof createAppState> | null = null;

export const useAppState = () => {
  // SSR: не шарим стейт между запросами
  if (import.meta.server) {
    return createAppState();
  }

  if (globalState) return globalState;
  globalState = createAppState();
  return globalState;
};

function createAppState() {
  // ─── Модули ──────────────────────────────────────────────
  const products = useProducts();
  const filters = useFilters(products.products);
  const auth = useAuth();
  const favorites = useFavorites();

  // Локаль для поиска (searchInItems) — из пути маршрута (см. useStoreLocale):
  // доступна в middleware, где создаётся клиентский singleton. Вне Nuxt (тесты) — 'ru'.
  let searchRoute: ReturnType<typeof useRoute> | null = null;
  try {
    searchRoute = useRoute();
  } catch {
    searchRoute = null;
  }

  // ─── Избранное: делегация в useFavorites ─────────────────
  // Сохранён старый API (favorites.items / .products / .loadFavorites ...),
  // чтобы не ломать компоненты, которые уже его используют.
  const favoritesApi = {
    items: favorites.favoriteIds,
    products: favorites.favoriteProducts,
    loading: computed(() => false),
    favoritesCount: favorites.favoritesCount,

    loadFavorites: async () => favorites.favoriteProducts.value,
    addToFavorites: favorites.addToFavorites,
    removeFromFavorites: favorites.removeFromFavorites,
    isFavorite: favorites.isFavorite,
    toggleFavorite: favorites.toggleFavorite,
    clearAllFavorites: favorites.clearAllFavorites,
  };

  // ─── Поиск ───────────────────────────────────────────────
  const searchQuery = useState('searchQuery', () => '');
  const isSearching = useState('isSearching', () => false);
  const showSuggestions = useState('showSuggestions', () => false);
  const searchResults = useState<SearchItem[]>('searchResults', () => []);
  const suggestionItems = useState<SearchItem[]>('suggestionItems', () => []);
  const activeSuggestionIndex = useState('activeSuggestionIndex', () => -1);

  const hasSuggestions = computed(() => suggestionItems.value.length > 0);
  const totalResults = computed(() => searchResults.value.length);

  function getNestedValue(obj: unknown, path: string): unknown {
    return path
      .split('.')
      .reduce<unknown>(
        (cur, key) =>
          cur && typeof cur === 'object' && (cur as Record<string, unknown>)[key] !== undefined
            ? (cur as Record<string, unknown>)[key]
            : undefined,
        obj,
      );
  }

  function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightText(text: string, query: string): string {
    if (!query) return text;
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
  }

  function generateHighlights(
    item: LocalizedCatalogProduct,
    query: string,
    fields: string[],
  ): Record<string, string> {
    const highlights: Record<string, string> = {};
    fields.forEach((field) => {
      const value = getNestedValue(item, field);
      if (value) highlights[field] = highlightText(String(value), query);
    });
    return highlights;
  }

  function searchInItems(query: string, items: CatalogProduct[]): SearchItem[] {
    const normalized = query.toLowerCase().trim();
    // Поиск ведётся по локализованным КОПИЯМ: подсказки в шапке и подсветка
    // находят товар и по переводу («smartphone» на /en), и по русскому
    // оригиналу. ru-каталог проходит без копий (см. localizedProduct).
    const localeMatch = /^\/(en|es)(\/|$)/.exec(searchRoute?.path ?? '');
    const locale = localeMatch ? localeMatch[1] : 'ru';
    const localizedItems = items.map(
      (item) => localizedProduct(item, locale) as LocalizedCatalogProduct,
    );
    const fields = ['name', 'description', 'categories'];

    return localizedItems
      .filter((item) =>
        fields.some((field) => {
          const value = getNestedValue(item, field)?.toString().toLowerCase();
          return value?.includes(normalized);
        }),
      )
      .map((item) => ({
        ...item,
        highlights: generateHighlights(item, normalized, fields),
      }));
  }

  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  function performSearch(query: string): void {
    if (!query || query.length < 2) {
      searchResults.value = [];
      suggestionItems.value = [];
      isSearching.value = false;
      return;
    }

    isSearching.value = true;
    if (searchTimeout) clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {
      try {
        const results = searchInItems(query, products.products.value);
        searchResults.value = results;
        suggestionItems.value = results.slice(0, 5);
      } catch (error) {
        console.error('Search error:', error);
        searchResults.value = [];
        suggestionItems.value = [];
      } finally {
        isSearching.value = false;
      }
    }, 300);
  }

  function hideSuggestions(): void {
    showSuggestions.value = false;
    activeSuggestionIndex.value = -1;
  }

  function showSuggestionsPanel(): void {
    if (searchQuery.value.length >= 2) showSuggestions.value = true;
  }

  function selectSuggestion(suggestion: SearchItem): void {
    searchQuery.value = suggestion.name || suggestion.title || '';
    hideSuggestions();
    filters.handleSearchUpdate(searchQuery.value);
  }

  function resetSearch(): void {
    searchQuery.value = '';
    searchResults.value = [];
    suggestionItems.value = [];
    hideSuggestions();
    filters.handleSearchUpdate('');
  }

  function performSearchAction(): void {
    filters.handleSearchUpdate(searchQuery.value);
    hideSuggestions();
  }

  function showAllResults(): void {
    filters.handleSearchUpdate(searchQuery.value);
    hideSuggestions();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!showSuggestions.value) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        activeSuggestionIndex.value = Math.min(
          activeSuggestionIndex.value + 1,
          suggestionItems.value.length - 1,
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        activeSuggestionIndex.value = Math.max(activeSuggestionIndex.value - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (activeSuggestionIndex.value >= 0) {
          selectSuggestion(suggestionItems.value[activeSuggestionIndex.value]);
        } else {
          performSearchAction();
        }
        break;
      case 'Escape':
        hideSuggestions();
        break;
    }
  }

  function getHighlightedText(item: SearchItem, field: string): string {
    return item.highlights?.[field] || (getNestedValue(item, field) as string) || '';
  }

  function formatPrice(price: number): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(price);
  }

  // ─── Auth: делегация, без дублирования ────────────────────
  // Избранное — локальные данные устройства: при выходе НЕ очищаем.
  async function logout() {
    return auth.logout();
  }

  function forceClearAuthState(): void {
    auth.resetAuth();
  }

  // ─── Скролл ──────────────────────────────────────────────
  function scrollToProductsTop(): void {
    if (!import.meta.client) return;
    setTimeout(() => {
      const container = document.querySelector('.products-container');
      if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }, 100);
  }

  function handleFiltersUpdateWithScroll(newFilters: Partial<CatalogFiltersState>): void {
    filters.handleFiltersUpdate(newFilters);
    scrollToProductsTop();
  }

  function handleSortUpdateWithScroll(newSort: CatalogSortConfig): void {
    filters.handleSortUpdate(newSort);
    scrollToProductsTop();
  }

  // ─── Watchers ────────────────────────────────────────────
  watch(searchQuery, (newQuery) => {
    if (newQuery && newQuery.length >= 2) {
      performSearch(newQuery);
      showSuggestionsPanel();
    } else {
      searchResults.value = [];
      suggestionItems.value = [];
      hideSuggestions();
    }
  });

  watch(searchQuery, (newQuery) => {
    if (newQuery !== filters.searchQuery.value) {
      filters.handleSearchUpdate(newQuery);
    }
  });

  // ─── Инициализация ───────────────────────────────────────
  async function initializeApp(): Promise<void> {
    try {
      if (import.meta.client && products.products.value.length === 0) {
        await products.loadProducts();
      }

      await auth.checkAuth();
      filters.resetFilters();
    } catch (err) {
      // error из useProducts — computed без сеттера: присваивание ниже
      // сохранено как в оригинале (no-op c dev-варнингом Vue)
      (products.error as unknown as { value: string }).value = (err as Error).message;
      console.error('❌ Ошибка инициализации AppState:', err);
    }
  }

  function setSearchQuery(value: string): void {
    searchQuery.value = value;
    filters.handleSearchUpdate(value);
  }

  function resetAppState(): void {
    searchQuery.value = '';
    searchResults.value = [];
    suggestionItems.value = [];
    hideSuggestions();
    filters.resetFilters();
    forceClearAuthState();
  }

  // ─── Публичный API ───────────────────────────────────────
  return {
    // Флаг «инициализация уже выполнялась» — ставит auth-init.global.ts
    _initialized: false,

    ...products,
    ...filters,
    ...auth,

    favorites: favoritesApi,

    search: {
      query: searchQuery,
      isSearching,
      showSuggestions,
      suggestions: suggestionItems,
      results: searchResults,
      activeSuggestionIndex,

      hasSuggestions,
      totalResults,

      handleKeydown,
      selectSuggestion,
      showSuggestionsPanel,
      hideSuggestions,
      resetSearch,
      performSearch: performSearchAction,
      showAllResults,
      getHighlightedText,
      formatPrice,
    },

    initializeApp,
    logout,
    forceClearAuthState,
    scrollToProductsTop,
    handleFiltersUpdateWithScroll,
    handleSortUpdateWithScroll,

    getSearchQuery: () => filters.searchQuery.value,
    setSearchQuery,

    resetAppState,
  };
}
