// app/composables/useAppState.js
/**
 * Централизованный стейт приложения.
 *
 * ВАЖНО: на сервере (SSR) каждый запрос получает свежий инстанс — никакого
 * шаринга между пользователями. На клиенте — singleton, чтобы все компоненты
 * видели одни и те же данные.
 */
import { useProducts } from './useProducts'
import { useFilters } from './useFilters'
import { useNotifications } from './useNotifications'
import { useAuth } from './useAuth'
import { computed, watch, reactive } from 'vue'

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
  const { $notify } = useNuxtApp()

  // ─── Модули ──────────────────────────────────────────────
  const notifications = useNotifications()
  const products = useProducts(notifications)
  const filters = useFilters(products.products)
  const auth = useAuth()

  // ─── Избранное ───────────────────────────────────────────
  const favoritesState = reactive({
    items: [],
    products: [],
    loading: false,
  })

  function persistFavorites() {
    if (!import.meta.client) return
    localStorage.setItem('favoriteProducts', JSON.stringify(favoritesState.products))
    localStorage.setItem('userFavorites', JSON.stringify(favoritesState.items))
  }

  function updateProductsFavoritesState() {
    if (products.products.value.length > 0) {
      products.products.value = products.products.value.map((product) => ({
        ...product,
        isFavorite: isFavorite(product.id || product._id),
      }))
    }
  }

  async function loadFavorites() {
    if (!import.meta.client) return
    try {
      favoritesState.loading = true
      const saved = localStorage.getItem('favoriteProducts')
      if (saved) {
        favoritesState.products = JSON.parse(saved)
        favoritesState.items = favoritesState.products.map((p) => p.id)
      }
    } catch (error) {
      console.error('Ошибка загрузки избранного:', error)
    } finally {
      favoritesState.loading = false
    }
  }

  async function addToFavorites(product) {
    if (!auth.isAuthenticated.value) {
      $notify.warning('Войдите в систему чтобы добавить в избранное')
      return navigateTo('/auth/login')
    }

    try {
      const productId = product.id || product._id

      if (!favoritesState.items.includes(productId)) {
        favoritesState.items.push(productId)

        favoritesState.products.push({
          id: productId,
          _id: product._id || productId,
          name: product.name,
          price: product.currentPrice || product.price,
          currentPrice: product.currentPrice || product.price,
          image: product.image || product.mainImage,
          mainImage: product.mainImage || product.image,
          category: product.category,
          categorySlug:
            product.categorySlug ||
            product.category?.slug ||
            product.category?.name?.toLowerCase().replace(/\s+/g, '-'),
          slug: product.slug,
          brand: product.brand,
          description: product.description,
        })

        persistFavorites()
        updateProductsFavoritesState()
        window.dispatchEvent(new CustomEvent('favorites-updated'))
      }
      return true
    } catch (error) {
      console.error('Ошибка добавления в избранное:', error)
      $notify.error('Ошибка добавления в избранное')
      return false
    }
  }

  async function removeFromFavorites(productId) {
    try {
      favoritesState.items = favoritesState.items.filter((id) => id !== productId)
      favoritesState.products = favoritesState.products.filter(
        (p) => p.id !== productId && p._id !== productId
      )

      persistFavorites()
      updateProductsFavoritesState()
      window.dispatchEvent(new CustomEvent('favorites-updated'))
      return true
    } catch (error) {
      console.error('Ошибка удаления из избранного:', error)
      $notify.error('Ошибка удаления из избранного')
      return false
    }
  }

  function isFavorite(productId) {
    return favoritesState.items.includes(productId)
  }

  async function toggleFavorite(productOrId) {
    const isObject = productOrId && typeof productOrId === 'object'
    const id = isObject ? (productOrId.id || productOrId._id) : productOrId

    if (!id) return

    if (favorites.isFavorite(id)) {
      favorites.removeFromFavorites(id)
      return
    }

    if (!isObject) {
      console.warn('[useAppState] toggleFavorite: для добавления нужен объект товара')
      return
    }

    return addToFavorites(productOrId)
  }

  function clearAllFavorites() {
    favoritesState.items = []
    favoritesState.products = []
    if (import.meta.client) {
      localStorage.removeItem('favoriteProducts')
      localStorage.removeItem('userFavorites')
    }
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
        activeSuggestionIndex.value = Math.max(activeSuggestionIndex.value - 1, -1)
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

  // ─── Auth ────────────────────────────────────────────────
  async function logout() {
    try {
      await $fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })

      if (auth.updateAuthState) {
        auth.updateAuthState(null)
      } else {
        auth.user.value = null
      }
      clearAllFavorites()

      if (import.meta.client) {
        localStorage.removeItem('user')
        sessionStorage.removeItem('user')
        localStorage.removeItem('auth-token')
        localStorage.removeItem('userFavorites')

        document.cookie.split(';').forEach((cookie) => {
          const eqPos = cookie.indexOf('=')
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
          const domain =
            location.hostname === 'localhost'
              ? ''
              : '; domain=.' + location.hostname.split('.').slice(-2).join('.')
          document.cookie =
            name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/' + domain
        })
      }

      return { success: true }
    } catch (error) {
      console.error('❌ Ошибка выхода:', error)
      if (auth.updateAuthState) {
        auth.updateAuthState(null)
      } else {
        auth.user.value = null
      }
      clearAllFavorites()
      return { success: false, error: error.message }
    }
  }

  function forceClearAuthState() {
    if (auth.updateAuthState) {
      auth.updateAuthState(null)
    } else {
      auth.user.value = null
    }
    clearAllFavorites()

    if (import.meta.client) {
      localStorage.removeItem('user')
      localStorage.removeItem('userFavorites')
      sessionStorage.removeItem('user')
    }
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

  watch(
    () => auth.isAuthenticated.value,
    (isAuthenticated) => {
      if (isAuthenticated) {
        loadFavorites()
      } else {
        clearAllFavorites()
      }
    }
  )

  if (import.meta.client) {
    window.addEventListener('storage', (e) => {
      if (e.key === 'userFavorites' && e.newValue) {
        try {
          favoritesState.items = JSON.parse(e.newValue)
          loadFavorites()
          updateProductsFavoritesState()
        } catch (error) {
          console.error('Ошибка синхронизации избранного:', error)
        }
      }
    })
  }

  // ─── Инициализация ───────────────────────────────────────
  async function initializeApp() {
    try {
      if (import.meta.client && products.products.value.length === 0) {
        await products.loadProducts()
      }

      await auth.checkAuth()
      await loadFavorites()
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
    clearAllFavorites()
  }

  // ─── Публичный API ───────────────────────────────────────
  return {
    ...products,
    ...filters,
    ...notifications,
    ...auth,

    favorites: {
      items: computed(() => favoritesState.items),
      products: computed(() => favoritesState.products),
      loading: computed(() => favoritesState.loading),
      favoritesCount: computed(() => favoritesState.products.length),

      loadFavorites,
      addToFavorites,
      removeFromFavorites,
      isFavorite,
      toggleFavorite,
      clearAllFavorites,
    },

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