<!-- app\pages\settings.vue -->
<template lang="pug">
.settings-page.min-h-screen.bg-base-100.pt-16
  .container.mx-auto.p-6
    .card.bg-base-100.shadow-xl
      .card-body
        h1.card-title.text-2xl Настройки
        .alert.alert-info.mt-4
          span Страница настроек в разработке
        button.btn.btn-primary.mt-4(@click="$router.back()") Назад
</template>