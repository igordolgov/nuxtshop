<!-- app/pages/admin/orders.vue — дашборд заказов для админа:
    список всех заказов с фильтром по статусу, детали заказа и
    смена статуса (PUT /api/orders/:id). Витрина вместо голого API.
    Данные — сервер (KV), не localStorage-зеркало. -->
<template lang="pug">
.admin-orders-page.min-h-screen.bg-base-100.flex.flex-col.mobile-nav-safe
  Header

  main.flex-1.max-w-5xl.w-full.mx-auto.px-3.py-4(class="lg:px-6")
    //- Шапка: заголовок + обновление
    .flex.items-center.justify-between.gap-2.mb-4
      div
        h1.text-2xl.font-semibold.text-base-content(class="lg:text-3xl") {{ $t('admin.orders.title') }}
        p.text-sm(class="mt-0.5 text-base-content/60")
          | {{ isLoading ? $t('admin.common.loading') : $t('admin.orders.inSystem', { n: orders.length }) }}
      //- Правая группа: CSV-экспорт + обновление
      .flex.items-center.gap-1
        button.btn.btn-ghost.btn-sm.rounded-xl(
          type="button"
          :disabled="isLoading || isExporting"
          :aria-label="$t('admin.orders.exportAria')"
          :title="$t('admin.orders.exportTitle')"
          @click="exportCsv"
        )
          svg.w-4.h-4(
            :class="{ 'animate-spin': isExporting }"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          )
            path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3")
          span(class="hidden sm:inline") CSV
        button.btn.btn-ghost.btn-sm.rounded-xl(
          type="button"
          :disabled="isLoading"
          :aria-label="$t('admin.orders.refreshAria')"
          @click="loadOrders"
        )
          svg.w-4.h-4(
            :class="{ 'animate-spin': isLoading }"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          )
            path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15")

    //- Telegram: статус бота и подключение вебхука кнопкой
    AdminTelegramCard.mb-4

    //- Фильтр по статусам: Все + 5 статусов, на каждой кнопке — счётчик
    .flex.flex-wrap.gap-2.mb-4
      button.btn.btn-sm.rounded-lg(
        type="button"
        :class="filter === 'all' ? 'btn-primary' : 'btn-outline'"
        @click="setFilter('all')"
      )
        | {{ $t('admin.orders.filterAll') }}
        span.badge.badge-sm.ml-1(class="badge-neutral") {{ orders.length }}
      button.btn.btn-sm.rounded-lg(
        v-for="s in STATUS_KEYS"
        :key="s"
        type="button"
        :class="filter === s ? 'btn-primary' : 'btn-outline'"
        @click="setFilter(s)"
      )
        | {{ STATUS_LABELS[s] }}
        span.badge.badge-sm.ml-1(class="badge-neutral") {{ statusCount(s) }}

    //- Скелетон первой загрузки
    .space-y-3(v-if="isLoading && !orders.length")
      .skeleton.h-32.rounded-2xl(v-for="i in 4" :key="i")

    //- Пустое состояние: заказов нет вообще или нет с этим статусом
    .text-center.py-16.flex.flex-col.items-center(
      v-else-if="!isLoading && !filteredOrders.length"
    )
      .size-18.rounded-full.flex.items-center.justify-center.mb-5(
        class="bg-base-200 text-base-content/50"
      )
        svg(width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5")
          path(d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4")
      h2.text-lg.font-semibold.text-base-content
        | {{ filter === 'all' ? $t('admin.orders.emptyAll') : $t('admin.orders.emptyFiltered') }}
      p.text-sm.max-w-sm.mx-auto.mt-1(class="text-base-content/50")
        | {{ $t('admin.orders.emptyHint') }}

    //- Список заказов
    .space-y-4(v-else)
      .order-card.bg-base-100.border.rounded-2xl.overflow-hidden(
        v-for="order in filteredOrders"
        :key="order.id"
        class="border-base-300"
      )
        //- Шапка карточки: номер, дата, сумма, статус
        .flex.items-center.justify-between.gap-2.px-4.py-3.border-b(
          class="bg-base-200/50 border-base-300"
        )
          .min-w-0
            .font-mono.font-semibold.text-sm {{ order.id }}
            .text-xs(class="mt-0.5 text-base-content/50")
              | {{ formatDateTime(order.createdAt) }} · {{ itemsCount(order) }} {{ $t('admin.orders.itemsUnit') }}
          .flex.items-center.gap-2.shrink-0
            span.font-semibold.text-sm.hidden(class="sm:inline") {{ formatPrice(order.total) }}
            span.badge.badge-sm.rounded-full(:class="statusBadgeClass(order.status)")
              | {{ statusLabel(order.status) }}

        //- Основная строка: клиент + раскрытие деталей
        button.w-full.text-left.px-4.py-3.flex.items-center.justify-between.gap-3(
          type="button"
          :aria-expanded="expanded.has(order.id)"
          @click="toggleExpand(order.id)"
        )
          .flex-1.min-w-0
            .text-sm.font-medium {{ order.customer?.name || $t('admin.orders.noName') }}
            .text-xs.mt-1.truncate(class="text-base-content/50")
              | {{ order.customer?.phone || $t('admin.orders.noPhone') }} · {{ deliveryLabel(order.deliveryMethod) }}
          .font-semibold.text-sm(class="sm:hidden") {{ formatPrice(order.total) }}
          svg.w-5.h-5.shrink-0.transition-transform(
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            class="text-base-content/40"
            :class="{ 'rotate-180': expanded.has(order.id) }"
          )
            path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7")

        //- Детали заказа
        .px-4.pb-4(v-if="expanded.has(order.id)")
          //- Состав заказа
          .text-xs.font-semibold.uppercase.opacity-60.mb-1 {{ $t('admin.orders.contents') }}
          .divide-y.rounded-xl.overflow-hidden(
            class="divide-base-200 bg-base-200/40"
          )
            .flex.items-center.justify-between.gap-3.px-3.py-2.text-sm(
              v-for="item in order.items"
              :key="item.id"
            )
              .min-w-0
                .truncate {{ item.name }}
                .text-xs(class="text-base-content/50")
                  | {{ item.quantity }} × {{ formatPrice(item.price) }}
              .font-medium.shrink-0 {{ formatPrice(item.price * item.quantity) }}

          //- Итоги
          .mt-3.space-y-1.text-sm
            .flex.justify-between.gap-3
              span(class="text-base-content/60") {{ $t('admin.orders.subtotal') }}
              span {{ formatPrice(order.subtotal) }}
            .flex.justify-between.gap-3(v-if="order.discount > 0")
              span(class="text-base-content/60") {{ order.promoCode ? $t('admin.orders.discountWithCode', { code: order.promoCode }) : $t('admin.orders.discount') }}
              span.text-success −{{ formatPrice(order.discount) }}
            .flex.justify-between.gap-3
              span(class="text-base-content/60") {{ $t('admin.orders.delivery') }}
              span {{ order.deliveryPrice > 0 ? formatPrice(order.deliveryPrice) : $t('admin.orders.free') }}
            .flex.justify-between.gap-3.pt-1.border-t(class="border-base-200")
              span.font-semibold {{ $t('admin.orders.total') }}
              span.font-semibold {{ formatPrice(order.total) }}

          //- Контакт и условия
          .mt-3.grid.grid-cols-1.gap-x-4.gap-y-1.text-xs(class="sm:grid-cols-2")
            div
              span(class="text-base-content/60") {{ $t('admin.orders.phoneLabel') }}
              |
              | {{ order.customer?.phone || '—' }}
            div
              span(class="text-base-content/60") {{ $t('admin.orders.emailLabel') }}
              |
              | {{ order.customer?.email || '—' }}
            div
              span(class="text-base-content/60") {{ $t('admin.orders.deliveryLabel') }}
              |
              | {{ deliveryLabel(order.deliveryMethod) }}
            div
              span(class="text-base-content/60") {{ $t('admin.orders.paymentLabel') }}
              |
              | {{ paymentLabel(order.paymentMethod) }}
            div(class="sm:col-span-2" v-if="order.customer?.address")
              span(class="text-base-content/60") {{ $t('admin.orders.addressLabel') }}
              |
              | {{ order.customer.address }}
            div(class="sm:col-span-2" v-if="order.comment")
              span(class="text-base-content/60") {{ $t('admin.orders.commentLabel') }}
              |
              | {{ order.comment }}

          //- История статусов (свежие сверху)
          .mt-3(v-if="order.statusHistory && order.statusHistory.length")
            .text-xs.font-semibold.uppercase.opacity-60.mb-1 {{ $t('admin.orders.statusHistory') }}
            ul.space-y-1.text-xs
              li.flex.items-center.gap-2(
                v-for="(h, idx) in historyDesc(order)"
                :key="idx"
              )
                span.badge.badge-xs(:class="statusBadgeClass(h.status)")
                  | {{ statusLabel(h.status) }}
                span(class="text-base-content/50") {{ formatDateTime(h.at) }}
                span.opacity-70(v-if="h.comment") — {{ h.comment }}

          //- Смена статуса
          .mt-3.pt-3.border-t(class="border-base-300")
            .flex.flex-wrap.items-center.gap-2
              span.text-xs(class="text-base-content/60") {{ $t('admin.orders.changeStatus') }}
              select.select.select-bordered.select-sm.max-w-44(
                v-model="nextStatus[order.id]"
                :disabled="updating.has(order.id)"
                :aria-label="$t('admin.orders.newStatusAria')"
              )
                option(
                  v-for="s in statusOptions(order.status)"
                  :key="s"
                  :value="s"
                ) {{ STATUS_LABELS[s] }}
              button.btn.btn-primary.btn-sm.rounded-lg(
                type="button"
                :disabled="!nextStatus[order.id] || updating.has(order.id)"
                @click="applyStatus(order)"
              )
                span.loading.loading-spinner.loading-xs(v-if="updating.has(order.id)")
                | {{ $t('admin.common.apply') }}

  //- Мобильная навигация: только < 768px (как на витрине)
  MobileNavFooter
</template>

<script setup>
definePageMeta({
  middleware: 'admin-auth',
})

const { isMobile } = useMobileDetection()

import Header from '~/components/layout/Header.vue'
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'

const { $notify } = useNuxtApp()
const { t, locale } = useI18n()

const orders = ref([])
const isLoading = ref(true)
//- Фильтр статуса: 'all' или один из STATUS_KEYS
const filter = ref('all')
//- Развёрнутые карточки: Set id (реактивный — через пересоздание)
const expanded = ref(new Set())
//- Выбранный новый статус по id заказа
const nextStatus = ref({})
//- id заказов, для которых сейчас летит PUT
const updating = ref(new Set())

//- Подписи статусов: i18n (зеркалим ORDER_STATUS_LABELS сервера)
const STATUS_KEYS = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled']
const STATUS_LABELS = computed(() => ({
  new: t('admin.orders.statusNew'),
  confirmed: t('admin.orders.statusConfirmed'),
  shipped: t('admin.orders.statusShipped'),
  delivered: t('admin.orders.statusDelivered'),
  cancelled: t('admin.orders.statusCancelled'),
}))
const statusLabel = (s) => STATUS_LABELS.value[s] ?? s

const statusBadgeClass = (s) => ({
  new: 'badge-primary',
  confirmed: 'badge-success',
  shipped: 'badge-warning',
  delivered: 'badge-accent',
  cancelled: 'badge-error',
})

const deliveryLabel = (m) =>
  m === 'courier' ? t('admin.orders.deliveryCourier') : m === 'post' ? t('admin.orders.deliveryPost') : t('admin.orders.deliveryPickup')

const paymentLabel = (m) => (m === 'card' ? t('admin.orders.paymentCard') : t('admin.orders.paymentCash'))

//- ─── CSV-экспорт: blob-скачивание с обработкой ошибок ──────────────
// Не <a href> — blob позволяет поймать 401/500 и показать тост,
// а не молча отдать JSON-ошибку в файле.
const isExporting = ref(false)
const exportCsv = async () => {
  if (isExporting.value) return
  isExporting.value = true
  try {
    const blob = await $fetch('/api/orders/export', { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    $notify.success(t('admin.orders.csvDownloaded'))
  } catch (err) {
    console.error('[admin-orders] Ошибка экспорта:', err?.data?.message || err?.message)
    $notify.error(t('admin.orders.csvError'))
  } finally {
    isExporting.value = false
  }
}

const loadOrders = async () => {
  isLoading.value = true
  try {
    // 500 — максимум эндпоинта; для магазина этого достаточно,
    // фильтр по статусу делаем на клиенте — мгновенное переключение
    const response = await $fetch('/api/orders', { query: { limit: 500 } })
    if (response.success) {
      orders.value = response.orders
    }
  } catch (err) {
    // 401 при протухшей сессии: middleware не пустит, но и тут не падаем
    console.error('[admin-orders] Ошибка загрузки:', err?.data?.message || err?.message)
    $notify.error(t('admin.orders.loadError'))
  } finally {
    isLoading.value = false
  }
}

const setFilter = (s) => {
  filter.value = s
}

const filteredOrders = computed(() =>
  filter.value === 'all' ? orders.value : orders.value.filter((o) => o.status === filter.value),
)

const statusCount = (s) => orders.value.filter((o) => o.status === s).length

const itemsCount = (order) =>
  (order.items ?? []).reduce((n, i) => n + (i.quantity || 0), 0)

const toggleExpand = (id) => {
  const next = new Set(expanded.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expanded.value = next
}

const historyDesc = (order) => [...(order.statusHistory ?? [])].reverse()

const formatPrice = (price) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price ?? 0)

const formatDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString(dateLocale.value, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

// Локаль для дат/чисел — синхронно с языком интерфейса
const dateLocale = computed(() =>
  locale.value === 'en' ? 'en-US' : locale.value === 'es' ? 'es-ES' : 'ru-RU',
)

//- Доступные для перехода статусы: все, кроме текущего
const statusOptions = (current) => STATUS_KEYS.filter((s) => s !== current)

const applyStatus = async (order) => {
  const status = nextStatus.value[order.id]
  if (!status || updating.value.has(order.id)) return

  const next = new Set(updating.value)
  next.add(order.id)
  updating.value = next
  try {
    const resp = await $fetch(`/api/orders/${order.id}`, {
      method: 'PUT',
      body: { status },
    })
    if (resp.success && resp.order) {
      // Сервер вернул обновлённый заказ — заменяем им карточку в списке
      orders.value = orders.value.map((o) => (o.id === order.id ? resp.order : o))
      nextStatus.value = { ...nextStatus.value, [order.id]: undefined }
      $notify.success(resp.message || t('admin.orders.statusUpdated', { id: order.id }))
    }
  } catch (err) {
    console.error('[admin-orders] Ошибка смены статуса:', err?.data?.message || err?.message)
    $notify.error(err?.data?.message || t('admin.orders.statusChangeError'))
  } finally {
    const done = new Set(updating.value)
    done.delete(order.id)
    updating.value = done
  }
}

onMounted(() => {
  window.scrollTo(0, 0)
  loadOrders()
})

useHead({ title: () => t('admin.orders.pageTitle') })
</script>
