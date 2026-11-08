<!-- components/layout/MobileFiltersPanel.vue — мобильная панель фильтров:
    ПОЛНЫЙ ЭКРАН (по требованию пользователя; раньше был bottom-sheet
    88dvh): шапка + скроллящееся тело + подвал с кнопкой «Показать N».
    Канонический паттерн маркетплейсов — фильтры отдельной «страницей».
    ТЕЛО — ЕДИНСТВЕННЫЙ ПЛОСКИЙ СКРОЛЛ (AppScrollArea с постоянной
    синей рельсой): цена, категории, характеристики растекаются одной
    лентой (ProductFilter flow), БЕЗ вложенных скролл-окон — на таче
    они «зависают»: свайп умирает на границе вложенного окна, а свайпы
    вне окна не скроллят ничего. ⚠️ Панель — flex-колонка на всю
    высоту: тело получает остаток высоты и скроллится, шапка/подвал
    зафиксированы. -->
<template lang="pug">
.mobile-filters-wrapper(class="md:hidden")
  .mobile-filters-overlay(@click="handleClose")

  .mobile-filters-panel(
    role="dialog"
    aria-modal="true"
    :aria-label="$t('catalog.filtersAria')"
  )
    //- Шапка панели (safe-area-top — статус-бар в standalone-PWA)
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

    //- Тело: ЕДИНСТВЕННЫЙ скроллящийся регион панели — один плоский
    //- скролл (рельса — в AppScrollArea). ProductFilter в flow-режиме:
    //- секции растекаются, переполнение гасит скролл здесь, а не окно
    //- внутри. Быстрый фильтр «В наличии» — в закреплённом блоке ниже
    AppScrollArea.filters-scroll(contentClass="px-3 py-2")
      ProductFilter(
        :flow="true"
        :searchQuery="searchQuery"
        :categories="categories"
        :specFacets="specFacets"
        :filters="filters"
        :priceRange="priceRange"
        :filtered-count="filteredCount"
        :total-count="totalCount"
        @update:filters="emit('update:filters', $event)"
      )

    //- Быстрый фильтр «Только в наличии»: закреплён над кнопкой
    //- «Показать N» — всегда виден, а характеристики скроллятся под
    //- ними (паттерн маркетплейсов)
    .filters-quick(class="bg-base-100 border-base-200 border-t")
      ProductQuickFilters(
        :filters="filters"
        @change="handleQuickFilter"
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
/* ── Обёртка: fixed на весь вьюпорт, панель занимает её целиком ─ */
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

/* ── Панель: flex-колонка на ВЕСЬ экран ────────────────────────
   Высота ЗАДАНА (а не только max-height): внутри неё flex-1/min-h-0
   тела дают определённый остаток, и скролл тела работает. Тело —
   AppScrollArea (единый плоский скролл), ProductFilter в нём —
   flow (своей высоты, растекается). min(100dvh, 100%) — dvh
   отслеживает динамический тулбар мобильных браузеров, 100% —
   fallback. */
.mobile-filters-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: min(100dvh, 100%);
  width: 100%;
  background: var(--color-base-100);
  overflow: hidden;
  /* Въезд снизу: только transform/opacity (правила экономии main.css).
     fill backwards (не both): после анимации transform возвращается в
     none — панель не остаётся навсегда в GPU-слое с трансформом
     (трансформированный предок — классическая причина фризов скролла
     на iOS); конечный кадр совпадает с естественным состоянием */
  animation: sheet-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}

@keyframes sheet-in {
  from {
    transform: translateY(10%);
    opacity: 0.5;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* ── Тело: единственный ПЛОСКИЙ скролл панели ──────────────
   Без вложенных скролл-окон: на таче свайп внутри маленького окна
   умирает на его границе, свайпы вне окна не скроллят ничего —
   панель «зависает». Один скролл = предсказуемый свайп в любой
   точке тела. Рельса (постоянная синяя полоса) — в AppScrollArea */
.filters-scroll {
  flex: 1 1 0;
  min-height: 0;
}

/* ── Шапка и подвал: зафиксированы flex-колонкой ─────────────── */
.filters-header,
.filters-footer,
.filters-quick {
  flex-shrink: 0;
}

/* Шапка: safe-area для standalone-PWA (статус-бар не перекрывает) */
.filters-header {
  padding-top: calc(0.5rem + var(--safe-area-top, 0px));
}

/* Закреплённые быстрые фильтры: компактная полоса над кнопкой
   (0.75rem по горизонтали — выравнивание с телом панели px-3) */
.filters-quick {
  padding: 0.25rem 0.75rem;
}

.filters-footer {
  padding: 0.75rem 1rem;
  padding-bottom: calc(0.75rem + var(--safe-area-bottom, 0px));
}
</style>

<script setup>
//- Полноэкранная панель фильтров. ProductFilter автоимпортится.
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

//- Быстрый фильтр (в наличии/избранное) из закреплённого блока:
//- обновляем ОДИН ключ в снимке фильтров и отдаём наверх — как это
//- делает ProductFilter для чекбоксов в скролле (без дебаунса —
//- для одиночных кликов он не нужен)
const handleQuickFilter = (key, value) => {
  emit('update:filters', { ...props.filters, [key]: value })
}
</script>
