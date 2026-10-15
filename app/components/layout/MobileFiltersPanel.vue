<!-- components/layout/MobileFiltersPanel.vue — мобильная панель фильтров:
    bottom-sheet (выезжает снизу), sticky-подвал «Сбросить · Показать N».
    Канонический паттерн маркетплейсов вместо fullscreen-оверлея. -->
<template lang="pug">
.mobile-filters-wrapper(class="lg:hidden")
  .mobile-filters-overlay(@click="handleClose")

  .mobile-filters-panel(
    role="dialog"
    aria-modal="true"
    aria-label="Фильтры товаров"
  )
    //- Шапка панели
    .filters-header.flex.items-center.justify-between(
      class="bg-base-100 px-4 py-3 border-base-300 border-b"
    )
      button.btn.btn-ghost.btn-sm.rounded-xl(
        class="text-base-content/70"
        type="button"
        @click="handleReset"
      ) Сбросить

      h2.text-base.font-semibold.text-base-content Фильтры

      button.btn.btn-ghost.btn-sm.btn-circle(
        type="button"
        aria-label="Закрыть"
        @click="handleClose"
      )
        svg.w-5.h-5(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12")

    //- Тело: ProductFilter (цена, категории, чекбоксы)
    .filters-content.flex-1.overflow-y-auto(class="bg-base-100 px-4 py-4")
      ProductFilter(
        :searchQuery="searchQuery"
        :categories="categories"
        :filters="filters"
        :priceRange="priceRange"
        :filtered-count="filteredCount"
        :total-count="totalCount"
        @update:filters="emit('update:filters', $event)"
      )

    //- Sticky-подвал: главная кнопка с счётчиком (паттерн WB)
    .filters-footer.sticky.bottom-0(
      class="bg-base-100 px-4 py-3 pb-[calc(0.75rem+var(--safe-area-bottom,0px))] border-base-300 border-t"
    )
      button.btn.btn-primary.w-full.rounded-xl(
        type="button"
        @click="handleApplyAndClose"
      )
        span Показать {{ filteredCount }} {{ plural(filteredCount) }}

      //- Кнопка «Применить» из прежней шапки — для непустого результата
      button.btn.btn-ghost.btn-sm.w-full.mt-1(
        type="button"
        v-if="filteredCount === 0 && totalCount > 0"
        @click="handleClose"
      ) Закрыть (показать все {{ totalCount }})

    //- Ручка bottom-sheet (визуальный affordance)
    .sheet-handle
</template>

<script setup>
//- Bottom-sheet панель фильтров. ProductFilter автоимпортится.
//- Сортировка не здесь — она в ProductSortBar над сеткой
const props = defineProps({
  searchQuery: { type: String, default: '' },
  categories: { type: Array, default: () => [] },
  filters: { type: Object, default: () => ({}) },
  priceRange: { type: Object, default: () => ({}) },
  totalCount: { type: Number, default: 0 },
  filteredCount: { type: Number, default: 0 },
})

const emit = defineEmits([
  'close',
  'update:filters',
  'reset-filters',
  'scroll-to-top',
])

const plural = (n) => {
  const m10 = n % 10
  const m100 = n % 100
  if (m100 >= 11 && m100 <= 14) return 'товаров'
  if (m10 === 1) return 'товар'
  if (m10 >= 2 && m10 <= 4) return 'товара'
  return 'товаров'
}

const handleClose = () => {
  emit('close')
  setTimeout(() => emit('scroll-to-top'), 150)
}

const handleApplyAndClose = () => {
  emit('close')
  setTimeout(() => emit('scroll-to-top'), 150)
}

const handleReset = () => {
  emit('reset-filters')
}
</script>