<!-- app/layouts/default.vue -->
<template lang="pug">
.default-layout.min-h-dvh.flex.flex-col
  main.flex-1
    slot
  //- Глобальная кнопка «наверх» — только для витрины. В админке у страниц
  //- свои контексты скролла, и плавающая кнопка там мешала: перекрывала
  //- панели и модалки (таблица товаров держит свой экземпляр в
  //- AdminProducts, остальные админ-страницы обходятся без неё).
  ScrollToTop(v-if="!isAdminRoute")
  //- MessengerFab — кнопки мессенджеров временно отключены (вернуть: раскомментировать)
  //- MessengerFab
</template>

<script setup>
const route = useRoute()

// Сегмент 'admin' в пути: /admin, /en/admin/orders… (префикс локали).
// split, а не startsWith — не заденем витринные пути вида /admin-guide.
const isAdminRoute = computed(() => route.path.split('/').includes('admin'))
</script>
