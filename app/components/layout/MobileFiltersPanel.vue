<!-- components/layout/MobileFiltersPanel.vue — мобильная панель фильтров:
    bottom-sheet (прижата к низу, шапка + скроллящееся тело + подвал с
    кнопкой «Показать N»). Канонический паттерн маркетплейсов.
    ⚠️ Панель — flex-колонка с max-height: тело (.filters-content) получает
    остаток высоты и скроллится. Раньше стилей не было вовсе: overflow-y-auto
    без высоты не работал, body заблокирован — длинный список (фасеты
    характеристик) был недоступен по прокрутке. -->
<template lang="pug">
.mobile-filters-wrapper(class="md:hidden")
  .mobile-filters-overlay(@click="handleClose")

  .mobile-filters-panel(
    role="dialog"
    aria-modal="true"
    :aria-label="$t('catalog.filtersAria')"
  )
    //- Ручка bottom-sheet (визуальный affordance)
    .sheet-handle

    //- Шапка панели
    .filters-header.flex.items-center.justify-between.gap-2(
      class="bg-base-100 px-3 py-2 border-base-300 border-b"
    )
      button.btn.btn-ghost.btn-sm.rounded-xl(
        class="text-base-content/70"
        type="button"
        @click="handleReset"
      ) {{ $t('catalog.reset') }}

      h2.text-sm.font-semibold.text-base-content.truncate {{ $t('catalog.filtersTitle') }}

      button.btn.btn-ghost.btn-sm.btn-circle(
        type="button"
        :aria-label="$t('catalog.close')"
        @click="handleClose"
      )
        svg.w-5.h-5(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12")

    //- Тело: ProductFilter (цена, категории, характеристики, чекбоксы).
    //- Единственный скроллящийся регион панели
    .filters-content(
      class="bg-base-100 px-3 py-2"
    )
      ProductFilter(
        :searchQuery="searchQuery"
        :categories="categories"
        :specFacets="specFacets"
        :filters="filters"
        :priceRange="priceRange"
        :filtered-count="filteredCount"
        :total-count="totalCount"
        @update:filters="emit('update:filters', $event)"
      )

    //- Подвал: главная кнопка с счётчиком (паттерн WB) — всегда видна,
    //- скроллится только тело панели
    .filters-footer(class="bg-base-100 border-base-300 border-t")
      button.btn.btn-primary.w-full.rounded-xl(
        type="button"
        @click="handleApplyAndClose"
      )
        span {{ $t('catalog.showCount', filteredCount) }}

      //- Кнопка «Применить» из прежней шапки — для непустого результата
      button.btn.btn-ghost.btn-sm.w-full.mt-1(
        type="button"
        v-if="filteredCount === 0 && totalCount > 0"
        @click="handleClose"
      ) {{ $t('catalog.closeShowAll', { n: totalCount }) }}
</template>

<style scoped>
/* ── Оверлей: панель прижата к низу ─────────────────────────── */
.mobile-filters-wrapper {
  position: fixed;
  inset: 0;
  /* Выше нижней навигации (z-60, см. карту z-index в MobileNavFooter):
    иначе nav перекрывает подвал панели с кнопкой «Показать N» */
  z-index: 70;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  background: rgb(0 0 0 / 0.45);
}

.mobile-filters-overlay {
  position: absolute;
  inset: 0;
}

/* ── Панель: flex-колонка фиксированной высоты ─────────────────
   Высота ЗАДАНА (а не только max-height): внутри неё flex-1/min-h-0
   тела дают определённый остаток, и .product-filter { height:100% }
   не схлопывается в ноль. 88dvh — как у маркетплейсов: шапка сайта
   чуть видна сверху, контекст не теряется. */
.mobile-filters-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 88vh;
  height: min(88dvh, 100%);
  background: var(--color-base-100);
  border-radius: 1.25rem 1.25rem 0 0;
  box-shadow: 0 -10px 40px rgb(0 0 0 / 0.22);
  overflow: hidden;
  /* Въезд снизу: только transform/opacity (правила экономии main.css) */
  animation: sheet-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes sheet-in {
  from {
    transform: translateY(7%);
    opacity: 0.5;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.sheet-handle {
  width: 2.5rem;
  height: 0.25rem;
  margin: 0.5rem auto 0.15rem;
  border-radius: 999px;
  background: var(--color-base-300);
  flex-shrink: 0;
}

/* ── Тело: единственный скроллящийся регион ─────────────────── */
.filters-content {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain; /* прокрутка не «протекает» в подложку */
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in oklab, var(--color-base-content) 20%, transparent)
    transparent;
}

/* ── Шапка и подвал: зафиксированы flex-колонкой ─────────────── */
.filters-header,
.filters-footer {
  flex-shrink: 0;
}

.filters-footer {
  padding: 0.75rem 1rem;
  padding-bottom: calc(0.75rem + var(--safe-area-bottom, 0px));
}
</style>

<script setup>
//- Bottom-sheet панель фильтров. ProductFilter автоимпортится.
//- Сортировка не здесь — она в ProductSortBar над сеткой
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
  'close',
  'update:filters',
  'reset-filters',
  'scroll-to-top',
])

//- Русские формы слова «товар» теперь через vue-i18n plural
//- (catalog.showCount + pluralRules ru в i18n/i18n.config.ts)

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
