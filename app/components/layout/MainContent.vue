<!-- MainContent.vue -->
<template lang="pug">
.flex-1.min-w-0.flex.flex-col
  //- Кнопка открытия фильтров на мобильных
  button.btn.btn-primary.btn-sm.fixed.bottom-6.right-6.z-20.shadow-lg(
    @click="$emit('openMobileFilters')"
    class="rounded-full w-12 h-12 min-h-0 lg:hidden"
  )
    svg.w-6.h-6(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
      path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z")
  
  slot
</template>

<style scoped>
@media (max-width: 1023px) {
  .min-h-screen.flex.flex-col :deep(.mt-16) {
    margin-top: 4rem;
  }
}
</style>