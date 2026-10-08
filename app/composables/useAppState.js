// app/composables/useAppState.js
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

import { useProducts } from './useProducts'
import { useFilters } from './useFilters'
import { useAuth } from './useAuth'
import { useFavorites } from './useFavorites'
import { computed, watch } from 'vue'

let globalState = null

export const useAppState = () => {
  // SSR: не шарим стейт между запросами
  if (import.meta.server) {
    return createAppState()
  }

  if (globalState) return globalState
  globalState = createAppState()
  return globalState
}

function createAppState() {
  // ─── Модули ──────────────────────────────────────────────
  const products = useProducts()
  const filters = useFilters(products.products)
  const auth = useAuth()
  const favorites = useFavorites()

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
  }

  // ─── Поиск ───────────────────────────────────────────────
  const searchQuery = useState('searchQuery', () => '')
  const isSearching = useState('isSearching', () => false)
  const showSuggestions = useState('showSuggestions', () => false)
  const searchResults = useState('searchResults', () => [])
  const suggestionItems = useState('suggestionItems', () => [])
  const activeSuggestionIndex = useState('activeSuggestionIndex', () => -1)

  const hasSuggestions = computed(() => suggestionItems.value.length > 0)
  const totalResults = computed(() => searchResults.value.length)

  function getNestedValue(obj, path) {
    return path
      .split('.')
      .reduce((cur, key) => (cur && cur[key] !== undefined ? cur[key] : undefined), obj)
  }

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function highlightText(text, query) {
    if (!query) return text
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi')
    return text.replace(regex, '<span class="search-highlight">$1</span>')
  }

  function generateHighlights(item, query, fields) {
    const highlights = {}
    fields.forEach((field) => {
      const value = getNestedValue(item, field)
      if (value) highlights[field] = highlightText(value.toString(), query)
    })
    return highlights
  }

  function searchInItems(query, items) {
    const normalized = query.toLowerCase().trim()
    const fields = ['name', 'description', 'category', 'brand']

    return items
      .filter((item) =>
        fields.some((field) => {
          const value = getNestedValue(item, field)?.toString().toLowerCase()
          return value?.includes(normalized)
        })
      )
      .map((item) => ({
        ...item,
        highlights: generateHighlights(item, normalized, fields),
      }))
  }

  let searchTimeout = null

  function performSearch(query) {
    if (!query || query.length < 2) {
      searchResults.value = []
      suggestionItems.value = []
      isSearching.value = false
      return
    }

    isSearching.value = true
    if (searchTimeout) clearTimeout(searchTimeout)

    searchTimeout = setTimeout(() => {
      try {
        const results = searchInItems(query, products.products.value)
        searchResults.value = results
        suggestionItems.value = results.slice(0, 5)
      } catch (error) {
        console.error('Search error:', error)
        searchResults.value = []
        suggestionItems.value = []
      } finally {
        isSearching.value = false
      }
    }, 300)
  }

  function hideSuggestions() {
    showSuggestions.value = false
    activeSuggestionIndex.value = -1
  }

  function showSuggestionsPanel() {
    if (searchQuery.value.length >= 2) showSuggestions.value = true
  }

  function selectSuggestion(suggestion) {
    searchQuery.value = suggestion.name || suggestion.title
    hideSuggestions()
    filters.handleSearchUpdate(searchQuery.value)
  }

  function resetSearch() {
    searchQuery.value = ''
    searchResults.value = []
    suggestionItems.value = []
    hideSuggestions()
    filters.handleSearchUpdate('')
  }

  function performSearchAction() {
    filters.handleSearchUpdate(searchQuery.value)
    hideSuggestions()
  }

  function showAllResults() {
    filters.handleSearchUpdate(searchQuery.value)
    hideSuggestions()
  }

  function handleKeydown(event) {
    if (!showSuggestions.value) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        activeSuggestionIndex.value = Math.min(
          activeSuggestionIndex.value + 1,
          suggestionItems.value.length - 1
        )
        break
      case 'ArrowUp':
        event.preventDefault()
        activeSuggestionIndex.value = Math.max(
          activeSuggestionIndex.value - 1,
          -1
        )
        break
      case 'Enter':
        event.preventDefault()
        if (activeSuggestionIndex.value >= 0) {
          selectSuggestion(suggestionItems.value[activeSuggestionIndex.value])
        } else {
          performSearchAction()
        }
        break
      case 'Escape':
        hideSuggestions()
        break
    }
  }

  function getHighlightedText(item, field) {
    return item.highlights?.[field] || getNestedValue(item, field) || ''
  }

  function formatPrice(price) {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(price)
  }

  // ─── Auth: делегация, без дублирования ────────────────────
  // Избранное — локальные данные устройства: при выходе НЕ очищаем.
  async function logout() {
    return auth.logout()
  }

  function forceClearAuthState() {
    auth.resetAuth()
  }

  // ─── Скролл ──────────────────────────────────────────────
  function scrollToProductsTop() {
    if (!import.meta.client) return
    setTimeout(() => {
      const container = document.querySelector('.products-container')
      if (container) container.scrollTo({ top: 0, behavior: 'smooth' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }, 100)
  }

  function handleFiltersUpdateWithScroll(newFilters) {
    filters.handleFiltersUpdate(newFilters)
    scrollToProductsTop()
  }

  function handleSortUpdateWithScroll(newSort) {
    filters.handleSortUpdate(newSort)
    scrollToProductsTop()
  }

  // ─── Watchers ────────────────────────────────────────────
  watch(searchQuery, (newQuery) => {
    if (newQuery && newQuery.length >= 2) {
      performSearch(newQuery)
      showSuggestionsPanel()
    } else {
      searchResults.value = []
      suggestionItems.value = []
      hideSuggestions()
    }
  })

  watch(searchQuery, (newQuery) => {
    if (newQuery !== filters.searchQuery.value) {
      filters.handleSearchUpdate(newQuery)
    }
  })

  // ─── Инициализация ───────────────────────────────────────
  async function initializeApp() {
    try {
      if (import.meta.client && products.products.value.length === 0) {
        await products.loadProducts()
      }

      await auth.checkAuth()
      filters.resetFilters()
    } catch (err) {
      products.error.value = err.message
      console.error('❌ Ошибка инициализации AppState:', err)
    }
  }

  function setSearchQuery(value) {
    searchQuery.value = value
    filters.handleSearchUpdate(value)
  }

  function resetAppState() {
    searchQuery.value = ''
    searchResults.value = []
    suggestionItems.value = []
    hideSuggestions()
    filters.resetFilters()
    forceClearAuthState()
  }

  // ─── Публичный API ───────────────────────────────────────
  return {
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
  }
}