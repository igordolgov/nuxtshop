<!-- app/layouts/custom.vue -->
<!-- ============================================
   Layout: custom
   Назначение: layout для страниц без сайдбара фильтров
   Используется: страница товара, профиль и т.д.
============================================ -->
<template lang="pug">
.custom-layout.min-h-screen.flex.flex-col
  //- Header
  Header
  
  //- Основной контент (прокручиваемый)
  main.flex-1.min-h-0.overflow-y-auto
    slot
</template>

<script setup>
import Header from '~/components/layout/Header.vue'
</script>

<style scoped>
.custom-layout {
  min-height: 100dvh;
}
</style>