<!-- components/layout/DesktopSidebar.vue — сайдбар фильтров каталога
    (только десктоп: в index.vue стоит v-if="!isMobile").
    Пропс isHorizontal удалён: раньше им включали горизонтальную
    компоновку ProductFilter для мобильного сайдбара — с тех пор,
    как сайдбар спрятали на мобильных, пропс стал мёртвым
    (и передавал isMobile вместо ориентации — след рефакторингов). -->
<template lang="pug">
aside.desktop-sidebar.bg-base-100.rounded-box.shadow-sm(
  :class="sidebarClasses"
)
  ProductFilter(
    :total-count="totalCount"
    :filtered-count="filteredCount"
    :show-product-count="true"
    :searchQuery="searchQuery"
    :categories="categories"
    :filters="filters"
    :priceRange="priceRange"
    @update:filters="handleFiltersUpdate"
    @update:searchQuery="handleSearchQueryUpdate"
    @reset-filters="handleResetFilters"
    @scroll-to-top="handleScrollToTop"
  )
</template>

<style scoped>
.desktop-sidebar {
  scrollbar-width: thin;
  scrollbar-color: color-mix(in oklab, var(--color-base-content) 20%, transparent) transparent;
}

.desktop-sidebar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.desktop-sidebar::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.desktop-sidebar::-webkit-scrollbar-thumb {
  background: color-mix(in oklab, var(--color-base-content) 20%, transparent);
  border-radius: 3px;
}

.desktop-sidebar::-webkit-scrollbar-thumb:hover {
  background: color-mix(in oklab, var(--color-base-content) 30%, transparent);
}
</style>

<script setup>
//- ProductFilter автоимпортится Nuxt.
//- isMobile больше не нужен: сайдбар рендерится ТОЛЬКО на десктопе
//- (v-if="!isMobile" в index.vue), мобильная ветка стилей удалена

//- Sticky под шапкой сайта (56px): фиксированная высота с внутренним
//- скроллом, чтобы фильтры не уезжали за экран
const sidebarClasses = ['sticky', 'top-16', 'h-[calc(100dvh-5rem)]', 'overflow-y-auto']

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

defineProps({
  searchQuery: { type: String, default: '' },
  categories: { type: Array, default: () => [] },
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
</script>