<!-- app/pages/index.vue - Оптимизированная версия -->
<template lang="pug">
//- Главный контейнер страницы
.grid-container
  //- Хедер сайта (критический - загружается сразу)
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

  //- Панель мобильных фильтров
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

  //- Основной контент
  .main-content-wrapper
    .content-area
      //- Десктопный сайдбар (ленивая загрузка)
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

      //- Основная область с товарами
      .main-area(:class="mainAreaClasses")
        .products-container(
          ref="productsContainerRef"
        )
          //- Sentinel для IntersectionObserver
          .scroll-sentinel

          //- Секция товаров
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

  //- Мобильный футер
  MobileNavFooter(
    v-if="isMobile"
    :class="footerClasses"
    :isHorizontal="isHorizontal"
    :activeFiltersCount="activeFiltersCount"
    :activeTab="currentTab"
    v-on="footerEvents"
  )

  //- Кнопка наверх (ленивая загрузка)
  LazyScrollToTop.scroll-top(
    v-if="showScrollTop"
    :visible="showScrollTop"
    :target="scrollTarget"
  )
</template>

<script setup>
import { useAppState } from '@/composables/useAppState'
import { useMobileDetection } from '@/composables/useMobileDetection'
import { useCart } from '@/composables/useCart'
import { nextTick, ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'

//- ============================================
//- Константа для проверки клиента
//- ============================================
const isClient = process.client

//- ============================================
//- Ленивая загрузка тяжелых компонентов
//- ============================================
const LazyMobileFiltersPanel = defineAsyncComponent(() => 
  import('~/components/layout/MobileFiltersPanel.vue')
)
const LazyDesktopSidebar = defineAsyncComponent(() => 
  import('~/components/layout/DesktopSidebar.vue')
)
const LazyScrollToTop = defineAsyncComponent(() => 
  import('~/components/ScrollToTop.vue')
)

// Критические компоненты загружаются сразу
import Header from '~/components/layout/Header.vue'
import ProductsSection from '~/components/products/ProductsSection.vue'
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'

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
const showMobileFilters = ref(false)
const showScrollTop = ref(false)
const productsContainerRef = ref(null)
const isHorizontal = ref(false)
const currentTab = ref('home')
const scrollObserver = ref(null)

//- ============================================
//- Хелпер для безопасного доступа к состоянию
//- ============================================
const getState = (path, defaultValue = null) => {
  const keys = path.split('.')
  let result = appState
  for (const key of keys) {
    result = result?.[key]
    if (result === undefined) return defaultValue
  }
  return result?.value ?? defaultValue
}

//- ============================================
//- Вычисляемые свойства (упрощены)
//- ============================================
const searchQuery = computed(() => getState('search.query', ''))
const isSearching = computed(() => getState('search.isSearching', false))
const showSuggestions = computed(() => getState('search.showSuggestions', false))
const searchSuggestions = computed(() => getState('search.suggestions', []))
const hasSearchSuggestions = computed(() => getState('search.hasSuggestions', false))
const activeSuggestionIndex = computed(() => getState('search.activeSuggestionIndex', -1))
const categories = computed(() => getState('categories', []))
const filters = computed(() => getState('filters', {}))
const sort = computed(() => {
  const currentSort = getState('sort')
  return currentSort?.field ? currentSort : { field: 'createdAt', order: 'desc' }
})
const priceRange = computed(() => getState('actualPriceRange', {}))
const isLoading = computed(() => getState('loading', false))
const displayedProducts = computed(() => getState('displayedProducts', []))
const products = computed(() => getState('products', []))
const totalProductsCount = computed(() => products.value.length)

//- ============================================
//- Группировка обработчиков событий
//- ============================================
const setSearchQuery = (query) => appState.setSearchQuery(query)
const performSearch = () => appState.search?.performSearch?.()
const resetSearch = () => appState.search?.resetSearch?.()
const clearSearch = () => appState.setSearchQuery('')
const handleFiltersUpdate = (newFilters) => appState.handleFiltersUpdate(newFilters)
const handleSortUpdate = (newSort) => appState.handleSortUpdate(newSort)

const updateActiveSuggestionIndex = (index) => {
  if (appState.search?.activeSuggestionIndex?.value !== undefined) {
    appState.search.activeSuggestionIndex.value = index
  }
}

const updateShowSuggestions = (value) => {
  if (appState.search?.showSuggestions?.value !== undefined) {
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

const resetFilters = async () => {
  showMobileFilters.value = false
  const currentSort = { ...sort.value }
  
  appState.handleFiltersUpdate({
    categories: [],
    priceRange: { min: null, max: null },
    onlyInStock: false,
    onlyFavorites: false
  })
  
  appState.setSearchQuery('')
  
  if (currentSort.field) {
    appState.handleSortUpdate(currentSort)
  }
  
  await nextTick()
  scrollToTop()
}

const toggleMobileFilters = () => {
  showMobileFilters.value = !showMobileFilters.value
}

const closeMobileFilters = () => {
  showMobileFilters.value = false
}

const toggleFavorite = (productId) => {
  appState.toggleFavorite(productId)
}

const refreshProducts = async () => {
  try {
    await appState.loadProducts()
  } catch (error) {
    console.error('[index] Ошибка обновления товаров:', error)
  }
}

const scrollToTop = () => {
  if (!isClient) return
  
  const container = productsContainerRef.value
  if (container) {
    container.scrollTo({ top: 0, behavior: 'smooth' })
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const openCart = () => router.push('/cart')
const openFavorites = () => router.push('/favorites')
const openAuth = () => router.push('/auth/login')

//- ============================================
//- Объекты событий для v-on
//- ============================================
const headerEvents = {
  'update:searchQuery': setSearchQuery,
  'suggestionSelected': handleSuggestionSelected,
  'performSearch': performSearch,
  'resetSearch': resetSearch,
  'search': setSearchQuery,
  'clear-search': clearSearch,
  'toggleFilters': toggleMobileFilters,
  'update:activeSuggestionIndex': updateActiveSuggestionIndex,
  'update:showSuggestions': updateShowSuggestions,
  'filters-update': handleFiltersUpdate,
  'sort-update': handleSortUpdate,
  'search-query-update': setSearchQuery,
  'reset-filters': resetFilters
}

const mobileFiltersEvents = {
  'close': closeMobileFilters,
  'update:filters': handleFiltersUpdate,
  'update:sort': handleSortUpdate,
  'update:searchQuery': setSearchQuery,
  'reset-filters': resetFilters,
  'scroll-to-top': scrollToTop
}

const sidebarEvents = {
  'update:filters': handleFiltersUpdate,
  'update:sort': handleSortUpdate,
  'update:searchQuery': setSearchQuery,
  'reset-filters': resetFilters,
  'scroll-to-top': scrollToTop
}

const footerEvents = {
  'toggleFilters': toggleMobileFilters,
  'openCart': openCart,
  'openFavorites': openFavorites,
  'openAuth': openAuth
}

//- ============================================
//- Классы для layout
//- ============================================
const mainAreaClasses = computed(() => {
  const classes = []
  if (isMobile.value) classes.push('mobile-layout')
  if (isMobile.value && isHorizontal.value) classes.push('horizontal-orientation')
  return classes
})

const footerClasses = computed(() => {
  return isHorizontal.value ? 'horizontal-footer-left' : 'footer-area'
})

const scrollTarget = computed(() => '.products-container')

//- ============================================
//- Количество активных фильтров
//- ============================================
const activeFiltersCount = computed(() => {
  const filtersValue = filters.value
  if (!filtersValue) return 0
  
  let count = 0
  if (filtersValue.categories?.length > 0) count++
  if (filtersValue.onlyInStock) count++
  if (filtersValue.onlyFavorites) count++
  
  const actualMin = priceRange.value.min || 0
  const actualMax = priceRange.value.max || 100000
  const filterMin = filtersValue.priceRange?.min || actualMin
  const filterMax = filtersValue.priceRange?.max || actualMax
  
  if (filterMin > actualMin || filterMax < actualMax) count++
  
  return count
})

//- ============================================
//- Навигация по вкладкам
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
//- Проверка ориентации (оптимизировано с rAF)
//- ============================================
let rafId = null

const checkOrientation = () => {
  if (!isClient) return
  
  const width = window.innerWidth
  const height = window.innerHeight
  const isLandscape = width > height
  const isMobileDevice = width <= 768
  
  isHorizontal.value = isMobileDevice 
    ? (isLandscape && width <= 926) 
    : (isLandscape && width <= 1024)
}

const scheduleOrientationCheck = () => {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(checkOrientation)
}

//- ============================================
//- IntersectionObserver для scroll кнопки
//- ============================================
const setupScrollObserver = () => {
  if (!isClient || !productsContainerRef.value) return
  
  scrollObserver.value = new IntersectionObserver(
    ([entry]) => {
      showScrollTop.value = !entry.isIntersecting
    },
    {
      threshold: 0.1,
      rootMargin: '-100px 0px 0px 0px',
      root: productsContainerRef.value
    }
  )
  
  const sentinel = productsContainerRef.value.querySelector('.scroll-sentinel')
  if (sentinel) {
    scrollObserver.value.observe(sentinel)
  }
}

//- ============================================
//- Блокировка скролла при открытых фильтрах
//- ============================================
const updateBodyScroll = (locked) => {
  if (!isClient) return
  document.body.style.overflow = locked ? 'hidden' : ''
}

//- ============================================
//- Инициализация
//- ============================================
onMounted(() => {
  if (!isClient) return
  
  checkOrientation()
  setupScrollObserver()
  
  window.addEventListener('resize', scheduleOrientationCheck, { passive: true })
  window.addEventListener('orientationchange', scheduleOrientationCheck, { passive: true })
})

onUnmounted(() => {
  if (!isClient) return
  
  window.removeEventListener('resize', scheduleOrientationCheck)
  window.removeEventListener('orientationchange', scheduleOrientationCheck)
  
  if (scrollObserver.value) {
    scrollObserver.value.disconnect()
  }
  
  if (rafId) cancelAnimationFrame(rafId)
})

//- ============================================
//- Watchers
//- ============================================
watch(showMobileFilters, updateBodyScroll)
</script>

<style scoped>
/* Основная структура с CSS containment */
.grid-container {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  overflow: hidden;
  contain: layout;
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
  contain: layout;
}

.content-area {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr;
  grid-template-areas: "main";
  
  @media (min-width: 1025px) {
    grid-template-columns: 280px 1fr;
    grid-template-areas: "sidebar main";
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

.main-area {
  grid-area: main;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  width: 100%;
}

/* Products container с CSS containment для производительности */
.products-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  width: 100%;
  max-height: calc(100dvh - 64px);
  
  /* CSS Containment - браузер не пересчитывает весь layout */
  contain: layout style;
  content-visibility: auto;
  contain-intrinsic-size: auto 500px;
  
  @media (max-width: 768px) {
    max-height: calc(100dvh - 60px);
  }
}

/* Sentinel для IntersectionObserver */
.scroll-sentinel {
  height: 1px;
  width: 100%;
  flex-shrink: 0;
}

/* Transition для мобильных фильтров */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Мобильный футер */
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
  box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.1);
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
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
  padding-top: 1rem;
  gap: 1.5rem;
}

/* Горизонтальная ориентация */
.main-area.horizontal-orientation {
  margin-left: 64px !important;
  width: calc(100% - 64px) !important;
  
  @media (max-width: 740px) and (orientation: landscape) {
    margin-left: 60px !important;
    width: calc(100% - 60px) !important;
  }
  
  @media (max-width: 360px) and (orientation: landscape) {
    margin-left: 50px !important;
    width: calc(100% - 50px) !important;
  }
}

.main-area.horizontal-orientation .products-container {
  padding: 0 0.5rem !important;
  width: 100% !important;
  box-sizing: border-box !important;
}

/* Панель мобильных фильтров */
.mobile-filters {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.5);
}

/* Кнопка наверх */
.scroll-top {
  position: fixed;
  right: 16px;
  z-index: 20;
}
</style>
