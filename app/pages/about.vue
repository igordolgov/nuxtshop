<!-- app/pages/about.vue — статическая страница «О нас». -->
<template lang="pug">
.about-page.min-h-screen.bg-base-100.flex.flex-col
  Header
  .content-wrapper.flex-1.flex
    .main-content.bg-base-100.flex-1
      .container.mx-auto.p-6
        .text-center
          h1.text-3xl.font-bold.mb-4 О нас
          p.text-base-content.opacity-70.mb-4 Информация о компании (в разработке)
          NuxtLink.btn.btn-primary(to="/" prefetch) Вернуться на главную

  //- Мобильный футер
  ClientOnly
    MobileNavFooter(v-if="isMobile")
</template>

<script setup>
//- Компоненты и композаблы автоимпортятся Nuxt.
//- Локальная система ориентации удалена вместе с боковой навигацией:
//- нижнее меню постоянно, landscape ничем не отличается от portrait
const { isMobile } = useMobileDetection()
</script>