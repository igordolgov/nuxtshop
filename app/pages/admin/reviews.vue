<!-- app/pages/admin/reviews.vue — модерация: отзывы о товарах, отзывы
     о магазине и заявки «сообщить о поступлении» — три вкладки,
     данные в KV (data:reviews / data:store-reviews / data:stock-alerts). -->
<template lang="pug">
.admin-reviews-page.min-h-screen.bg-base-100.flex.flex-col.mobile-nav-safe
  Header

  main.flex-1.max-w-5xl.w-full.mx-auto.px-3.py-4(class="lg:px-6")
    //- Вкладки разделов модерации
    .flex.gap-1.mb-4.flex-wrap(role="tablist" :aria-label="$t('admin.reviews.tabsAria')")
      button.btn.btn-sm.rounded-xl(
        type="button"
        role="tab"
        :aria-selected="tab === 'products' ? 'true' : 'false'"
        :class="tab === 'products' ? 'btn-primary' : 'btn-ghost'"
        @click="tab = 'products'"
      ) {{ $t('admin.reviews.tabProducts') }}
      button.btn.btn-sm.rounded-xl(
        type="button"
        role="tab"
        :aria-selected="tab === 'store' ? 'true' : 'false'"
        :class="tab === 'store' ? 'btn-primary' : 'btn-ghost'"
        @click="tab = 'store'"
      ) {{ $t('admin.reviews.tabStore') }}
      button.btn.btn-sm.rounded-xl(
        type="button"
        role="tab"
        :aria-selected="tab === 'alerts' ? 'true' : 'false'"
        :class="tab === 'alerts' ? 'btn-primary' : 'btn-ghost'"
        @click="tab = 'alerts'"
      ) {{ $t('admin.reviews.tabAlerts') }}

    AdminReviews(v-if="tab === 'products'")
    AdminStoreReviews(v-else-if="tab === 'store'")
    AdminStockAlerts(v-else)

  //- Мобильная навигация: только < 768px (как на витрине)
  MobileNavFooter
</template>

<script setup>
definePageMeta({
  middleware: 'manager-auth',
})

import Header from '~/components/layout/Header.vue'
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'

const { t } = useI18n()

const { isMobile } = useMobileDetection()

// Активная вкладка модерации: products | store | alerts
const tab = ref('products')

useHead({ title: () => t('admin.reviews.pageTitle') })
</script>
