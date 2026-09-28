<!-- app/layouts/auth.vue -->
<!-- ============================================
   Layout: auth
   Назначение: layout для страниц аутентификации
   Используется: login, register, forgot-password
   Особенности: без header, без footer, минимальный UI
============================================ -->
<template lang="pug">
.auth-layout.min-h-screen.flex.items-center.justify-center
  slot
</template>

<script setup>
// Auth layout - минимальная обёртка без header/footer
// Центрирует контент по центру экрана
</script>

<style scoped>
.auth-layout {
  min-height: 100dvh;
}
</style>