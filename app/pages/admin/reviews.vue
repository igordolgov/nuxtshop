<!-- app/pages/admin/reviews.vue — модерация отзывов о товарах: данные в KV
     (data:reviews), одобрение/скрытие/удаление через /api/admin/reviews.
     Публичная витрина отзывов — блок на карточке товара. -->
<template lang="pug">
.admin-reviews-page.min-h-screen.bg-base-100.flex.flex-col.mobile-nav-safe
  Header

  main.flex-1.max-w-5xl.w-full.mx-auto.px-3.py-4(class="lg:px-6")
    AdminReviews

  //- Мобильная навигация: только < 768px (как на витрине)
  MobileNavFooter
</template>

<script setup>
definePageMeta({
  middleware: 'admin-auth',
})

import Header from '~/components/layout/Header.vue'
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'

const { isMobile } = useMobileDetection()

useHead({ title: 'Отзывы — админка' })
</script>
