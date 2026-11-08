<!-- components/layout/DesktopSidebar.vue — сайдбар фильтров каталога
    (только десктоп: в index.vue стоит v-if="!isMobile", CSS показывает
    его с ≥1025px). Растянут на всё пространство под хедером (grid-stretch,
    без sticky и calc-высот): тело (цена, категории, характеристики)
    скроллится внутри, а «Только в наличии» закреплён внизу — как в
    мобильной панели (паттерн маркетплейсов).
    Пропс isHorizontal удалён: раньше им включали горизонтальную
    компоновку ProductFilter для мобильного сайдбара — с тех пор,
    как сайдбар спрятали на мобильных, пропс стал мёртвым
    (и передавал isMobile вместо ориентации — след рефакторингов). -->
<template lang="pug">
aside.desktop-sidebar.bg-base-100.rounded-box.shadow-sm
  .sidebar-inner(class="h-full flex flex-col overflow-hidden")
    //- Тело: ProductFilter (цена, категории, характеристики).
    //- Единственный скроллящийся регион — .vertical-layout внутри
    .sidebar-body(class="flex-1 min-h-0")
      ProductFilter(
        :total-count="totalCount"
        :filtered-count="filteredCount"
        :show-product-count="true"
        :searchQuery="searchQuery"
        :categories="categories"
        :specFacets="specFacets"
        :filters="filters"
        :priceRange="priceRange"
        @update:filters="handleFiltersUpdate"
        @update:searchQuery="handleSearchQueryUpdate"
        @reset-filters="handleResetFilters"
        @scroll-to-top="handleScrollToTop"
      )

    //- «Только в наличии» закреплён внизу сайдбара — всегда виден,
    //- как в мобильной панели (паттерн маркетплейсов)
    .sidebar-quick(class="flex-shrink-0 border-t border-base-200 px-1 py-1")
      ProductQuickFilters(
        :filters="filters"
        @change="handleQuickFilter"
      )
</template>

<script setup>
//- ProductFilter и ProductQuickFilters автоимпортятся Nuxt.
//- isMobile больше не нужен: сайдбар рендерится ТОЛЬКО на десктопе
//- (v-if="!isMobile" в index.vue), мобильная ветка стилей удалена.
//- Высота сайдбара задаётся grid-стрейчем (.sidebar-area растянут
//- на всё пространство между хедером и низом экрана) — sticky и
//- calc-высоты больше не нужны.

//- Обработчик обновления фильтров (сохраняем сортировку)
const handleFiltersUpdate = (filters) => {
  emit('update:filters', filters)
}

const handleSearchQueryUpdate = (query) => {
  emit('update:searchQuery', query)
}

//- Сброс фильтров (БЕЗ сброса сортировки)
const handleResetFilters = () => {
  emit('reset-filters')
}

const handleScrollToTop = () => {
  emit('scroll-to-top')
}

const props = defineProps({
  searchQuery: { type: String, default: '' },
  categories: { type: Array, default: () => [] },
  specFacets: { type: Array, default: () => [] },
  filters: { type: Object, default: () => ({}) },
  priceRange: { type: Object, default: () => ({}) },
  totalCount: { type: Number, default: 0 },
  filteredCount: { type: Number, default: 0 },
})

const emit = defineEmits([
  'update:filters',
  'update:searchQuery',
  'reset-filters',
  'scroll-to-top',
])

//- Быстрый фильтр «В наличии» из закреплённого блока: обновляем ОДИН
//- ключ в снимке фильтров и отдаём наверх — как в MobileFiltersPanel
const handleQuickFilter = (key, value) => {
  emit('update:filters', { ...props.filters, [key]: value })
}
</script>
