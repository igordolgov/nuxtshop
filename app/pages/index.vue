<!-- app/pages/index.vue — главная (каталог): шапка с поиском/фильтрами,
    скелетон загрузки, сайдбары, бесконечный список товаров,
    нижняя мобильная навигация. -->
<template lang="pug">
.grid-container
  //- Шапка в ClientOnly: мобильные ветки зависят от window.innerWidth,
  //- SSR-рендер давал hydration mismatch. Fallback — заглушка той же
  //- высоты (--header-height), layout не прыгает
  ClientOnly
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
    template(#fallback)
      .header-skeleton

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
      //- Скелетон вместо белого экрана: данные каталога клиентские,
      //- до первой загрузки показываем структуру страницы.
      //- Раньше весь контент прятал v-if="isMounted" — посетитель видел
      //- пустоту, пока не загрузится и не выполнится JS
      .skeleton-area(v-if="showSkeleton")
        .skeleton.skeleton-title
        .skeleton-grid
          .skeleton.skeleton-card(v-for="i in 8" :key="i")

      template(v-else)
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

  //- Футер сам управляет ориентацией и навигацией — ни props, ни событий
  MobileNavFooter(v-if="isMobile")
</template>

<script setup>
import { useAppState } from '@/composables/useAppState'
import { useMobileDetection } from '@/composables/useMobileDetection'
import { useCart } from '@/composables/useCart'
import { nextTick, ref, computed, watch, onMounted, onUnmounted } from 'vue'

//- ============================================
//- Composables.
//- isMobile — из единого композабла. isHorizontal удалён вместе с
//- боковой навигацией: landscape ничем не отличается от portrait
//- (4-колоночная сетка в landscape отключена; при желании вернётся
//- чистым CSS через media (orientation: landscape))
const { isMobile } = useMobileDetection()
//- ============================================

const route = useRoute()
const router = useRouter()
const { addToCart } = useCart()
const appState = useAppState()

//- ============================================
//- Реактивные переменные
//- ============================================
const isMounted = ref(false)
const showMobileFilters = ref(false)
const productsContainerRef = ref(null)

//- ============================================
//- Чтение состояния (SSR-safe)
//- TODO: заменить на прямой доступ к appState.*, когда useAppState.js будет отрефакторен
//- ============================================
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

//- Скелетон: до монтирования ИЛИ пока идёт первая загрузка пустого каталога.
//- Важно: ProductsSection с пустым списком показал бы empty-state
//- «ничего не найдено» — не пускаем его до появления данных
const showSkeleton = computed(
  () => !isMounted.value || (products.value.length === 0 && isLoading.value),
)

//- ============================================
//- Обработчики (клиентские)
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

//- ============================================
//- Классы
//- ============================================
const mainAreaClasses = computed(() => (isMobile.value ? ['mobile-layout'] : []))

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
//- Блокировка скролла при мобильных фильтрах
//- ============================================
const updateBodyScroll = (locked) => {
  document.body.style.overflow = locked ? 'hidden' : ''
}

//- ============================================
//- Lifecycle.
//- Слушатели resize/orientationchange больше не нужны здесь —
//- их держит useMobileDetection (один набор на всё приложение)
//- ============================================
onMounted(() => {
  isMounted.value = true

  if (products.value.length === 0 && !isLoading.value) {
    appState.loadProducts?.()
  }
})

onUnmounted(() => {
  // Страховка: уход со страницы при открытых фильтрах не должен
  // оставить body заблокированным для следующих страниц
  updateBodyScroll(false)
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

/* Заглушка шапки на время ClientOnly-fallback: та же высота,
   что Header (min-h-14 = 56px), чтобы контент не прыгал */
.header-skeleton {
  height: var(--header-height, 56px);
  width: 100%;
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

/* ─── Скелетон каталога (до первой загрузки данных) ─────────── */

.skeleton-area {
  grid-area: main;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: 1rem;
}

.skeleton-title {
  height: 2rem;
  width: 12rem;
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  overflow: hidden;

  @media (min-width: 1025px) {
    grid-template-columns: repeat(4, 1fr);
  }
}

.skeleton-card {
  aspect-ratio: 3 / 4;
  border-radius: 0.75rem;
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
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  width: 100%;
  contain: layout style;
  content-visibility: auto;
  contain-intrinsic-size: auto 500px;

  /* Нижний «воздух» под фиксированной навигацией: без него последний
     ряд карточек прятался под меню и был недоступен для тапа */
  @media (max-width: 1023.98px) {
    padding-bottom: calc(var(--mobile-nav-height, 60px) + var(--safe-area-bottom, 0px) + 12px);
  }
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

/* ─── Оверлей мобильных фильтров ────────────────────────────── */

.mobile-filters {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgb(0 0 0 / 0.5);
}
</style>