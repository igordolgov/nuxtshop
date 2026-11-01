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

// Локализация head: lang на <html>, hreflang/canonical-альтернаты для
// текущего маршрута (ru/en/es). i18n-модуль подставляет их по URL-локали.
const { t } = useI18n();
const localeHead = useLocaleHead({ dir: true, lang: true, seo: true });
useHead(() => ({
  htmlAttrs: { lang: localeHead.value.htmlAttrs.lang },
  link: [...(localeHead.value.link || [])],
  meta: [...(localeHead.value.meta || [])],
  title: t('app.title'),
}));
</script>