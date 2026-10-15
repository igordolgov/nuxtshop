<!-- app/pages/index.vue — главная (каталог): шапка (поиск теперь глобальный
     и живёт в Header), приём ?search= из глобального поиска, скелетон,
     сайдбары, бесконечный список, нижняя мобильная навигация. -->
<template lang="pug">
.grid-container
  //- Шапка: только каталог-специфика (фильтры). Поиск — внутри Header
  ClientOnly
    Header.header-area(
      :activeFiltersCount="activeFiltersCount"
      :showFilters="showMobileFilters"
      @toggleFilters="toggleMobileFilters"
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

  MobileNavFooter(v-if="isMobile")
</template>

<script setup>
import { useAppState } from '@/composables/useAppState'
import { useMobileDetection } from '@/composables/useMobileDetection'
import { useCart } from '@/composables/useCart'
import { nextTick, ref, computed, watch, onMounted, onUnmounted } from 'vue'

//- isMobile — из единого композабла. isHorizontal удалён вместе с
//- боковой навигацией (landscape ничем не отличается от portrait)
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
const isLoading = computed(() => getState('loading', false))
const displayedProducts = computed(() => getState('displayedProducts', []))
const products = computed(() => getState('products', []))
const totalProductsCount = computed(() => products.value?.length ?? 0)
const categories = computed(() => getState('categories', []))
const filters = computed(() => getState('filters', {}))
const sort = computed(() => {
  if (!import.meta.client) return { field: 'createdAt', order: 'desc' }
  const currentSort = getState('sort')
  return currentSort?.field ? currentSort : { field: 'createdAt', order: 'desc' }
})
const priceRange = computed(() => getState('actualPriceRange', {}))

//- Скелетон: до монтирования ИЛИ пока идёт первая загрузка пустого каталога
const showSkeleton = computed(
  () => !isMounted.value || (products.value.length === 0 && isLoading.value),
)

//- ============================================
//- ГЛОБАЛЬНЫЙ ПОИСК → каталог: приём ?search= из шапки.
//- Заголовок страницы применяется в стейт; параметр сразу стирается из
//- URL, чтобы refresh не перетирал живой запрос пользователя
//- ============================================
watch(
  () => route.query.search,
  async (v) => {
    if (route.path !== '/' || v === undefined) return
    appState.setSearchQuery?.(String(v))
    if (import.meta.client) {
      const q = { ...route.query }
      delete q.search
      await router.replace({ query: q })
    }
  },
  { immediate: true },
)

//- ============================================
//- Обработчики (клиентские)
//- ============================================
const setSearchQuery = (query) => appState.setSearchQuery(query)

const clearSearch = () => appState.setSearchQuery('')

const handleFiltersUpdate = (newFilters) => appState.handleFiltersUpdate(newFilters)

const handleSortUpdate = (newSort) => appState.handleSortUpdate(newSort)

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

const toggleMobileFilters = () => {
  showMobileFilters.value = !showMobileFilters.value
}

const closeMobileFilters = () => {
  showMobileFilters.value = false
}

//- ============================================
//- Объекты событий. Поисковые события больше не нужны здесь:
//- Header самодостаточен (пишет в appState напрямую)
//- ============================================
const headerEvents = {
  toggleFilters: toggleMobileFilters,
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
//- Lifecycle
//- ============================================
onMounted(() => {
  isMounted.value = true

  if (products.value.length === 0 && !isLoading.value) {
    appState.loadProducts?.()
  }
})

onUnmounted(() => {
  updateBodyScroll(false)
})

watch(showMobileFilters, updateBodyScroll)
</script>
