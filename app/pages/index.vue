<!-- app/pages/index.vue -->
<template lang="pug">
.grid-container(v-if="isMounted")
  Header.header-area(
    :activeFiltersCount="activeFiltersCount"
    :displayedProductsCount="displayedProducts.length"
    :totalProductsCount="totalProductsCount"
    :searchQuery="searchQuery"
    :isSearching="isSearching"
    :showSuggestions="showSuggestions"
    :searchSuggestions="searchSuggestions"
    :hasSearchSuggestions="hasSearchSuggestions"
    :activeSuggestionIndex="activeSuggestionIndex"
    :showFilters="showMobileFilters"
    v-on="headerEvents"
  )

  Transition(name="fade")
    LazyMobileFiltersPanel.mobile-filters(
      v-if="showMobileFilters"
      :searchQuery="searchQuery"
      :categories="categories"
      :filters="filters"
      :sort="sort"
      :priceRange="priceRange"
      :total-count="totalProductsCount"
      :filtered-count="displayedProducts.length"
      v-on="mobileFiltersEvents"
    )

  .main-content-wrapper
    .content-area
      LazyDesktopSidebar.sidebar-area(
        v-if="!isMobile"
        :searchQuery="searchQuery"
        :categories="categories"
        :filters="filters"
        :sort="sort"
        :priceRange="priceRange"
        :total-count="totalProductsCount"
        :filtered-count="displayedProducts.length"
        v-on="sidebarEvents"
      )

      .main-area(:class="mainAreaClasses")
        .products-container(ref="productsContainerRef")
          .scroll-sentinel
          ProductsSection(
            :products="displayedProducts"
            :isLoading="isLoading"
            :isMobile="isMobile"
            :isHorizontal="isHorizontal"
            :searchQuery="searchQuery"
            :activeFiltersCount="activeFiltersCount"
            useInfiniteScroll
            :pageSize="20"
            :maxRendered="100"
            @toggleFavorite="toggleFavorite"
            @addToCart="addToCart"
            @resetFilters="resetFilters"
            @refreshProducts="refreshProducts"
            @clearSearch="clearSearch"
          )

  MobileNavFooter(
    v-if="isMobile"
    :class="footerClasses"
    :isHorizontal="isHorizontal"
    :activeFiltersCount="activeFiltersCount"
    :activeTab="currentTab"
    v-on="footerEvents"
  )
</template>

<script setup>
import { useAppState } from '@/composables/useAppState'
import { useMobileDetection } from '@/composables/useMobileDetection'
import { useCart } from '@/composables/useCart'
import { nextTick, ref, computed, watch, onMounted, onUnmounted } from 'vue'

//- ============================================
//- Composables
//- ============================================
const route = useRoute()
const router = useRouter()
const { addToCart } = useCart()
const appState = useAppState()
const { isMobile } = useMobileDetection()

//- ============================================
//- Реактивные переменные
//- ============================================
const isMounted = ref(false)
const showMobileFilters = ref(false)
const productsContainerRef = ref(null)
const isHorizontal = ref(false)
const currentTab = ref('home')

//- ============================================
//- Чтение состояния (SSR-safe)
//- ============================================
// TODO: заменить на прямой доступ к appState.*, когда useAppState.js будет отрефакторен
const getState = (path, defaultValue = null) => {
  if (!import.meta.client) return defaultValue
  const keys = path.split('.')
  let result = appState
  for (const key of keys) {
    result = result?.[key]
    if (result === undefined) return defaultValue
  }
  return result?.value ?? defaultValue
}

const searchQuery = computed(() => getState('search.query', ''))
const isSearching = computed(() => getState('search.isSearching', false))
const showSuggestions = computed(() => getState('search.showSuggestions', false))
const searchSuggestions = computed(() => getState('search.suggestions', []))
const hasSearchSuggestions = computed(() => getState('search.hasSuggestions', false))
const activeSuggestionIndex = computed(() => getState('search.activeSuggestionIndex', -1))
const categories = computed(() => getState('categories', []))
const filters = computed(() => getState('filters', {}))
const sort = computed(() => {
  if (!import.meta.client) return { field: 'createdAt', order: 'desc' }
  const currentSort = getState('sort')
  return currentSort?.field ? currentSort : { field: 'createdAt', order: 'desc' }
})
const priceRange = computed(() => getState('actualPriceRange', {}))
const isLoading = computed(() => getState('loading', false))
const displayedProducts = computed(() => getState('displayedProducts', []))
const products = computed(() => getState('products', []))
const totalProductsCount = computed(() => products.value?.length ?? 0)

//- ============================================
//- Обработчики (клиентские, guard не нужен)
//- ============================================
const setSearchQuery = (query) => appState.setSearchQuery(query)

const performSearch = () => appState.search?.performSearch?.()

const resetSearch = () => appState.search?.resetSearch?.()

const clearSearch = () => appState.setSearchQuery('')

const handleFiltersUpdate = (newFilters) => appState.handleFiltersUpdate(newFilters)

const handleSortUpdate = (newSort) => appState.handleSortUpdate(newSort)

const updateActiveSuggestionIndex = (index) => {
  if (appState.search?.activeSuggestionIndex) {
    appState.search.activeSuggestionIndex.value = index
  }
}

const updateShowSuggestions = (value) => {
  if (appState.search?.showSuggestions) {
    appState.search.showSuggestions.value = value
  }
}

const handleSuggestionSelected = async (suggestion) => {
  try {
    await router.push(`/product/${suggestion.id}`)
  } catch {
    appState.setSearchQuery(suggestion.name)
    appState.search?.performSearch?.()
  }
}

const toggleMobileFilters = () => {
  showMobileFilters.value = !showMobileFilters.value
}

const closeMobileFilters = () => {
  showMobileFilters.value = false
}

const toggleFavorite = (productId) => appState.toggleFavorite(productId)

const refreshProducts = async () => {
  try {
    await appState.loadProducts()
  } catch (error) {
    console.error('[index] Ошибка обновления товаров:', error)
  }
}

const scrollToTop = () => {
  const container = productsContainerRef.value
  if (container) {
    container.scrollTo({ top: 0, behavior: 'smooth' })
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const resetFilters = async () => {
  showMobileFilters.value = false
  const currentSort = { ...sort.value }

  appState.handleFiltersUpdate({
    categories: [],
    priceRange: { min: null, max: null },
    onlyInStock: false,
    onlyFavorites: false,
  })
  appState.setSearchQuery('')

  if (currentSort.field) {
    appState.handleSortUpdate(currentSort)
  }

  await nextTick()
  scrollToTop()
}

const openCart = () => router.push('/cart')
const openFavorites = () => router.push('/favorites')
const openAuth = () => router.push('/auth/login')

//- ============================================
//- Объекты событий
//- ============================================
const headerEvents = {
  'update:searchQuery': setSearchQuery,
  suggestionSelected: handleSuggestionSelected,
  performSearch,
  resetSearch,
  search: setSearchQuery,
  'clear-search': clearSearch,
  toggleFilters: toggleMobileFilters,
  'update:activeSuggestionIndex': updateActiveSuggestionIndex,
  'update:showSuggestions': updateShowSuggestions,
  'filters-update': handleFiltersUpdate,
  'sort-update': handleSortUpdate,
  'search-query-update': setSearchQuery,
  'reset-filters': resetFilters,
}

const mobileFiltersEvents = {
  close: closeMobileFilters,
  'update:filters': handleFiltersUpdate,
  'update:sort': handleSortUpdate,
  'update:searchQuery': setSearchQuery,
  'reset-filters': resetFilters,
  'scroll-to-top': scrollToTop,
}

const sidebarEvents = {
  'update:filters': handleFiltersUpdate,
  'update:sort': handleSortUpdate,
  'update:searchQuery': setSearchQuery,
  'reset-filters': resetFilters,
  'scroll-to-top': scrollToTop,
}

const footerEvents = {
  toggleFilters: toggleMobileFilters,
  openCart,
  openFavorites,
  openAuth,
}

//- ============================================
//- Классы
//- ============================================
const mainAreaClasses = computed(() => {
  const classes = []
  if (isMobile.value) classes.push('mobile-layout')
  if (isMobile.value && isHorizontal.value) classes.push('horizontal-orientation')
  return classes
})

const footerClasses = computed(() =>
  isHorizontal.value ? 'horizontal-footer-left' : 'footer-area'
)

//- ============================================
//- Активные фильтры
//- ============================================
const activeFiltersCount = computed(() => {
  const f = filters.value
  if (!f) return 0

  let count = 0
  if (f.categories?.length > 0) count++
  if (f.onlyInStock) count++
  if (f.onlyFavorites) count++

  const actualMin = priceRange.value.min || 0
  const actualMax = priceRange.value.max || 100000
  const filterMin = f.priceRange?.min || actualMin
  const filterMax = f.priceRange?.max || actualMax

  if (filterMin > actualMin || filterMax < actualMax) count++

  return count
})

//- ============================================
//- Текущая вкладка
//- ============================================
watch(
  () => route.path,
  (path) => {
    if (path === '/') currentTab.value = 'home'
    else if (path.startsWith('/cart')) currentTab.value = 'cart'
    else if (path.startsWith('/favorites')) currentTab.value = 'favorites'
    else if (path.startsWith('/auth') || path.startsWith('/user')) currentTab.value = 'auth'
    else currentTab.value = ''
  },
  { immediate: true }
)

//- ============================================
//- Ориентация (rAF-throttled)
//- ============================================
let rafId = null

const checkOrientation = () => {
  const width = window.innerWidth
  const height = window.innerHeight
  const isLandscape = width > height
  const isMobileDevice = width <= 768

  isHorizontal.value = isMobileDevice
    ? isLandscape && width <= 926
    : isLandscape && width <= 1024
}

const scheduleOrientationCheck = () => {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(checkOrientation)
}

//- ============================================
//- Блокировка скролла при мобильных фильтрах
//- ============================================
const updateBodyScroll = (locked) => {
  document.body.style.overflow = locked ? 'hidden' : ''
}

//- ============================================
//- Lifecycle
//- ============================================
onMounted(() => {
  isMounted.value = true

  if (products.value.length === 0 && !isLoading.value) {
    appState.loadProducts?.()
  }

  checkOrientation()
  window.addEventListener('resize', scheduleOrientationCheck, { passive: true })
  window.addEventListener('orientationchange', scheduleOrientationCheck, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('resize', scheduleOrientationCheck)
  window.removeEventListener('orientationchange', scheduleOrientationCheck)
  if (rafId) cancelAnimationFrame(rafId)
})

watch(showMobileFilters, updateBodyScroll)
</script>

<style scoped>
/* ─── Корневая структура ─────────────────────────────────────── */

.grid-container {
  display: flex;
  flex-direction: column;
  height: 100dvh;

}

.header-area {
  flex-shrink: 0;
  width: 100%;
  z-index: 40;
}

.main-content-wrapper {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
  overflow: hidden;
  width: 100%;
}

/* ─── Сетка контента ────────────────────────────────────────── */

.content-area {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-areas: 'main';
  min-height: 0;

  @media (min-width: 1025px) {
    grid-template-columns: 280px 1fr;
    grid-template-areas: 'sidebar main';
    gap: 1rem;
    padding: 0 1rem;
    padding-right: 0;
  }
}

.sidebar-area {
  grid-area: sidebar;
  display: none;

  @media (min-width: 1025px) {
    display: block;
    padding-top: 10px;
  }
}

/* ─── Скроллируемая область с товарами ──────────────────────── */

.main-area {
  grid-area: main;
  display: flex;
  flex-direction: column;
  min-height: 0;
  width: 100%;
}

.products-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  /* magic number убран — высоту вычисляет flexbox */
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  width: 100%;
  contain: layout style;
  content-visibility: auto;
  contain-intrinsic-size: auto 500px;
}

.scroll-sentinel {
  height: 1px;
  width: 100%;
  flex-shrink: 0;
}

/* ─── Переход фильтров ──────────────────────────────────────── */

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ─── Мобильный футер ───────────────────────────────────────── */

.footer-area {
  position: fixed;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 60px;
  z-index: 30;
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: white;
  box-shadow: 0 -2px 4px rgb(0 0 0 / 0.1);
}

.horizontal-footer-left {
  position: fixed;
  left: 0;
  top: 60px;
  bottom: 0;
  width: 70px;
  z-index: 30;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  background: white;
  box-shadow: 2px 0 4px rgb(0 0 0 / 0.1);
  padding-top: 1rem;
  gap: 1.5rem;
}

/* ─── Горизонтальная ориентация ─────────────────────────────── */

.main-area.horizontal-orientation {
  margin-left: 64px;
  width: calc(100% - 64px);

  @media (max-width: 740px) and (orientation: landscape) {
    margin-left: 60px;
    width: calc(100% - 60px);
  }

  @media (max-width: 360px) and (orientation: landscape) {
    margin-left: 50px;
    width: calc(100% - 50px);
  }
}

.main-area.horizontal-orientation .products-container {
  padding: 0 0.5rem;
  width: 100%;
  box-sizing: border-box;
}

/* ─── Оверлей мобильных фильтров ────────────────────────────── */

.mobile-filters {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgb(0 0 0 / 0.5);
}
</style>