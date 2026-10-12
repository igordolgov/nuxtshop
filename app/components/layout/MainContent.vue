<!-- components/layout/MainContent.vue — контейнер контента каталога -->
<!-- и плавающая кнопка фильтров на мобильных. -->
<template lang="pug">
.flex-1.min-w-0.flex.flex-col
  //- Плавающая кнопка фильтров (мобильные).
  //- Позиция: НАД нижней навигацией (--mobile-nav-height) с учётом
  //- safe-area; раньше bottom-6 (24px) при фугере ~60px и z-20 < z-40 —
  //- кнопка утопала под меню
  button.btn.btn-primary.btn-sm.fixed.z-30.shadow-lg.fab-filters(
    @click="$emit('openMobileFilters')"
    type="button"
    aria-label="Открыть фильтры"
    class="lg:hidden rounded-full w-12 h-12 min-h-0"
  )
    svg.w-6.h-6(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
      path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z")

  slot
</template>

<style scoped>
/* FAB над нижней навигацией: высота навигации + safe-area + воздух.
  right тоже с safe-area (landscape iPhone с вырезом).
  ⚠️ Возможный дубль: в Header.vue есть своя кнопка фильтров на
   мобильных (isHomePage) — вопрос вынесен отдельно (см. диалог). */
.fab-filters {
  bottom: calc(var(--mobile-nav-height, 60px) + var(--safe-area-bottom, 0px) + 16px);
  right: max(1rem, var(--safe-area-right, 0px));
}
</style>