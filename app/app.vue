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
// Дефолтная og-картинка: абсолютный URL (краулеры соцсетей не резолвят
// относительные). siteUrl — канонический домен из NUXT_PUBLIC_SITE_URL
// (в Workers origin запроса = http://localhost); в dev он пуст → origin.
const { public: publicConfig } = useRuntimeConfig();
const siteOrigin = publicConfig.siteUrl || useRequestURL().origin;
const ogImageAlt = () => `${t("app.title")} — ${t("meta.description").slice(0, 80)}`;
useHead(() => ({
  htmlAttrs: { lang: localeHead.value.htmlAttrs.lang },
  link: [...(localeHead.value.link || [])],
  meta: [
    ...(localeHead.value.meta || []),
    // Локализованные description/keywords для ВСЕХ страниц: без этого
    // сработал бы статический fallback из nuxt.config (app.head.meta)
    // и на /en, /es метатеги оставались бы русскими. Страницы со своим
    // useSeoMeta({ description }) переопределяют этот fallback (Unhead
    // дедуплицирует meta по name — последний регистр выигрывает).
    { name: "description", content: t("meta.description") },
    { name: "keywords", content: t("meta.keywords") },
    // Дефолтные og/twitter для страниц без своей og-картинки (главная,
    // новости, контакты…). Товары задают ogImage в useSeoMeta — их регистр
    // позже, он перекрывает эти значения по тому же правилу дедупликации.
    { property: "og:image", content: `${siteOrigin}/og-default.jpg` },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: ogImageAlt() },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: `${siteOrigin}/og-default.jpg` },
  ],
  title: t("app.title"),
}));
</script>