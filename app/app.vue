<!-- app/app.vue — каркас приложения: анонс маршрута (a11y), оффлайн-баннер, -->
<!-- layout со страницей, установка PWA, блокиратор ландшафта на телефонах. -->
<template lang="pug">
//- min-h-dvh вместо min-h-screen: на мобильных 100vh включает область
//- под адресной строкой, dvh — видимую высоту (без прыжков при скролле)
.min-h-dvh.flex.flex-col
  //- Объявление смены маршрута для скринридеров (доступность)
  NuxtRouteAnnouncer
  OfflineIndicator(show-banner)
  NuxtLayout
    NuxtPage
  InstallPrompt
  //- Запрет горизонтального режима на телефонах (чистый CSS, без JS)
  OrientationGuard
</template>

<script setup>
// useOffline — singleton; OfflineIndicator сам его вызывает,
// стейт общий для всего приложения. Здесь вызывать не нужно.
</script>