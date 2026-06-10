<!-- app/layouts/default.vue -->
<!-- ============================================
  Layout: default
  Назначение: основной layout для страниц приложения
  Содержит: main content slot, scroll to top
  Header находится в отдельных страницах (index.vue)
============================================ -->
<template lang="pug">
.default-layout.min-h-screen.flex.flex-col
  //- Основной контент страницы
  main.flex-1.min-h-0
    slot
  
  //- Кнопка прокрутки вверх (только на клиенте)
  ClientOnly
    ScrollToTop
</template>

<script setup>
// Layout не требует дополнительной логики
// Состояние управляется через composables
</script>

<style scoped>
.default-layout {
  min-height: 100dvh;
  overflow: hidden;
}
</style>