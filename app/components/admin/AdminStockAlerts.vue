<!-- ~/components/admin/AdminStockAlerts.vue — заявки «сообщить о поступлении»
     (KV data:stock-alerts): кто (контакт), о каком товаре, когда; удаление. -->
<template lang="pug">
.admin-stock-alerts
  //- Тулбар
  .flex.items-center.justify-between.gap-2.flex-wrap.mb-4
    div
      h2.text-xl.font-semibold.text-base-content {{ $t('admin.stockAlerts.title') }}
      p.text-sm(class="mt-0.5 text-base-content/60")
        | {{ isLoading ? $t('admin.common.loading') : $t('admin.stockAlerts.count', { n: items.length }) }}

    .flex.gap-2
      button.btn.btn-ghost.btn-sm.rounded-xl(
        type="button"
        :disabled="isLoading"
        :aria-label="$t('admin.reviews.refreshAria')"
        @click="load"
      )
        svg.w-4.h-4(:class="{ 'animate-spin': isLoading }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15")

  //- Скелетон
  .space-y-3(v-if="isLoading && !items.length")
    .skeleton.h-16.rounded-2xl(v-for="i in 4" :key="i")

  //- Ошибка загрузки
  .text-center.py-12(v-else-if="loadError")
    p(class="text-base-content/50 mb-4") {{ $t('admin.stockAlerts.loadError') }}
    button.btn.btn-primary.btn-sm.rounded-xl(type="button" @click="load") {{ $t('admin.common.retry') }}

  //- Пусто
  .text-center.py-12(v-else-if="!items.length")
    p(class="text-base-content/50") {{ $t('admin.stockAlerts.empty') }}

  //- Список (свежие сверху)
  .space-y-3(v-else)
    .alert-row.card.bg-base-100.shadow-sm(v-for="a in items" :key="a.id")
      .card-body.p-4.gap-1
        .flex.items-center.gap-2.flex-wrap
          span.font-medium.text-sm {{ a.productName || $t('admin.stockAlerts.deletedProduct', { id: a.productId }) }}
          span.badge.badge-sm.badge-ghost {{ $t('admin.stockAlerts.productId', { id: a.productId }) }}
          span.text-xs.ml-auto(class="text-base-content/50") {{ formatDate(a.createdAt) }}
        .flex.items-center.justify-between.gap-2.flex-wrap
          a.link.link-hover.text-sm.font-medium(
            :href="contactHref(a.contact)"
          ) {{ a.contact }}
          button.btn.btn-outline.btn-xs.rounded-lg(
            type="button"
            class="hover:bg-error hover:text-error-content hover:border-error"
            :disabled="busyId === a.id"
            @click="remove(a)"
          ) {{ $t('admin.common.delete') }}
</template>

<script setup>
import { formatNewsDate } from '~/utils/news'

const { $notify } = useNuxtApp()
const { t, locale } = useI18n()

const items = ref([])
const isLoading = ref(false)
const loadError = ref(false)
const busyId = ref(null)

const formatDate = (iso) => formatNewsDate(iso, locale.value)

/* mailto:/tel: — зависит от содержимого контакта */
const contactHref = (contact) => {
  if (!contact) return '#'
  if (contact.includes('@')) return `mailto:${contact}`
  const digits = contact.replace(/\D+/g, '')
  return digits.length >= 10 ? `tel:+${digits}` : '#'
}

const load = async () => {
  isLoading.value = true
  loadError.value = false
  try {
    const resp = await $fetch('/api/admin/stock-alerts')
    items.value = Array.isArray(resp?.alerts) ? resp.alerts : []
  } catch {
    loadError.value = true
    $notify.error(t('admin.stockAlerts.loadError'))
  } finally {
    isLoading.value = false
  }
}

const remove = async (alert) => {
  if (!confirm(t('admin.stockAlerts.deleteConfirm'))) return
  busyId.value = alert.id
  try {
    const resp = await $fetch(`/api/admin/stock-alerts/${alert.id}`, { method: 'DELETE' })
    $notify.success(t('admin.stockAlerts.deletedToast'))
    await load()
  } catch {
    $notify.error(t('admin.stockAlerts.deleteError'))
  } finally {
    busyId.value = null
  }
}

onMounted(load)
</script>
