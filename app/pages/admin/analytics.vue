<!-- app/pages/admin/analytics.vue — аналитика продаж для админки:
     выручка и заказы по дням (CSS-график без библиотек), топ товаров,
     статусы, доставка/оплата. Данные — /api/admin/analytics (KV orders),
     выручка считается по не-отменённым заказам (семантика сервера).
     Стили повторяют дашборд (stat-card / panel / row-item). -->
<template lang="pug">
.admin-analytics.mobile-nav-safe
  Header
  main.container.mx-auto.px-3.py-4(class="sm:px-4 lg:px-6")
    //- Шапка: заголовок, окно периода, обновление
    .flex.flex-col.gap-3(class="sm:flex-row sm:items-center sm:justify-between")
      .flex.items-center.gap-3
        .dash-avatar
          icon(name="heroicons:chart-bar" size="22")
        div
          h1.text-xl.font-bold.text-base-content {{ $t('admin.analytics.title') }}
          p.dash-sub {{ $t('admin.analytics.subtitle', { days: period }) }}
      .flex.items-center.gap-2
        .join
          button.join-item.btn.btn-sm.rounded-xl(
            v-for="p in periods" :key="p.days"
            type="button"
            :class="period === p.days ? 'btn-primary' : 'btn-outline'"
            @click="setPeriod(p.days)"
          ) {{ p.label }}
        //- Экспорт CSV: три среза аналитики (топ товаров, дни, промокоды)
        .dropdown.dropdown-end
          button.btn.btn-sm.btn-ghost.rounded-xl(
            type="button"
            :disabled="loading || isExporting"
            :aria-label="$t('admin.analytics.exportAria')"
            :title="$t('admin.analytics.exportTitle')"
          )
            icon(name="heroicons:arrow-down-tray" size="16" :class="{ 'animate-pulse': isExporting }")
            span.hidden(class="sm:inline") {{ $t('admin.analytics.exportLabel') }}
          ul.dropdown-content.menu.z-50.w-56.rounded-xl.border.border-base-300.bg-base-100.p-1.shadow-lg
            li
              button(type="button" @click="exportCsv('top-products')")
                icon(name="heroicons:squares-2x2" size="16")
                span {{ $t('admin.analytics.exportTop') }}
            li
              button(type="button" @click="exportCsv('series')")
                icon(name="heroicons:chart-bar" size="16")
                span {{ $t('admin.analytics.exportDaily') }}
            li
              button(type="button" @click="exportCsv('promo-codes')")
                icon(name="heroicons:ticket" size="16")
                span {{ $t('admin.analytics.exportPromo') }}
        button.btn.btn-sm.btn-ghost.rounded-xl(:disabled="loading" @click="load" :aria-label="$t('admin.analytics.refreshAria')")
          icon(name="heroicons:arrow-path" size="18" :class="{ 'animate-spin': loading }")
          span.hidden(class="sm:inline") {{ $t('admin.analytics.refresh') }}

    //- KPI: заказы, выручка, средний чек, продано единиц
    .grid.grid-cols-2.gap-3.mt-4(class="lg:grid-cols-4")
      .stat-card(v-for="kpi in kpis" :key="kpi.label")
        .stat-icon(:class="`stat-icon-${kpi.tone}`")
          icon(:name="kpi.icon" size="20")
        .stat-num {{ kpi.value }}
        .stat-label {{ kpi.label }}
        .stat-badge(v-if="kpi.badge" :class="`stat-badge-${kpi.tone}`") {{ kpi.badge }}

    //- Скелетон первой загрузки
    .grid.grid-cols-1.gap-3.mt-4(v-if="!firstLoaded")
      .skeleton.h-48.rounded-2xl
      .skeleton.h-64.rounded-2xl

    //- Пустой период: заказов не было — дружелюбная заглушка
    .panel.mt-4(v-else-if="!hasData")
      .panel-empty
        .empty-icon
          icon(name="heroicons:shopping-bag" size="28")
        .empty-title {{ $t('admin.analytics.emptyTitle') }}
        .empty-hint {{ $t('admin.analytics.emptyHint') }}

    //- Данные периода
    template(v-else)
      //- График выручки по дням: flex-бары, без chart-библиотек
      .panel.mt-4
        .panel-head
          h2.panel-title {{ $t('admin.analytics.chartTitle') }}
          span.panel-hint {{ $t('admin.analytics.chartHint') }}
        .chart-wrap(v-if="maxRevenue > 0")
          .chart-bars(role="img" :aria-label="$t('admin.analytics.chartAria', { days: period })")
            .chart-col(v-for="d in series" :key="d.date")
              .chart-bar(
                :class="{ 'chart-bar-zero': d.revenue === 0 }"
                :style="{ height: barHeight(d.revenue) }"
                :title="barTitle(d)"
              )
          .chart-labels(aria-hidden="true")
            span.chart-label(
              v-for="(d, i) in series" :key="d.date"
              :class="{ 'chart-label-visible': showLabel(i) }"
            ) {{ shortDate(d.date) }}
        .panel-empty(v-else) {{ $t('admin.analytics.chartEmpty') }}

      //- Топ товаров + статусы
      .grid.grid-cols-1.gap-3.mt-4(class="lg:grid-cols-2")
        .panel
          .panel-head
            h2.panel-title {{ $t('admin.analytics.topTitle') }}
          .panel-empty(v-if="!topProducts.length") {{ $t('admin.analytics.topEmpty') }}
          .panel-list(v-else)
            .top-row(v-for="(p, i) in topProducts" :key="p.id")
              .top-rank {{ i + 1 }}
              .top-main.min-w-0
                .top-name.truncate {{ p.name }}
                .top-bar-wrap
                  .top-bar(:style="{ width: topWidth(p.revenue) }")
              .top-nums
                .top-revenue {{ formatPrice(p.revenue) }}
                .top-units {{ p.units }} {{ $t('admin.analytics.unitsShort') }}

        .panel
          .panel-head
            h2.panel-title {{ $t('admin.analytics.statusTitle') }}
          .panel-list
            .row-item(v-for="s in STATUS_KEYS" :key="s")
              .row-main
                span.badge.badge-sm(:class="statusBadgeClass(s)") {{ statusLabel(s) }}
              span.row-value {{ byStatus[s] ?? 0 }}

      //- Промокоды за период: код, скидка, статус, заказы/выручка/скидки.
      //- Известные коды показываем даже без применений (нули);
      //- удалённые из справочника — со статусом «Удалён».
      .panel.mt-4
        .panel-head
          h2.panel-title {{ $t('admin.analytics.promoTitle') }}
          span.panel-hint {{ $t('admin.analytics.promoHint') }}
        .panel-empty(v-if="!promoCodes.length") {{ $t('admin.analytics.promoEmpty') }}
        .panel-list(v-else)
          .promo-row(v-for="p in promoCodes" :key="p.code")
            .promo-main
              .promo-top
                span.promo-code {{ p.code }}
                span.promo-value(v-if="p.type") {{ promoValueLabel(p) }}
                span.badge.badge-sm(:class="promoBadgeClass(p)") {{ promoStatusLabel(p) }}
              .promo-meta
                span(v-if="p.lastUsedAt") {{ $t('admin.analytics.promoLastUsed', { date: promoLastUsed(p.lastUsedAt) }) }}
                span(v-if="p.cancelled > 0") {{ $t('admin.analytics.promoCancelled', { n: p.cancelled }) }}
            .promo-nums
              .promo-revenue {{ formatPrice(p.revenue) }}
              .promo-sub {{ p.orders }} {{ $t('admin.analytics.ordersCount') }} · {{ $t('admin.analytics.promoDiscountShort', { amount: formatPrice(p.discount) }) }}

      //- Доставка и оплата
      .grid.grid-cols-1.gap-3.mt-4(class="lg:grid-cols-2")
        .panel
          .panel-head
            h2.panel-title {{ $t('admin.analytics.deliveryTitle') }}
          .panel-list
            .row-item(v-for="(n, m) in byDelivery" :key="m")
              .row-main
                .row-title {{ deliveryLabel(m) }}
              span.row-value {{ n }}
        .panel
          .panel-head
            h2.panel-title {{ $t('admin.analytics.paymentTitle') }}
          .panel-list
            .row-item(v-for="(n, m) in byPayment" :key="m")
              .row-main
                .row-title {{ paymentLabel(m) }}
              span.row-value {{ n }}

  //- Мобильная навигация: только < 768px (как на витрине)
  MobileNavFooter
</template>

<style scoped>
.admin-analytics {
  min-height: calc(80dvh - 14px);
}

/* Шапка */
.dash-avatar {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--color-primary) 14%, transparent);
  color: var(--color-primary);
  flex-shrink: 0;
}

.dash-sub {
  font-size: 0.75rem;
  color: color-mix(in oklab, var(--color-base-content) 60%, transparent);
}

@media (min-width: 640px) {
  .dash-sub {
    font-size: 0.8125rem;
  }
}

/* KPI-карточки (как на дашборде) */
.stat-card {
  position: relative;
  background: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  border-radius: 1rem;
  padding: 0.875rem;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

@media (hover: hover) {
  .stat-card:hover {
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.08);
    transform: translateY(-2px);
  }
}

.stat-icon {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.stat-icon-info {
  background: color-mix(in oklab, var(--color-info) 15%, transparent);
  color: var(--color-info);
}

.stat-icon-primary {
  background: color-mix(in oklab, var(--color-primary) 15%, transparent);
  color: var(--color-primary);
}

.stat-icon-warning {
  background: color-mix(in oklab, var(--color-warning) 18%, transparent);
  color: var(--color-warning);
}

.stat-icon-success {
  background: color-mix(in oklab, var(--color-success) 15%, transparent);
  color: var(--color-success);
}

.stat-num {
  font-size: 1.375rem;
  font-weight: 700;
  line-height: 1.15;
  color: var(--color-base-content);
}

.stat-label {
  font-size: 0.75rem;
  color: color-mix(in oklab, var(--color-base-content) 60%, transparent);
}

.stat-badge {
  display: inline-block;
  margin-top: 0.375rem;
  padding: 0.0625rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 600;
}

.stat-badge-warning {
  background: color-mix(in oklab, var(--color-warning) 16%, transparent);
  color: var(--color-warning);
}

/* Панели */
.panel {
  background: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  border-radius: 1rem;
  padding: 0.875rem 1rem;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.625rem;
}

.panel-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-base-content);
}

.panel-hint {
  font-size: 0.6875rem;
  color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
}

.panel-empty {
  padding: 1.25rem 0;
  text-align: center;
  font-size: 0.8125rem;
  color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
}

.panel-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* Пустой период */
.empty-icon {
  width: 3.5rem;
  height: 3.5rem;
  margin: 0 auto 0.75rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-base-200);
  color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
}

.empty-title {
  font-weight: 600;
  color: var(--color-base-content);
}

.empty-hint {
  margin-top: 0.25rem;
  font-size: 0.8125rem;
}

/* График: бары по дням */
.chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 1px;
  height: 10rem;
}

.chart-col {
  flex: 1 1 0%;
  min-width: 0;
  height: 100%;
  display: flex;
  align-items: flex-end;
}

.chart-bar {
  width: 100%;
  border-radius: 3px 3px 0 0;
  background: var(--color-primary);
  min-height: 2px;
  transition: height 0.3s ease;
}

.chart-bar-zero {
  background: color-mix(in oklab, var(--color-base-content) 12%, transparent);
  min-height: 1px;
}

.chart-labels {
  display: flex;
  gap: 1px;
  margin-top: 0.375rem;
}

.chart-label {
  flex: 1 1 0%;
  min-width: 0;
  text-align: center;
  font-size: 0.5625rem;
  color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
  visibility: hidden;
  white-space: nowrap;
}

.chart-label-visible {
  visibility: visible;
}

/* Топ товаров */
.top-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.625rem;
  background: color-mix(in oklab, var(--color-base-content) 3%, transparent);
  border-radius: 0.625rem;
}

.top-rank {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
  font-size: 0.6875rem;
  font-weight: 700;
  flex-shrink: 0;
}

.top-main {
  flex: 1 1 0%;
}

.top-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-base-content);
}

.top-bar-wrap {
  margin-top: 0.25rem;
  height: 0.375rem;
  border-radius: 9999px;
  background: var(--color-base-200);
  overflow: hidden;
}

.top-bar {
  height: 100%;
  border-radius: 9999px;
  background: var(--color-primary);
  min-width: 2px;
  transition: width 0.4s ease;
}

.top-nums {
  text-align: right;
  flex-shrink: 0;
}

.top-revenue {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-base-content);
}

.top-units {
  font-size: 0.6875rem;
  color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
}

/* Строки статусов/доставки/оплаты */
.row-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  background: color-mix(in oklab, var(--color-base-content) 3%, transparent);
  border-radius: 0.625rem;
  font-size: 0.8125rem;
}

.row-main {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.row-title {
  font-weight: 600;
  color: var(--color-base-content);
}

.row-value {
  font-weight: 700;
  color: var(--color-base-content);
  font-variant-numeric: tabular-nums;
}

/* Промокоды */
.promo-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.625rem;
  background: color-mix(in oklab, var(--color-base-content) 3%, transparent);
  border-radius: 0.625rem;
}

.promo-main {
  min-width: 0;
}

.promo-top {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.promo-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--color-base-content);
  background: color-mix(in oklab, var(--color-base-content) 6%, transparent);
  padding: 0.125rem 0.375rem;
  border-radius: 0.375rem;
}

.promo-value {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-primary);
}

.promo-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.25rem;
  font-size: 0.6875rem;
  color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
}

.promo-nums {
  text-align: right;
  flex-shrink: 0;
}

.promo-revenue {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-base-content);
  font-variant-numeric: tabular-nums;
}

.promo-sub {
  font-size: 0.6875rem;
  color: color-mix(in oklab, var(--color-base-content) 55%, transparent);
}
</style>

<script setup>
//- admin-only daisyUI-компоненты (dropdown/file-input/table): см. app/assets/css/admin.css
import '~/assets/css/admin.css'
//- Валюта — единый formatMoney из store.config (₽ / $ по конфигу витрины)
import { formatMoney } from '../../../store.config'
import Header from '~/components/layout/Header.vue'
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'

definePageMeta({
  middleware: 'manager-auth'
})

const { $notify } = useNuxtApp()
const { t } = useI18n()

//- Окна периода: 7/30/90 дней (кнопки); сервер клампит 1..365
const periods = computed(() => [
  { days: 7, label: t('admin.analytics.period7') },
  { days: 30, label: t('admin.analytics.period30') },
  { days: 90, label: t('admin.analytics.period90') },
])

const period = ref(30)
const loading = ref(false)
const firstLoaded = ref(false)
const data = ref(null)

//- Реактивные проекции ответа: до первой загрузки — безопасные нули
const summary = computed(() => data.value?.summary ?? { orders: 0, paidOrders: 0, cancelled: 0, revenue: 0, aov: 0, units: 0 })
const series = computed(() => data.value?.series ?? [])
const topProducts = computed(() => data.value?.topProducts ?? [])
const byStatus = computed(() => data.value?.byStatus ?? {})
const byDelivery = computed(() => data.value?.byDelivery ?? {})
const byPayment = computed(() => data.value?.byPayment ?? {})
const promoCodes = computed(() => data.value?.promoCodes ?? [])
const hasData = computed(() => (summary.value.orders ?? 0) > 0)
const maxRevenue = computed(() => Math.max(...series.value.map((d) => d.revenue), 0))
const maxTopRevenue = computed(() => Math.max(...topProducts.value.map((p) => p.revenue), 0))

const kpis = computed(() => [
  {
    label: t('admin.analytics.kpiOrders'),
    value: summary.value.orders,
    icon: 'heroicons:shopping-bag',
    tone: 'warning',
    badge: summary.value.cancelled > 0 ? t('admin.analytics.cancelledBadge', { n: summary.value.cancelled }) : ''
  },
  {
    label: t('admin.analytics.kpiRevenue'),
    value: formatPrice(summary.value.revenue),
    icon: 'heroicons:banknotes',
    tone: 'success'
  },
  {
    label: t('admin.analytics.kpiAov'),
    value: formatPrice(summary.value.aov),
    icon: 'heroicons:chart-bar',
    tone: 'info'
  },
  {
    label: t('admin.analytics.kpiUnits'),
    value: summary.value.units,
    icon: 'heroicons:cube',
    tone: 'primary'
  }
])

const load = async () => {
  loading.value = true
  try {
    const resp = await $fetch('/api/admin/analytics', { query: { days: period.value } })
    if (resp?.success) data.value = resp.analytics
  } catch (err) {
    console.error('[admin-analytics] Ошибка загрузки:', err?.data?.message || err?.message)
    $notify.error(t('admin.analytics.error'))
  } finally {
    loading.value = false
    firstLoaded.value = true
  }
}

const setPeriod = (days) => {
  if (period.value === days) return
  period.value = days
}

//- ─── CSV-экспорт: тот же blob-паттерн, что и выгрузка заказов ───────
//- Не <a href> — blob позволяет поймать 401/500 и показать тост,
//- а не молча отдать JSON-ошибку в файле.
const isExporting = ref(false)
const EXPORT_FILES = {
  'top-products': 'analytics-top-products',
  series: 'analytics-daily',
  'promo-codes': 'analytics-promo-codes',
}
const exportCsv = async (type) => {
  if (isExporting.value) return
  isExporting.value = true
  try {
    const blob = await $fetch('/api/admin/analytics/export', {
      query: { type, days: period.value },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${EXPORT_FILES[type]}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    $notify.success(t('admin.analytics.exportDone'))
  } catch (err) {
    console.error('[admin-analytics] Ошибка экспорта:', err?.data?.message || err?.message)
    $notify.error(t('admin.analytics.exportError'))
  } finally {
    isExporting.value = false
  }
}

//- ─── Промокоды: подписи статусов и формат скидки ────────────────────
//- Локальная promoValueLabel вместо серверной promoValueLabel:
//- серверный promoHelpers тащит KV-хелперы, в клиентский бандл нельзя.
const promoValueLabel = (p) => (p.type === 'percent' ? `${p.value}%` : formatPrice(p.value))

const promoStatusLabel = (p) => {
  if (p.issue === 'inactive') return t('admin.analytics.promoStatusInactive')
  if (p.issue === 'expired') return t('admin.analytics.promoStatusExpired')
  if (p.issue === 'limit') return t('admin.analytics.promoStatusLimit')
  if (p.type == null) return t('admin.analytics.promoStatusDeleted')
  if (p.active === false) return t('admin.analytics.promoStatusInactive')
  return t('admin.analytics.promoStatusActive')
}

const promoBadgeClass = (p) => {
  if (p.issue === 'inactive' || p.active === false) return 'badge-neutral'
  if (p.issue === 'expired' || p.issue === 'limit') return 'badge-warning'
  if (p.type == null) return 'badge-ghost'
  return 'badge-success'
}

//- «05.11.2026 14:30» из ISO (UTC — как в CSV-выгрузке, детерминированно)
const promoLastUsed = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

//- Смена периода — перезагрузка данных
watch(period, () => {
  load()
})

onMounted(() => {
  load()
})

//- ─── График ─────────────────────────────────────────────────────────
const barHeight = (revenue) => {
  if (revenue <= 0) return '1px'
  //- минимально заметный бар для маленьких сумм рядом с большими
  const percent = Math.max(4, Math.round((revenue / maxRevenue.value) * 100))
  return `${percent}%`
}

const barTitle = (d) =>
  `${shortDate(d.date)} — ${formatPrice(d.revenue)} · ${d.orders} ${t('admin.analytics.ordersCount')}`

//- Метки дней: показываем каждую N-ю (≈6 меток) — на 90 колонках
//- все подписи не читаются; шаг зависит от длины периода
const labelStep = computed(() => Math.max(1, Math.ceil(series.value.length / 6)))
const showLabel = (i) => i % labelStep.value === 0 || i === series.value.length - 1

//- «05.11» из «2026-11-05» — без Date-парсинга: таймзона браузера
//- не сдвигает день (сервер бакетит дни по UTC)
const shortDate = (iso) => `${iso.slice(8)}.${iso.slice(5, 7)}`

//- ─── Топ товаров ────────────────────────────────────────────────────
const topWidth = (revenue) => {
  if (maxTopRevenue.value <= 0) return '0%'
  return `${Math.max(3, Math.round((revenue / maxTopRevenue.value) * 100))}%`
}

const formatPrice = (price) => formatMoney(price)

//- ─── Подписи статусов/доставки/оплаты (зеркалим admin/orders.vue) ──
const STATUS_KEYS = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled']
const STATUS_LABELS = computed(() => ({
  new: t('admin.orders.statusNew'),
  confirmed: t('admin.orders.statusConfirmed'),
  shipped: t('admin.orders.statusShipped'),
  delivered: t('admin.orders.statusDelivered'),
  cancelled: t('admin.orders.statusCancelled'),
}))
const statusLabel = (s) => STATUS_LABELS.value[s] ?? s

const statusBadgeClass = (s) =>
  (
    {
      new: 'badge-warning',
      confirmed: 'badge-info',
      shipped: 'badge-primary',
      delivered: 'badge-success',
      cancelled: 'badge-error',
    }[s] || 'badge-neutral'
  )

const deliveryLabel = (m) =>
  m === 'courier' ? t('admin.orders.deliveryCourier') : m === 'post' ? t('admin.orders.deliveryPost') : t('admin.orders.deliveryPickup')

const paymentLabel = (m) =>
  (
    {
      card: t('admin.orders.paymentCard'),
      cash: t('admin.orders.paymentCash'),
      transfer: t('admin.orders.paymentTransfer'),
    }[m] || m
  )
</script>
