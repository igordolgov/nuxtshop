<!-- components/products/ProductsSection.vue - С Infinite Scroll -->
<template lang="pug">
.products-section.pb-12(class="sm:pb-0")
  //- Загрузка первой страницы
  .initial-loading.flex.justify-center.items-center.py-20(
    v-if="isLoadingInitial"
  )
    span.loading.loading-spinner.loading-lg.text-primary

  //- Основной контент
  template(v-else)
    //- Результаты поиска
    .search-results.mb-4(v-if="searchQuery && displayedProducts.length > 0")
      .flex.items-center.justify-between.gap-2.flex-wrap
        .text-sm.text-base-content.opacity-70
          | Найдено {{ displayedProducts.length }} товаров по запросу 
          span.font-medium "{{ searchQuery }}"
        button.btn.btn-sm.btn-ghost.gap-1(
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
        v-if="activeFiltersCount > 0"
        @click="$emit('resetFilters')"
      ) Сбросить фильтры

    //- Grid/List товаров с Infinite Scroll
    .products-wrapper(
      v-if="displayedProducts.length > 0"
      ref="containerRef"
    )
      //- Счётчик товаров
      .products-counter.text-sm.text-base-content.opacity-60.mb-0.py-1(
        v-if="!searchQuery"
      )
        | Показано {{ visibleProducts.length }} из {{ displayedProducts.length }} товаров

      //- Сетка товаров
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

      //- Sentinel для IntersectionObserver
      .scroll-sentinel(
        ref="sentinelRef"
      )

      //- Индикатор загрузки
      .loading-more.flex.justify-center.items-center.py-6(
        v-if="isLoadingMore"
      )
        span.loading.loading-spinner.loading-md.text-primary
        span.ml-2.text-sm.opacity-60 Загрузка товаров...

      //- Конец списка
      .end-of-list.text-center.py-2.text-sm.opacity-50(
        v-if="!hasMore && displayedProducts.length > 0"
      )
        | Вы просмотрели все товары ({{ displayedProducts.length }})

    //- Кнопка "Показать ещё" (fallback)
    .load-more-section.py-6.text-center(
      v-if="showLoadMoreButton && hasMore && !isLoadingMore"
    )
      button.btn.btn-outline.btn-primary(
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
      @click="$emit('refreshProducts')"
    ) Попробовать снова
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

// ==========================================
// Props
// ==========================================
const props = defineProps({
  products: {
    type: Array,
    default: () => []
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  isMobile: {
    type: Boolean,
    default: false
  },
  isHorizontal: {
    type: Boolean,
    default: false
  },
  searchQuery: {
    type: String,
    default: ''
  },
  activeFiltersCount: {
    type: Number,
    default: 0
  },
  // Включить infinite scroll (иначе показать кнопку)
  useInfiniteScroll: {
    type: Boolean,
    default: true
  },
  // Размер страницы для загрузки
  pageSize: {
    type: Number,
    default: 20
  },
  // Максимальное количество элементов в DOM
  maxRendered: {
    type: Number,
    default: 100
  }
})

// ==========================================
// Emits
// ==========================================
const emit = defineEmits([
  'toggleFavorite',
  'addToCart',
  'resetFilters',
  'refreshProducts',
  'clearSearch'
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

// Пагинация
const currentPage = ref(1)
const isLoadingMore = ref(false)
const isLoadingInitial = ref(true)
const hasMore = ref(true)

// Виртуализация
const visibleProducts = ref([])
const startIndex = ref(0)
const isScrolling = ref(false)
let scrollTimeout = null

// Ошибка
const loadError = ref(null)

// ==========================================
// Computed
// ==========================================
const displayedProducts = computed(() => props.products)

const remainingCount = computed(() => {
  return Math.max(0, displayedProducts.value.length - visibleProducts.value.length)
})

const showLoadMoreButton = computed(() => {
  return !props.useInfiniteScroll
})

const gridClasses = computed(() => {
  const classes = ['grid', 'gap-2', 'sm:gap-4']
  
  if (props.isMobile) {
    if (props.isHorizontal) {
      // Горизонтальный режим на мобильном - 4 колонки
      classes.push('grid-cols-4', 'gap-1', 'sm:gap-2')
    } else {
      // Вертикальный режим на мобильном - 2 колонки
      classes.push('grid-cols-2')
    }
  } else {
    // Десктоп
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

/**
 * Обновление видимых товаров (с учётом виртуализации)
 */
const updateVisibleProducts = () => {
  const total = displayedProducts.value.length
  const maxStart = Math.max(0, total - props.maxRendered)
  
  if (startIndex.value > maxStart) {
    startIndex.value = maxStart
  }
  
  const endIndex = Math.min(startIndex.value + props.maxRendered, total)
  visibleProducts.value = displayedProducts.value.slice(startIndex.value, endIndex)
}

/**
 * Загрузка следующей страницы
 */
const loadMore = async () => {
  if (isLoadingMore.value || !hasMore.value) return
  
  isLoadingMore.value = true
  
  try {
    await new Promise(resolve => setTimeout(resolve, 100))
    
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

/**
 * Очистка элементов сверху при скролле
 */
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

/**
 * Инициализация IntersectionObserver
 */
const setupObserver = () => {
  if (!process.client || !sentinelRef.value) return
  
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
      threshold: 0
    }
  )
  
  observer.value.observe(sentinelRef.value)
}

/**
 * Обработчик скролла
 */
const handleScroll = () => {
  isScrolling.value = true
  
  if (scrollTimeout) clearTimeout(scrollTimeout)
  
  scrollTimeout = setTimeout(() => {
    isScrolling.value = false
    cleanupTopItems()
  }, 150)
}

/**
 * Сброс состояния
 */
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
    const newIds = newProducts?.map(p => p.id).join(',')
    const oldIds = oldProducts?.map(p => p.id).join(',')
    
    if (newIds !== oldIds) {
      await reset()
    }
    
    isLoadingInitial.value = false
  },
  { immediate: true, deep: true }
)

watch(
  () => props.isLoading,
  (loading) => {
    isLoadingInitial.value = loading
  }
)

// ==========================================
// Lifecycle
// ==========================================

onMounted(() => {
  if (!process.client) return
  
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
  loadMore
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

.loading-more {
  contain: layout;
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

.initial-loading,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>