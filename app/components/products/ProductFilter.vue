<!-- app/components/products/ProductFilter.vue — тело фильтров (без шапки
     и сортировки: сортировка — отдельный элемент над сеткой, паттерн
     маркетплейсов). Секции: цена, категории, характеристики.
     Быстрые фильтры («Только в наличии») здесь НЕ рендерятся: оба
     родителя (DesktopSidebar и MobileFiltersPanel) закрепляют их внизу
     отдельно, вне скролла — паттерн маркетплейсов.
     ЕДИНАЯ flex-модель для десктопа И мобильного (одни и те же CSS):
     категории сначала разворачиваются по максимуму — секция своей
     высоты, развёрнутый список при переполнении скроллится внутри
     секции; ХАРАКТЕРИСТИКИ забирают остаток высоты панели — их
     содержимое прижато к низу, к закреплённому «Только в наличии»;
     секция не сжимается ниже содержимого (минимум текущих строк).
     Шапки «Фильтры» на десктопе нет (убрана по требованию
     пользователя — всё поднято к верху сайдбара).
     Горизонтальные ветки isHorizontal удалены (мёртвые с чистки
     боковой навигации). Используется в DesktopSidebar и MobileFiltersPanel. -->
<template lang="pug">
.product-filter.h-full.border-none.select-none
  //- Основной контейнер (шапки «Фильтры» на десктопе больше нет)
  .filter-content.flex.flex-1.min-h-0.overflow-hidden
    .vertical-layout.flex.flex-col.flex-1.min-h-0.gap-2.overflow-y-auto.overflow-x-hidden(class="pr-1")
      //- Диапазон цен
      .filter-section
        ProductPriceRange(
          :minPrice="safePriceRange.min"
          :maxPrice="safePriceRange.max"
          :currentMin="safeFilters.priceRange.min"
          :currentMax="safeFilters.priceRange.max"
          @update:priceRange="handlePriceRangeUpdate"
          :compact="compact"
        )

      //- Категории (чекбокс-чипы с подсветкой поиска). Разворачиваются
      //- по максимуму: своя высота, пока помещаются; не помещается —
      //- внутренний скролл списка внутри секции
      .filter-section.filter-section--categories
        ProductCategories(
          :categories="sortedCategories"
          :selectedCategories="safeFilters.categories"
          @update:selectedCategories="handleCategoriesUpdate"
          :searchQuery="safeSearchQuery"
        )

      //- Характеристики (фасеты по свойствам товаров текущей выборки:
      //- выбрал категорию — получил её характеристики, паттерн WB/Ozon).
      //- Забирают СВОБОДНУЮ высоту после категорий (flex-grow), содержимое
      //- прижато к низу, к закреплённому «Только в наличии» (CSS) —
      // и на десктопе, и на мобильном
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

/* ── Единое распределение высоты (десктоп-сайдбар И мобильная панель).
   Приоритет: категории разворачиваются по максимуму (секция своей
   высоты, переполнение — внутренний скролл списка), ХАРАКТЕРИСТИКИ
   забирают остаток (flex-grow), их содержимое прижато к низу —
   к закреплённому «Только в наличии»; секция характеристик не
   сжимается ниже содержимого и не обрезается. Цена — своей высоты. */
.filter-section {
  flex-shrink: 0; /* цена и соседи не сжимаются — дефицит высоты уходит в скролл тела */
}

.filter-section--categories {
  flex: 0 1 auto; /* растёт только до содержимого; под давлением дефицита — сжимается */
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.filter-section--categories :deep(.product-categories) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.filter-section--categories :deep(.categories-list) {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-primary) var(--color-base-300);
}

.filter-section--categories :deep(.categories-list::-webkit-scrollbar) {
  width: 6px;
}

.filter-section--categories :deep(.categories-list::-webkit-scrollbar-track) {
  background: var(--color-base-300);
  border-radius: 3px;
}

.filter-section--categories :deep(.categories-list::-webkit-scrollbar-thumb) {
  background: var(--color-primary);
  border-radius: 3px;
}

.filter-section--specs {
  flex-grow: 1; /* забирает всю пустоту панели ПОСЛЕ разворота категорий */
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
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

//- Debounce для частых обновлений. Снимок фильтров берём В МОМЕНТ эмита,
//- а не при клике: дочерние колбэки (например, сброс диапазона из
//- resetPriceRange) срабатывают в тот же тик, что и другие изменения —
//- снимок по клику унёс бы устаревшие props (гонка «изменение → призрак
//- старых значений»).
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

//- ============================================
//- Обработчики
//- ============================================
const handlePriceRangeUpdate = (value) => updateFilter('priceRange', value)
const handleCategoriesUpdate = (categories) => updateFilter('categories', categories)
const handleSpecsUpdate = (specs) => updateFilter('specs', specs)
</script>