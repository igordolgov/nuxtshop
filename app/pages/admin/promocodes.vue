<!-- app/pages/admin/promocodes.vue — управление промокодами: справочник
     кодов в KV (data:promocodes), скидки считает сервер при заказе. -->
<template lang="pug">
.admin-promocodes-page.min-h-screen.bg-base-100.flex.flex-col.mobile-nav-safe
  Header

  main.flex-1.max-w-5xl.w-full.mx-auto.px-3.py-4(class="lg:px-6")
    AdminPromocodes

  //- Мобильная навигация: только < 768px (как на витрине)
  MobileNavFooter
</template>

<script setup>
definePageMeta({
  middleware: 'admin-auth',
})

import Header from '~/components/layout/Header.vue'
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'
import AdminPromocodes from '~/components/admin/AdminPromocodes.vue'

const { isMobile } = useMobileDetection()

useHead({ title: 'Промокоды — админка' })
</script>
