<!-- app/components/products/ProductFilter.vue — тело фильтров (без шапки
     и сортировки: сортировка — отдельный элемент над сеткой, паттерн
     маркетплейсов). Секции: цена, категории, характеристики.
     Быстрые фильтры («Только в наличии») здесь НЕ рендерятся: оба
     родителя (DesktopSidebar и MobileFiltersPanel) закрепляют их внизу
     отдельно, вне скролла — паттерн маркетплейсов. На десктопе (≥1025px)
     остаток высоты сайдбара забирает секция характеристик: категории
     идут по содержимому, и пустота уходит к низу сайдбара, а не
     повисает между секциями.
     Горизонтальные ветки isHorizontal удалены (мёртвые с чистки
     боковой навигации). Используется в DesktopSidebar и MobileFiltersPanel. -->
<template lang="pug">
.product-filter.h-full.border-none.select-none
  //- Десктопная шапка сайдбара: название + сброс (на мобильных своя
  //- шапка в bottom-sheet — здесь не дублируем)
  .filter-header.flex.items-center.justify-between.min-h-8.mb-1(
    class="hidden lg:flex"
  )
    h4.section-title.text-sm.font-semibold.text-base-content {{ $t('catalog.filtersTitle') }}
    button.btn.btn-ghost.btn-xs.gap-1.rounded-lg(
      v-if="hasActiveFilters"
      type="button"
      @click="resetFilters"
      class="text-base-content/60"
    )
      svg.w-3.h-3(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
        path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12")
      | {{ $t('catalog.reset') }}

  //- Основной контейнер
  .filter-content.flex.flex-1.min-h-0.overflow-hidden
    .vertical-layout.flex.flex-col.flex-1.min-h-0.gap-2.overflow-y-auto.overflow-x-hidden(class="pr-1")
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

      //- Категории (чекбокс-чипы с подсветкой поиска). Высота — по
      //- содержимому: свободное место забирает секция характеристик
      .filter-section
        ProductCategories(
          ref="categoriesRef"
          :categories="sortedCategories"
          :selectedCategories="safeFilters.categories"
          @update:selectedCategories="handleCategoriesUpdate"
          :searchQuery="safeSearchQuery"
        )

      //- Характеристики (фасеты по свойствам товаров текущей выборки:
      //- выбрал категорию — получил её характеристики, паттерн WB/Ozon).
      //- На десктопе дорастягиваются до низа сайдбара (flex-grow в CSS)
      .filter-section.filter-section--specs
        ProductSpecFilters(
          :facets="specFacets"
          :selected="safeFilters.specs"
          @update:selected="handleSpecsUpdate"
        )

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

/* Разделители секций: структура без коробок, компактнее вертикальных зазоров */
.filter-section + .filter-section {
  border-top: 1px solid var(--color-base-200);
  padding-top: 0.6rem;
}

/* Остаток высоты сайдбара забирает секция «Характеристики»: только
   десктоп (≥1025px — там сайдбар растянут под хедером), мобильную
   панель не трогаем. Категории идут по содержимому: при коротком
   списке пустота уходит вниз сайдбара, к закреплённому «Только
   в наличии», а не повисает между секциями; при длинном — обычный
   скролл всего тела. */
@media (min-width: 1025px) {
  .filter-section--specs {
    flex-grow: 1;
  }
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
  specFacets: { type: Array, default: () => [] },
  filters: {
    type: Object,
    default: () => ({
      categories: [],
      priceRange: { min: null, max: null },
      onlyInStock: false,
      onlyFavorites: false,
      specs: {},
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

//- Debounce для частых обновлений. Снимок фильтров берём В МОМЕНТ эмита,
//- а не при клике: дочерние колбэки (например, сброс диапазона из
//- resetPriceRange) срабатывают в тот же тик, что и наш emit «сбросить всё» —
//- props родителя ещё старые, и снимок унёс бы ОБРАТНО то, что сброс
//- только что очистил (гонка «сброс → призрак старых фильтров»).
let filterDebounceTimer = null
//- Изменения копятся ПО КЛЮЧАМ: быстрые клики по разым фильтрам в окне
//- дебаунса не теряют друг друга (последнее значение каждого ключа)
const pendingUpdates = new Map()

/** Применяет изменение одного ключа к снимку фильтров. */
const applyKey = (filters, key, value) => {
  if (key === 'priceRange') {
    filters.priceRange = value ?? { min: null, max: null }
  } else if (key === 'categories') {
    filters.categories = Array.isArray(value) ? value : []
  } else if (key === 'onlyInStock') {
    filters.onlyInStock = Boolean(value)
  } else if (key === 'onlyFavorites') {
    filters.onlyFavorites = Boolean(value)
  } else if (key === 'specs') {
    filters.specs = value && typeof value === 'object' ? value : {}
  }
  return filters
}

const updateFilter = (key, value) => {
  pendingUpdates.set(key, value)
  if (filterDebounceTimer) clearTimeout(filterDebounceTimer)
  filterDebounceTimer = setTimeout(() => {
    if (pendingUpdates.size === 0) return
    let snapshot = { ...safeFilters.value }
    for (const [pendingKey, pendingValue] of pendingUpdates) {
      applyKey(snapshot, pendingKey, pendingValue)
    }
    pendingUpdates.clear()
    emit('update:filters', snapshot)
  }, 50)
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
  specs:
    props.filters?.specs && typeof props.filters.specs === 'object'
      ? props.filters.specs
      : {},
}))

const safePriceRange = computed(() => ({
  min: Number(props.priceRange?.min) || 0,
  max: Number(props.priceRange?.max) || 1000,
}))

//- Есть ли хоть один активный фильтр (кнопка «Сбросить» в шапке сайдбара)
const hasActiveFilters = computed(() => {
  const f = safeFilters.value
  if (f.categories.length > 0) return true
  if (f.onlyInStock || f.onlyFavorites) return true
  if (f.priceRange.min !== null || f.priceRange.max !== null) return true
  return Object.values(f.specs).some(
    (values) => Array.isArray(values) && values.length > 0,
  )
})

//- ============================================
//- Обработчики
//- ============================================
const handlePriceRangeUpdate = (value) => updateFilter('priceRange', value)
const handleCategoriesUpdate = (categories) => updateFilter('categories', categories)
const handleSpecsUpdate = (specs) => updateFilter('specs', specs)

//- Сброс тела фильтров (кнопка «Сбросить всё» в шапке сайдбара).
//- Отменяем отложенный debounced-эмит: иначе он через 50 мс вернул бы
//- то, что мы сейчас сбросим. Сброс самого диапазона (resetPriceRange)
//- дочки эмитит сразу — его дебаунсированный эмит ляжет уже на чистые
//- props и будет пустым no-op.
const resetFilters = () => {
  pendingUpdates.clear()
  if (filterDebounceTimer) clearTimeout(filterDebounceTimer)

  if (categoriesRef.value?.resetCategories) categoriesRef.value.resetCategories()
  if (priceRangeRef.value?.resetPriceRange) priceRangeRef.value.resetPriceRange()

  emit('update:filters', {
    categories: [],
    priceRange: { min: null, max: null },
    onlyInStock: false,
    onlyFavorites: false,
    specs: {},
  })
}

defineExpose({ resetFilters })
</script>