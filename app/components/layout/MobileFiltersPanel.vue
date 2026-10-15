<!-- components/layout/MobileFiltersPanel.vue — мобильная панель фильтров
    (полноэкранный оверлей). Горизонтальные варианты удалены вместе
    с боковой навигацией. -->
<template lang="pug">
.mobile-filters-wrapper(class="lg:hidden")
  .mobile-filters-overlay(@click="handleClose")
  .mobile-filters-panel
    .filters-header.flex.items-center.justify-between.p-4.bg-base-100.border-b.border-base-300(
      class="sm:px-3 sm:py-1"
    )
      .flex.items-center
        h2.text-lg.font-bold.text-base-content(class="hidden sm:block")

      .flex.items-center.gap-2
        //- Кнопка «Применить» — закрывает панель и скроллит к товарам
        button.btn.btn-info.btn-sm.rounded-lg(
          type="button"
          @click="handleApplyAndClose"
          class="px-3 py-1"
        )
          span.text-xs.text-white Применить

    .filters-content.p-4.bg-base-100.overflow-y-auto(class="sm:p-1")
      ProductFilter(
        :total-count="totalCount"
        :filtered-count="filteredCount"
        :show-product-count="true"
        :searchQuery="searchQuery"
        :categories="categories"
        :filters="filters"
        :sort="sort"
        :priceRange="priceRange"
        @update:filters="handleFiltersUpdate"
        @update:sort="handleSortUpdate"
        @update:searchQuery="handleSearchQueryUpdate"
        @reset-filters="handleResetFilters"
        @scroll-to-top="handleScrollToTop"
      )
</template>

<script setup>
//- ProductFilter автоимпортится Nuxt.
//- Система ориентации удалена (боковой навигации больше нет);
//- console.log на каждое действие фильтрами убраны

//- Обработчик обновления фильтров (панель НЕ закрываем —
//- пользователь видит пересчёт счётчика в реальном времени)
const handleFiltersUpdate = (filters) => {
  emit('update:filters', filters)
}

const handleSortUpdate = (sort) => {
  emit('update:sort', sort)
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

//- «Применить и закрыть»: закрыть панель, затем плавно к товарам
const handleApplyAndClose = () => {
  emit('close')
  // Небольшая задержка: дать DOM обновиться после закрытия панели
  setTimeout(() => {
    emit('scroll-to-top')
  }, 150)
}

const handleClose = () => {
  emit('close')
}

defineProps({
  searchQuery: { type: String, default: '' },
  categories: { type: Array, default: () => [] },
  filters: { type: Object, default: () => ({}) },
  sort: { type: Object, default: () => ({}) },
  priceRange: { type: Object, default: () => ({}) },
  totalCount: { type: Number, default: 0 },
  filteredCount: { type: Number, default: 0 },
})

const emit = defineEmits([
  'close',
  'update:filters',
  'update:sort',
  'update:searchQuery',
  'reset-filters',
  'scroll-to-top',
])
</script>