<!-- app/components/products/ProductFilter.vue — тело фильтров (без шапки
     и сортировки: сортировка — отдельный элемент над сеткой, паттерн
     маркетплейсов). Секции: цена, категории, в наличии/избранное.
     Горизонтальные ветки isHorizontal удалены (мёртвые с чистки
     боковой навигации). Используется в DesktopSidebar и MobileFiltersPanel. -->
<template lang="pug">
.product-filter.h-full.border-none.select-none
  //- Основной контейнер
  .filter-content.flex.flex-1.min-h-0.overflow-hidden
    .vertical-layout.flex.flex-col.flex-1.min-h-0.gap-4.overflow-y-auto.overflow-x-hidden(class="pr-1")
      //- Диапазон цен
      .filter-section
        ProductPriceRange(
          ref="priceRangeRef"
          :minPrice="safePriceRange.min"
          :maxPrice="safePriceRange.max"
          :currentMin="safeFilters.priceRange.min"
          :currentMax="safeFilters.priceRange.max"
          @update:priceRange="handlePriceRangeUpdate"
          :compact="compact"
        )

      //- Категории (чекбокс-чипы с подсветкой поиска)
      .filter-section
        ProductCategories(
          ref="categoriesRef"
          :categories="sortedCategories"
          :selectedCategories="safeFilters.categories"
          @update:selectedCategories="handleCategoriesUpdate"
          :searchQuery="safeSearchQuery"
        )

      //- Быстрые фильтры: наличие и избранное (раньше были в стейте,
      //- но без UI — мёртвые; теперь живые чекбоксы)
      .filter-section(class="pb-2")
        label.quick-filter.flex.items-center.gap-3.cursor-pointer.select-none(
          class="py-1"
        )
          input.checkbox.checkbox-sm.checkbox-primary(
            type="checkbox"
            :checked="safeFilters.onlyInStock"
            @change="updateFilter('onlyInStock', $event.target.checked)"
          )
          span.text-sm.text-base-content Только в наличии

        label.quick-filter.flex.items-center.gap-3.cursor-pointer.select-none(
          class="py-1"
        )
          input.checkbox.checkbox-sm.checkbox-error(
            type="checkbox"
            :checked="safeFilters.onlyFavorites"
            @change="updateFilter('onlyFavorites', $event.target.checked)"
          )
          span.text-sm.text-base-content Только избранное
</template>

<style scoped>
/* КРИТИЧНО ДЛЯ ПРОКРУТКИ (панель/сайдбар задают высоту снаружи) */
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

.vertical-layout::-webkit-scrollbar {
  width: 6px;
}

.vertical-layout::-webkit-scrollbar-track {
  background: var(--color-base-300);
  border-radius: 3px;
}

.vertical-layout::-webkit-scrollbar-thumb {
  background: var(--color-primary);
  border-radius: 3px;
}
</style>

<script setup>
//- ============================================
//- Props. isHorizontal удалён (мёртвые ветки); сортировка переехала
//- в ProductSortBar над сеткой (паттерн маркетплейсов)
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
      onlyFavorites: false,
    }),
  },
  priceRange: {
    type: Object,
    default: () => ({ min: 0, max: 1000 }),
  },
  compact: { type: Boolean, default: false },
  filteredCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
})

const emit = defineEmits(['update:filters'])

//- Refs
const priceRangeRef = ref(null)
const categoriesRef = ref(null)

//- Debounce для частых обновлений
let filterDebounceTimer = null
const debouncedEmit = (data) => {
  if (filterDebounceTimer) clearTimeout(filterDebounceTimer)
  filterDebounceTimer = setTimeout(() => emit('update:filters', data), 50)
}

//- ============================================
//- Computed (safe-обёртки)
//- ============================================
const safeSearchQuery = computed(() => props.searchQuery || '')

const sortedCategories = computed(() => {
  const categories = Array.isArray(props.categories) ? props.categories : []
  return [...categories].sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length
    return a.localeCompare(b)
  })
})

const safeFilters = computed(() => ({
  categories: Array.isArray(props.filters?.categories) ? props.filters.categories : [],
  priceRange: props.filters?.priceRange
    ? {
        min: props.filters.priceRange.min ?? null,
        max: props.filters.priceRange.max ?? null,
      }
    : { min: null, max: null },
  onlyInStock: Boolean(props.filters?.onlyInStock),
  onlyFavorites: Boolean(props.filters?.onlyFavorites),
}))

const safePriceRange = computed(() => ({
  min: Number(props.priceRange?.min) || 0,
  max: Number(props.priceRange?.max) || 1000,
}))

//- ============================================
//- Обработчики
//- ============================================
const updateFilter = (key, value) => {
  const newFilters = { ...safeFilters.value }

  if (key === 'priceRange') {
    newFilters.priceRange = value ?? { min: null, max: null }
  } else if (key === 'categories') {
    newFilters.categories = Array.isArray(value) ? value : []
  } else if (key === 'onlyInStock') {
    newFilters.onlyInStock = Boolean(value)
  } else if (key === 'onlyFavorites') {
    newFilters.onlyFavorites = Boolean(value)
  }

  debouncedEmit(newFilters)
}

const handlePriceRangeUpdate = (value) => updateFilter('priceRange', value)
const handleCategoriesUpdate = (categories) => updateFilter('categories', categories)

//- Сброс тела фильтров (кнопка «Сбросить всё» живёт снаружи — в чипах/подвале)
const resetFilters = () => {
  if (categoriesRef.value?.resetCategories) categoriesRef.value.resetCategories()
  if (priceRangeRef.value?.resetPriceRange) priceRangeRef.value.resetPriceRange()

  emit('update:filters', {
    categories: [],
    priceRange: { min: null, max: null },
    onlyInStock: false,
    onlyFavorites: false,
  })
}

defineExpose({ resetFilters })
</script>