<!-- app/components/products/ProductFilter.vue — тело фильтров (без шапки
     и сортировки: сортировка — отдельный элемент над сеткой, паттерн
     маркетплейсов). Секции: цена, категории, характеристики.
     Быстрые фильтры («Только в наличии») здесь НЕ рендерятся: оба
     родителя (DesktopSidebar и MobileFiltersPanel) закрепляют их внизу
     отдельно, вне скролла — паттерн маркетплейсов.
     ЕДИНАЯ flex-модель ДЕСКТОПА (сайдбар): категории сначала
     разворачиваются по максимуму — секция своей высоты, развёрнутый
     список при переполнении скроллится внутри секции; ХАРАКТЕРИСТИКИ
     забирают остаток высоты панели (flex-grow), ВСЕ группы рендерятся
     сразу, при переполнении список групп скроллится внутри секции,
     короткий список прижат к низу, к закреплённому «Только в
     наличии»; при дефиците высоты секция сжимается, не обрезаясь.
     МОБИЛЬНАЯ ПАНЕЛЬ — flow-режим (проп flow от MobileFiltersPanel):
     тело НЕ скроллит сам — секции растекаются своей высоты, всё
     лишнее гасит ЕДИНСТВЕННЫЙ плоский скролл родительской панели.
     Вложенные скролл-окна на тач-экране «зависают»: свайп умирает на
     границе окна, свайпы вне окна не скроллят ничего. Скроллбары
     скроллящихся списков — постоянные синие рельсы AppScrollArea
     (нативная полоса на мобильных/новых Chrome исчезает при простое
     и наезжает на контент).
     Шапки «Фильтры» на десктопе нет (убрана по требованию
     пользователя — всё поднято к верху сайдбара).
     Горизонтальные ветки isHorizontal удалены (мёртвые с чистки
     боковой навигации). Используется в DesktopSidebar и MobileFiltersPanel. -->
<template lang="pug">
.product-filter.border-none.select-none(
  :class="[flow ? '' : 'h-full', { 'product-filter--flow': flow }]"
)
  //- Основной контейнер (шапки «Фильтры» на десктопе больше нет)
  .filter-content.flex.flex-1.min-h-0.overflow-hidden
    //- Тело. Десктоп: единственный фолбэк-скролл при дефиците высоты
    //- (низкие экраны), рельса AppScrollArea. Flow (мобильный): без
    //- своего скролла и рельсы — секции растекаются в плоский скролл
    //- родительской панели
    AppScrollArea.vertical-layout(
      :flow="flow"
      :class="flow ? '' : 'flex-1'"
      contentClass="flex flex-col gap-2"
    )
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
      //- внутренний скролл списка внутри секции (десктоп) или общий
      //- скролл панели (мобильный)
      .filter-section.filter-section--categories
        ProductCategories(
          :categories="sortedCategories"
          :selectedCategories="safeFilters.categories"
          @update:selectedCategories="handleCategoriesUpdate"
          :searchQuery="safeSearchQuery"
          :flow="flow"
        )

      //- Характеристики (фасеты по свойствам товаров текущей выборки:
      //- выбрал категорию — получил её характеристики, паттерн WB/Ozon).
      //- Все группы рендерятся сразу; на десктопе забирают свободную
      //- высоту после категорий (flex-grow), при переполнении список
      //- групп скроллится внутри секции (CSS); на мобильном растекаются
      //- в общий скролл панели
      .filter-section.filter-section--specs
        ProductSpecFilters(
          :facets="specFacets"
          :selected="safeFilters.specs"
          @update:selected="handleSpecsUpdate"
          :flow="flow"
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
   Приоритет: категории разворачиваются по максимуму и НЕ сжимаются
   вовсе (flex-shrink: 0 — при дефиците высоты flex сжимает секции
   пропорционально базе, а у характеристик база огромная: без этого
   категории схлопываются в под-пиксельный срез); ХАРАКТЕРИСТИКИ
   забирают остаток (flex-grow): список групп скроллится внутри секции,
   короткий список прижат к низу — к закреплённому «Только в наличии»;
   при дефиците сжимается секция характеристик, но не ниже min-height
   (иначе на низких экранах секция исчезает целиком) — дальше фолбэк
   скролл тела. Цена — своей высоты. Скроллбары всех списков — рельсы
   AppScrollArea (нативная полоса ненадёжна: на мобильных/новых Chrome
   она overlay — исчезает при простое и рисуется поверх контента). */
.filter-section {
  flex-shrink: 0; /* цена и соседи не сжимаются — дефицит уходит в скролл тела */
}

.filter-section--categories {
  flex: 0 0 auto; /* всегда своей высоты (полный разворот), не сжимается */
  display: flex;
  flex-direction: column;
}

.filter-section--categories :deep(.product-categories) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.filter-section--categories :deep(.categories-scroll) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.filter-section--specs {
  flex: 1 1 auto; /* остаток высоты ПОСЛЕ разворота категорий; при дефиците сжимается */
  min-height: 12rem; /* пол: на низких экранах секция не должна исчезать целиком */
  display: flex;
  flex-direction: column;
  justify-content: flex-end; /* короткий список — у нижнего края, к «Только в наличии» */
}

/* ── Flow-режим (мобильная панель): тело НЕ скроллит сам — единственный
   плоский скролл живёт в родительской панели (MobileFiltersPanel).
   Секции растекаются своей высоты; у характеристик нет ни пола
   min-height, ни прижатия к низу: список групп растёт вниз, переполнение
   гасит скролл РОДИТЕЛЯ. Вложенные окна на таче зависают — их тут нет */
.product-filter--flow {
  height: auto;
}

.product-filter--flow .filter-content {
  flex: 0 0 auto;
  /* overflow visible ОБЯЗАТЕЛЕН: overflow-hidden делает .filter-content
     ближайшим скролл-контейнером для position:sticky — липкие шапки
     секций («Категории», «Характеристики») прилипали бы к нему, а он
     никогда не скроллит → шапки не прилипают вовсе */
  overflow: visible;
}

.product-filter--flow .filter-section--specs {
  flex: 0 0 auto;
  min-height: 0;
  justify-content: flex-start;
}

.filter-section--specs :deep(.product-spec-filters) {
  flex: 0 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.filter-section--specs :deep(.product-spec-filters .section-header) {
  flex-shrink: 0;
}

/* Список групп характеристик: скроллится внутри секции (переполнение
   и постоянную рельсу задаёт AppScrollArea, здесь — только место
   во flex-колонке секции) */
.filter-section--specs :deep(.spec-groups) {
  flex: 0 1 auto;
  min-height: 0;
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
  //- Flow-режим (мобильная панель): тело без своих скроллов — единый
  //- плоский скролл живёт в родителе. Десктоп (false): flex-модель с
  //- внутренними скроллами секций
  flow: { type: Boolean, default: false },
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