<!-- app/pages/contacts.vue — статическая страница «Контакты». -->
<template lang="pug">
.contacts-page.min-h-screen.bg-base-100.flex.flex-col
  Header
  .content-wrapper.flex-1.flex
    .main-content.bg-base-100.flex-1
      .container.mx-auto.p-6
        .text-center
          h1.text-3xl.font-bold.mb-4 Контакты
          p.text-base-content.opacity-70.mb-4 Наши контактные данные (в разработке)
          NuxtLink.btn.btn-primary(to="/") Вернуться на главную

  //- Мобильный футер
  ClientOnly
    MobileNavFooter(v-if="isMobile")
</template>

<script setup>
const { isMobile } = useMobileDetection()
</script>