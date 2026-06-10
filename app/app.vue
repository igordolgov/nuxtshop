<!-- app/app.vue -->
<template lang="pug">
.min-h-screen.flex.flex-col
  //- Оффлайн индикатор (всегда виден)
  OfflineIndicator(show-banner)

  //- Основной контент
  NuxtLayout
    NuxtPage

  //- Установка PWA
  InstallPrompt
</template>

<style>
/* ============================================
  Глобальные стили для подсветки поиска
  Используются в компонентах поиска и категорий
============================================ */

html {
  -webkit-tap-highlight-color: transparent;
  scroll-behavior: smooth;
}

body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* Базовая подсветка badge */
.badge-highlight {
  position: relative;
  overflow: hidden;
}

.badge-highlight::before {
  content: '';
  position: absolute;
  inset: 0;
  background: #ffeb3b;
  z-index: -1;
  border-radius: 0.25rem;
}

/* Подсветка найденного текста */
.badge-highlight .search-highlight {
  background-color: #ff5722 !important;
  color: white !important;
  border-radius: 2px;
  margin: 0 -1px;
  padding: 0 1px;
}

/* Общая подсветка поиска (используется в ProductCategories) */
.search-highlight {
  background: linear-gradient(120deg, #ffd05a, #ffe572) !important;
  color: #1f2937 !important;
  border-radius: 3px !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1) !important;
}
</style>

<script setup>
import { useOffline } from '@/composables/useOffline'

const { isOnline, isOffline } = useOffline()

useHead({
  meta: [
    { name: 'theme-color', content: '#ffffff' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' }
  ]
})
</script>