<!-- app/pages/admin/news.vue — управление новостями: данные в KV
     (data:news), CRUD через /api/news (только админ). Витрина — /news. -->
<template lang="pug">
.admin-news-page.min-h-screen.bg-base-100.flex.flex-col.mobile-nav-safe
  Header

  main.flex-1.max-w-5xl.w-full.mx-auto.px-3.py-4(class="lg:px-6")
    AdminNews

  //- Мобильная навигация: только < 768px (как на витрине)
  MobileNavFooter(v-if="isMobile")
</template>

<script setup>
definePageMeta({
  middleware: 'admin-auth',
})

import Header from '~/components/layout/Header.vue'
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'

const { isMobile } = useMobileDetection()

useHead({ title: 'Новости — админка' })
</script>
