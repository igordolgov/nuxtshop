<!-- app/pages/admin/content.vue — редактор контента сайта (Контакты и
     О магазине): данные в KV (data:content), сохранение PUT /api/content
     (только админ). Витрины — /contacts и /about. -->
<template lang="pug">
.admin-content-page.min-h-screen.bg-base-100.flex.flex-col.mobile-nav-safe
  Header

  main.flex-1.max-w-5xl.w-full.mx-auto.px-3.py-4(class="lg:px-6")
    AdminContent

  //- Мобильная навигация: только < 768px (как на витрине)
  MobileNavFooter
</template>

<script setup>
definePageMeta({
  middleware: 'admin-auth',
})

import Header from '~/components/layout/Header.vue'
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'

const { t } = useI18n()

const { isMobile } = useMobileDetection()

useHead({ title: () => t('admin.content.pageTitle') })
</script>
