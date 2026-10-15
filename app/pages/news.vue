<!-- app/pages/news.vue — статическая страница «Новости». -->
<template lang="pug">
.news-page.min-h-100dvh.bg-base-100.flex.flex-col
  Header
  .content-wrapper.flex-1.flex
    .main-content.bg-base-100.flex-1
      .container.mx-auto.p-6
        .text-center
          h1.text-3xl.font-bold.mb-4 Новости
          p.text-base-content.opacity-70.mb-4 Наши новости (в разработке)
          NuxtLink.btn.btn-primary(to="/") Вернуться на главную

  //- Мобильный футер
  ClientOnly
    MobileNavFooter(v-if="isMobile")
</template>

<script setup>
const { isMobile } = useMobileDetection()
</script>