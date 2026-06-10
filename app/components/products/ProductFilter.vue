<!-- app/components/products/ProductFilter.vue -->
<template lang="pug">
.product-filter.h-full.border-none.select-none
  //- Заголовок и кнопка сброса
  .filter-header.flex.justify-between.items-center.mb-3(v-if="!isHorizontal")
    .flex.flex-col.w-full
      .flex.justify-between.items-center
        button.btn.btn-info.rounded-lg(
          v-if="activeFiltersCount > 0"
          @click="resetAllFilters"
        )
          span.text-sm.text-white Сбросить фильтры
        div(v-else class="lg:bg-transparent pb-2 lg:mt-1 lg:pt-0 lg:pl-0").bg-primary.rounded-lg.px-4.py-2
          span.text-white.font-medium(class="text-sm lg:text-lg") Фильтры:
        
        //- Количество товаров (только для вертикального режима)
        .product-count-display.ml-2(v-if="!isHorizontal && shouldShowProductCount")
          .badge.badge-md.badge-outline.px-2.py-3.rounded-md(class="text-info lg:badge-sm")
            span {{ productCountText }} товаров

  //- Основной контейнер
  .filter-content.flex.flex-1.min-h-0.overflow-hidden(
    :class="isHorizontal ? 'horizontal-content' : 'vertical-content'"
  )

    //- Количество товаров (для горизонтального режима)
    .filter-section.flex.flex-col.flex-shrink-0.p-2.bg-base-100.rounded-lg.mt-2.absolute.-top-3.right-26(
      v-if="shouldShowProductCount && isHorizontal"
    )
      .product-count-display.w-full
        .flex.items-center.justify-between
          span.text-sm.mr-2.text-info Показано товаров:
          .badge.badge-primary.px-2.py-1.rounded-sm
            span.text-sm.font-medium {{ productCountText }}
    
    //- Горизонтальный режим
    template(v-if="isHorizontal")
      .horizontal-layout.flex.flex-row.flex-1.min-h-0.gap-2
        //- Левая колонка: сортировка и цена
        .left-column.flex.flex-col.min-h-0.gap-0(class="w-2/5")
          //- Сортировка
          .filter-section.flex.flex-col.flex-shrink-0.p-2.bg-base-100.rounded-lg
            ProductSort(
              ref="sortRef"
              :sortBy="safeSort.sortBy"
              :sortOrder="safeSort.sortOrder"
              @sort-change="handleSortChange"
              :compact="isHorizontal"
            )

          //- Диапазон цен
          .filter-section.flex.flex-col.flex-1.min-h-0.p-2.bg-base-100.rounded-lg
            ProductPriceRange(
              ref="priceRangeRef"
              :minPrice="safePriceRange.min"
              :maxPrice="safePriceRange.max"
              :currentMin="safeFilters.priceRange.min"
              :currentMax="safeFilters.priceRange.max"
              @update:priceRange="handlePriceRangeUpdate"
              :compact="isHorizontal"
            )

          //- Кнопка сброса для горизонтального режима
          .filter-section.flex.flex-col.flex-shrink-0.absolute.-top-3.left-0(
            v-if="activeFiltersCount > 0"
          )
            button.btn.btn-info.btn-sm.rounded-lg.w-full.mt-2.py-4(
              @click="resetAllFilters"
              title="Сбросить все фильтры"
            )
              span.text-sm.text-white Сбросить фильтры

        //- Правая колонка: категории
        .right-column.flex.flex-col.min-h-0(class="w-4/5")
          .filter-section.flex.flex-col.flex-1.min-h-0.p-2.bg-base-100.rounded-lg
            ProductCategories(
              ref="categoriesRef"
              :categories="sortedCategories"
              :selectedCategories="safeFilters.categories"
              @update:selectedCategories="handleCategoriesUpdate"
              :searchQuery="safeSearchQuery"
              :compact="isHorizontal"
            )

    //- Вертикальный режим
    template(v-else)
      .vertical-layout.flex.flex-col.flex-1.min-h-0.gap-3.overflow-y-auto.overflow-x-hidden
        //- Сортировка
        .filter-section
          ProductSort(
            ref="sortRef"
            :sortBy="safeSort.sortBy"
            :sortOrder="safeSort.sortOrder"
            @sort-change="handleSortChange"
            :compact="false"
          )

        //- Диапазон цен
        .filter-section
          ProductPriceRange(
            ref="priceRangeRef"
            :minPrice="safePriceRange.min"
            :maxPrice="safePriceRange.max"
            :currentMin="safeFilters.priceRange.min"
            :currentMax="safeFilters.priceRange.max"
            @update:priceRange="handlePriceRangeUpdate"
            :compact="false"
          )

        //- Категории
        .filter-section.flex-1.overflow-auto
          ProductCategories(
            ref="categoriesRef"
            :categories="sortedCategories"
            :selectedCategories="safeFilters.categories"
            @update:selectedCategories="handleCategoriesUpdate"
            :searchQuery="safeSearchQuery"
            :compact="false"
          )
</template>

<style scoped>
/* КРИТИЧЕСКИ ВАЖНЫЕ СТИЛИ ДЛЯ ПРОКРУТКИ */
.product-filter {
  height: 100%;
  display: flex;
  flex-direction: column;
  contain: layout style;
}

.filter-content {
  flex: 1;
  min-height: 0;
}

/* Горизонтальный режим */
.filter-content.horizontal-content {
  overflow: hidden;
}

.horizontal-layout {
  min-height: 0;
  height: 100%;
}

.left-column, .right-column {
  min-height: 0;
  height: 100%;
}

/* Секции в горизонтальном режиме */
.filter-section {
  min-height: 0;
}

/* Прокрутка для правой колонки (категории) в горизонтальном режиме */
.right-column .filter-section {
  overflow-y: auto;
}

/* Вертикальный режим */
.filter-content.vertical-content {
  overflow-y: auto;
}

/* Стили для отображения количества товаров */
.product-count-display {
  transition: opacity 0.15s ease;
}

.product-count-display .badge {
  white-space: nowrap;
}

/* Адаптивные стили */
@media (max-width: 926px) and (orientation: landscape) {
  .left-column, .right-column {
    padding: 0.125rem;
  }
  
  .filter-section {
    padding: 0.5rem;
  }
  
  .product-count-display {
    padding: 0.25rem;
  }
}

/* Улучшенные скроллбары */
.right-column .filter-section::-webkit-scrollbar {
  width: 4px;
}

.right-column .filter-section::-webkit-scrollbar-track {
  background: hsl(var(--b3));
  border-radius: 2px;
}

.right-column .filter-section::-webkit-scrollbar-thumb {
  background: hsl(var(--p));
  border-radius: 2px;
}

.vertical-content::-webkit-scrollbar {
  width: 6px;
}

.vertical-content::-webkit-scrollbar-track {
  background: hsl(var(--b3));
  border-radius: 3px;
}

.vertical-content::-webkit-scrollbar-thumb {
  background: hsl(var(--p));
  border-radius: 3px;
}
</style>

<script setup>
//- ============================================
//- Imports
//- ============================================
import { ref, computed, onMounted, watch, nextTick } from 'vue'

//- ============================================
//- Props
//- ============================================
const props = defineProps({
  searchQuery: { type: String, default: '' },
  categories: { type: Array, default: () => [] },
  filters: {
    type: Object,
    default: () => ({
      categories: [],
      priceRange: { min: null, max: null },
      onlyInStock: false,
      onlyFavorites: false
    })
  },
  sort: {
    type: Object,
    default: () => ({ sortBy: 'name', sortOrder: 'asc' })
  },
  priceRange: {
    type: Object,
    default: () => ({ min: 0, max: 1000 })
  },
  isHorizontal: { type: Boolean, default: false },
  productCount: { type: Object, default: () => null },
  filteredCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  showProductCount: { type: Boolean, default: true }
})

//- ============================================
//- Emits
//- ============================================
const emit = defineEmits([
  'update:filters',
  'update:sort',
  'update:searchQuery',
  'reset-filters',
  'scroll-to-top'
])

//- ============================================
//- Refs
//- ============================================
const sortRef = ref(null)
const categoriesRef = ref(null)
const priceRangeRef = ref(null)

//- ============================================
//- Debounce helper
//- ============================================
let filterDebounceTimer = null

const debouncedEmit = (event, data) => {
  if (filterDebounceTimer) clearTimeout(filterDebounceTimer)
  filterDebounceTimer = setTimeout(() => {
    emit(event, data)
  }, 50) // 50ms debounce
}

//- ============================================
//- Computed properties
//- ============================================
const safeSearchQuery = computed(() => props.searchQuery || '')

//- Кэшированная сортировка категорий (вычисляется один раз при изменении)
const sortedCategories = computed(() => {
  const categories = Array.isArray(props.categories) ? props.categories : []
  if (categories.length === 0) return []
  
  // Сортируем по длине, потом по алфавиту
  return [...categories].sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length
    return a.localeCompare(b)
  })
})

const safeFilters = computed(() => {
  const defaultFilters = {
    categories: [],
    priceRange: { min: null, max: null },
    onlyInStock: false,
    onlyFavorites: false
  }
  
  if (!props.filters || typeof props.filters !== 'object') return defaultFilters
  
  return {
    categories: Array.isArray(props.filters.categories) ? props.filters.categories : [],
    priceRange: props.filters.priceRange && typeof props.filters.priceRange === 'object'
      ? { 
          min: props.filters.priceRange.min ?? null,
          max: props.filters.priceRange.max ?? null
        }
      : defaultFilters.priceRange,
    onlyInStock: Boolean(props.filters.onlyInStock),
    onlyFavorites: Boolean(props.filters.onlyFavorites)
  }
})

const safeSort = computed(() => {
  const defaultSort = { sortBy: 'name', sortOrder: 'asc' }
  if (!props.sort || typeof props.sort !== 'object') return defaultSort
  
  return {
    sortBy: props.sort.sortBy || defaultSort.sortBy,
    sortOrder: props.sort.sortOrder || defaultSort.sortOrder
  }
})

const safePriceRange = computed(() => {
  const defaultRange = { min: 0, max: 1000 }
  if (!props.priceRange || typeof props.priceRange !== 'object') return defaultRange
  
  return {
    min: Number(props.priceRange.min) || defaultRange.min,
    max: Number(props.priceRange.max) || defaultRange.max
  }
})

const safeProductCount = computed(() => {
  if (props.productCount && typeof props.productCount === 'object') {
    return {
      total: Number(props.productCount.total) || 0,
      filtered: Number(props.productCount.filtered) || 0,
      showing: Number(props.productCount.showing) || 0
    }
  }
  
  return {
    total: Number(props.totalCount) || 0,
    filtered: Number(props.filteredCount) || 0,
    showing: Number(props.filteredCount) || 0
  }
})

const shouldShowProductCount = computed(() => true)

const productCountText = computed(() => {
  const { total, filtered, showing } = safeProductCount.value
  
  if (total === 0 && filtered === 0 && showing === 0) return '...'
  if (showing > 0 && showing !== filtered) return `${showing} из ${filtered}`
  if (filtered !== total && filtered > 0) return `${filtered} из ${total}`
  return `${total}`
})

const activeFiltersCount = computed(() => {
  let count = 0
  if (safeFilters.value.categories?.length > 0) count++
  if (safeFilters.value.priceRange?.min !== null || safeFilters.value.priceRange?.max !== null) count++
  if (safeFilters.value.onlyInStock) count++
  if (safeFilters.value.onlyFavorites) count++
  return count
})

//- ============================================
//- Обработчики с debounce
//- ============================================
const updateFilter = (key, value) => {
  const newFilters = { ...safeFilters.value }
  
  if (key === 'priceRange') {
    newFilters.priceRange = value && typeof value === 'object' ? value : { min: null, max: null }
  } else if (key === 'categories') {
    newFilters.categories = Array.isArray(value) ? value : []
  } else if (key === 'onlyInStock') {
    newFilters.onlyInStock = Boolean(value)
  } else if (key === 'onlyFavorites') {
    newFilters.onlyFavorites = Boolean(value)
  }
  
  emit('update:filters', newFilters)
}

//- Обработчики с debounce и scroll
const handlePriceRangeUpdate = (value) => {
  updateFilter('priceRange', value)
  nextTick(() => emit('scroll-to-top'))
}

const handleCategoriesUpdate = (categories) => {
  updateFilter('categories', categories)
  nextTick(() => emit('scroll-to-top'))
}

const handleSortChange = (sort) => {
  if (sort && typeof sort === 'object') {
    emit('update:sort', {
      field: sort.field || 'name',
      order: sort.order || 'asc'
    })
    nextTick(() => emit('scroll-to-top'))
  }
}

//- ============================================
//- Сброс фильтров
//- ============================================
const resetAllFilters = () => {
  // Сбрасываем через refs если есть методы
  if (categoriesRef.value?.resetCategories) {
    categoriesRef.value.resetCategories()
  }
  if (priceRangeRef.value?.resetPriceRange) {
    priceRangeRef.value.resetPriceRange()
  }
  
  const emptyFilters = {
    categories: [],
    priceRange: { min: null, max: null },
    onlyInStock: false,
    onlyFavorites: false
  }
  
  emit('update:filters', emptyFilters)
  emit('reset-filters')
  nextTick(() => emit('scroll-to-top'))
}

//- ============================================
//- Lifecycle
//- ============================================
onMounted(() => {
  // Убраны console.log для production
})
</script>