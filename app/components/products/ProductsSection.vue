<!-- components/products/ProductsSection.vue — секция каталога:
     пагинация с infinite scroll (IntersectionObserver), упрощённая
     виртуализация, скелетоны при первой загрузке и подгрузке,
     4 колонки в landscape — чистым CSS (см. style). -->
<template lang="pug">
.products-section.pb-12(class="sm:pb-0")
  //- Первая загрузка: скелетон-сетка вместо спиннера
  .initial-skeleton(v-if="isLoadingInitial")
    .products-grid(:class="gridClasses")
      ProductCardSkeleton(
        v-for="i in initialSkeletonCount"
        :key="`sk-init-${i}`"
        :variant="isMobile ? 'list' : 'grid'"
      )

  template(v-else)
    //- Результаты поиска
    .search-results.mb-4(v-if="searchQuery && displayedProducts.length > 0")
      .flex.items-center.justify-between.gap-2.flex-wrap
        .text-sm.text-base-content.opacity-70
          | Найдено {{ displayedProducts.length }} товаров по запросу
          span.font-medium "{{ searchQuery }}"
        button.btn.btn-sm.btn-ghost.gap-1(
          type="button"
          @click="$emit('clearSearch')"
        )
          Icon(name="mdi:close" size="16")
          | Очистить

    //- Пустое состояние
    .empty-state.py-16.text-center(
      v-if="!displayedProducts.length && !isLoading"
    )
      Icon.empty-icon(name="mdi:package-variant" size="64")
      h3.text-xl.font-medium.mb-2 Товары не найдены
      p.text-base-content.opacity-60.mb-4 {{ emptyMessage }}
      button.btn.btn-primary(
        type="button"
        v-if="activeFiltersCount > 0"
        @click="$emit('resetFilters')"
      ) Сбросить фильтры

    //- Grid/List товаров с Infinite Scroll
    .products-wrapper(
      v-if="displayedProducts.length > 0"
      ref="containerRef"
    )
      .products-counter.text-sm.text-base-content.opacity-60.mb-0.py-1(
        v-if="!searchQuery"
      )
        | Показано {{ visibleProducts.length }} из {{ displayedProducts.length }} товаров

      .products-grid(
        :class="gridClasses"
      )
        ProductCard.product-card(
          v-for="(product, index) in visibleProducts"
          :key="product.id"
          :product="product"
          :index="index"
          :viewMode="isMobile ? 'list' : 'grid'"
          @toggleFavorite="$emit('toggleFavorite', $event)"
          @addToCart="$emit('addToCart', $event)"
        )

        //- Скелетоны подгрузки следующей страницы
        template(v-if="isLoadingMore")
          ProductCardSkeleton(
            v-for="i in moreSkeletonCount"
            :key="`sk-more-${i}`"
            :variant="isMobile ? 'list' : 'grid'"
          )

      .scroll-sentinel(
        ref="sentinelRef"
      )

      .end-of-list.text-center.py-2.text-sm.opacity-50(
        v-if="!hasMore && displayedProducts.length > 0"
      )
        | Вы просмотрели все товары ({{ displayedProducts.length }})

    //- Кнопка «Показать ещё» (fallback без infinite scroll)
    .load-more-section.py-6.text-center(
      v-if="showLoadMoreButton && hasMore && !isLoadingMore"
    )
      button.btn.btn-outline.btn-primary(
        type="button"
        @click="loadMore"
      )
        | Показать ещё
        span.badge.badge-primary.badge-sm.ml-2 {{ remainingCount }}

  //- Ошибка загрузки
  .error-state.py-16.text-center(
    v-if="loadError"
  )
    Icon(name="mdi:alert-circle" size="48" class="text-error")
    h3.text-xl.font-medium.mb-2 Ошибка загрузки
    p.text-base-content.opacity-60.mb-4 {{ loadError }}
    button.btn.btn-primary(
      type="button"
      @click="$emit('refreshProducts')"
    ) Попробовать снова
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

// ==========================================
// Props.
// isHorizontal удалён: 4 колонки в landscape теперь чистый CSS
// (media-блок в <style>). Пропс больше никем не передаётся
// ==========================================
const props = defineProps({
  products: { type: Array, default: () => [] },
  isLoading: { type: Boolean, default: false },
  isMobile: { type: Boolean, default: false },
  searchQuery: { type: String, default: '' },
  activeFiltersCount: { type: Number, default: 0 },
  useInfiniteScroll: { type: Boolean, default: true },
  pageSize: { type: Number, default: 20 },
  maxRendered: { type: Number, default: 100 },
})

// ==========================================
// Emits
// ==========================================
const emit = defineEmits([
  'toggleFavorite',
  'addToCart',
  'resetFilters',
  'refreshProducts',
  'clearSearch',
])

// ==========================================
// Constants
// ==========================================
const ESTIMATED_ITEM_HEIGHT = 280

// ==========================================
// State
// ==========================================
const containerRef = ref(null)
const sentinelRef = ref(null)
const observer = ref(null)

const currentPage = ref(1)
const isLoadingMore = ref(false)
const isLoadingInitial = ref(true)
const hasMore = ref(true)

const visibleProducts = ref([])
const startIndex = ref(0)
const isScrolling = ref(false)
let scrollTimeout = null

const loadError = ref(null)

// ==========================================
// Computed
// ==========================================
const displayedProducts = computed(() => props.products)

const remainingCount = computed(() => {
  return Math.max(0, displayedProducts.value.length - visibleProducts.value.length)
})

const showLoadMoreButton = computed(() => !props.useInfiniteScroll)

// Скелетоны первой загрузки: заполняют экран.
// ⚙️ НАСТРОЙКА: количество призрачных карточек
const initialSkeletonCount = computed(() => (props.isMobile ? 6 : 10))

// Скелетоны подгрузки: короткий ряд внизу сетки
const moreSkeletonCount = computed(() => (props.isMobile ? 4 : 5))

const gridClasses = computed(() => {
  const classes = ['grid', 'gap-2', 'sm:gap-4']

  if (props.isMobile) {
    // Portrait: 2 колонки. Landscape: 4 — чистый CSS (media-блок в style)
    classes.push('grid-cols-2')
  } else {
    classes.push('grid-cols-2', 'sm:grid-cols-3', 'lg:grid-cols-4', 'xl:grid-cols-5')
  }

  return classes
})

const emptyMessage = computed(() => {
  if (props.searchQuery) {
    return `По запросу "${props.searchQuery}" ничего не найдено`
  }
  if (props.activeFiltersCount > 0) {
    return 'Попробуйте изменить параметры фильтрации'
  }
  return 'Товары отсутствуют'
})

// ==========================================
// Методы
// ==========================================

const updateVisibleProducts = () => {
  const total = displayedProducts.value.length
  const maxStart = Math.max(0, total - props.maxRendered)

  if (startIndex.value > maxStart) {
    startIndex.value = maxStart
  }

  const endIndex = Math.min(startIndex.value + props.maxRendered, total)
  visibleProducts.value = displayedProducts.value.slice(startIndex.value, endIndex)
}

// ⚙️ НАСТРОЙКА: длительность показа скелетонов подгрузки, мс
const LOAD_MORE_DELAY_MS = 300

const loadMore = async () => {
  if (isLoadingMore.value || !hasMore.value) return

  isLoadingMore.value = true

  try {
    await new Promise((resolve) => setTimeout(resolve, LOAD_MORE_DELAY_MS))

    const total = displayedProducts.value.length
    const nextEnd = (currentPage.value + 1) * props.pageSize

    if (nextEnd >= total) {
      hasMore.value = false
    } else {
      currentPage.value++
    }

    updateVisibleProducts()
  } catch (error) {
    console.error('[ProductsSection] Error loading more:', error)
    loadError.value = 'Не удалось загрузить товары'
  } finally {
    isLoadingMore.value = false
  }
}

const cleanupTopItems = () => {
  if (!containerRef.value || isScrolling.value || startIndex.value === 0) return

  const scrollTop = containerRef.value.scrollTop
  const scrolledItems = Math.floor(scrollTop / ESTIMATED_ITEM_HEIGHT)
  const newStartIndex = Math.max(0, scrolledItems - 5)

  if (newStartIndex !== startIndex.value && newStartIndex > 0) {
    const oldStartIndex = startIndex.value
    startIndex.value = newStartIndex

    const scrollDiff = (newStartIndex - oldStartIndex) * ESTIMATED_ITEM_HEIGHT
    containerRef.value.scrollTop = scrollTop - scrollDiff

    updateVisibleProducts()
  }
}

const setupObserver = () => {
  if (!import.meta.client || !sentinelRef.value) return

  if (observer.value) {
    observer.value.disconnect()
  }

  observer.value = new IntersectionObserver(
    async ([entry]) => {
      if (entry.isIntersecting && !isLoadingMore.value && hasMore.value) {
        await loadMore()
      }
    },
    {
      root: containerRef.value || null,
      rootMargin: '300px',
      threshold: 0,
    },
  )

  observer.value.observe(sentinelRef.value)
}

const handleScroll = () => {
  isScrolling.value = true

  if (scrollTimeout) clearTimeout(scrollTimeout)

  scrollTimeout = setTimeout(() => {
    isScrolling.value = false
    cleanupTopItems()
  }, 150)
}

const reset = async () => {
  currentPage.value = 1
  startIndex.value = 0
  hasMore.value = true
  isLoadingMore.value = false
  loadError.value = null

  visibleProducts.value = []

  if (containerRef.value) {
    containerRef.value.scrollTop = 0
  }

  await nextTick()
  updateVisibleProducts()
  setupObserver()
}

// ==========================================
// Watchers
// ==========================================

watch(
  () => props.products,
  async (newProducts, oldProducts) => {
    const newIds = newProducts?.map((p) => p.id).join(',')
    const oldIds = oldProducts?.map((p) => p.id).join(',')

    if (newIds !== oldIds) {
      await reset()
    }

    isLoadingInitial.value = false
  },
  { immediate: true, deep: true },
)

watch(
  () => props.isLoading,
  (loading) => {
    isLoadingInitial.value = loading
  },
)

// ==========================================
// Lifecycle
// ==========================================

onMounted(() => {
  if (!import.meta.client) return

  updateVisibleProducts()

  setTimeout(() => {
    setupObserver()
  }, 100)

  if (containerRef.value) {
    containerRef.value.addEventListener('scroll', handleScroll, { passive: true })
  }
})

onUnmounted(() => {
  if (observer.value) {
    observer.value.disconnect()
  }

  if (containerRef.value) {
    containerRef.value.removeEventListener('scroll', handleScroll)
  }

  if (scrollTimeout) {
    clearTimeout(scrollTimeout)
  }
})

// ==========================================
// Public API
// ==========================================
defineExpose({
  reset,
  loadMore,
})
</script>

<style scoped>
.products-section {
  width: 100%;
}

.products-wrapper {
  position: relative;
  width: 100%;
  contain: layout style;
}

.products-grid {
  transform: translateZ(0);
  contain: layout;
}

.product-card {
  contain: layout style;
  content-visibility: auto;
  contain-intrinsic-size: auto 280px;
  animation: fadeIn 0.3s ease-out;
}

.scroll-sentinel {
  height: 1px;
  width: 100%;
  flex-shrink: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  opacity: 0.3;
  margin-bottom: 1rem;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>