<!-- pages/admin/index.vue — дашборд администратора.
     Данные — только с сервера: сводка /api/admin/stats + последние
     заказы /api/orders (limit 5). Демо-метрики и рандом убраны —
     воркеры Cloudflare их не отдают. Разметка 2024+: KPI-карточки,
     плитки быстрых действий, панели заказов/пользователей,
     индикатор склада ( раньше — сломанные классы lg_grid-cols-4,
     из-за которых сетка не расходилась на десктопе). -->
<template lang="pug">
.admin-dashboard.mobile-nav-safe
  Header
  main.container.mx-auto.px-3.py-4(class="sm:px-4 lg:px-6")
    //- Приветствие и управление
    .flex.flex-col.gap-3(class="sm:flex-row sm:items-center sm:justify-between")
      .flex.items-center.gap-3
        .dash-avatar
          icon(name="heroicons:shield-user" size="22")
        div
          h1.text-xl.font-bold.text-base-content Панель администратора
          p.dash-sub {{ appState.user?.name || 'Администратор' }} · {{ todayLabel }}
      .flex.gap-2
        button.btn.btn-sm.btn-ghost.rounded-xl(:disabled="loading" @click="refreshStats" aria-label="Обновить данные")
          icon(name="heroicons:arrow-path" size="18" :class="{ 'animate-spin': loading }")
          span.hidden(class="sm:inline") Обновить
        button.btn.btn-sm.btn-outline.rounded-xl(
          class="hover:bg-error hover:text-error-content hover:border-error"
          @click="handleLogout"
        )
          icon(name="heroicons:arrow-right-on-rectangle" size="18")
          span Выйти

    //- KPI-карточки
    .grid.grid-cols-2.gap-3.mt-4(class="lg:grid-cols-4")
      .stat-card(v-for="kpi in kpis" :key="kpi.label")
        .stat-icon(:class="`stat-icon-${kpi.tone}`")
          icon(:name="kpi.icon" size="20")
        .stat-num {{ kpi.value }}
        .stat-label {{ kpi.label }}
        .stat-badge(v-if="kpi.badge" :class="`stat-badge-${kpi.tone}`") {{ kpi.badge }}

    //- Быстрые действия
    .grid.grid-cols-2.gap-3.mt-4(class="lg:grid-cols-4")
      NuxtLink.quick-tile(v-for="q in quickLinks" :key="q.to" :to="q.to" prefetch)
        .quick-icon
          icon(:name="q.icon" size="20")
        .quick-text
          .quick-title {{ q.title }}
          .quick-sub {{ q.sub }}
        icon.quick-arrow(name="heroicons:chevron-right" size="16")

    //- Последние заказы и пользователи
    .grid.grid-cols-1.gap-3.mt-4(class="lg:grid-cols-2")
      .panel
        .panel-head
          h2.panel-title Последние заказы
          NuxtLink.panel-link(to="/admin/orders" prefetch) Все заказы
        .panel-empty(v-if="!realStats.recentOrders.length") Заказов пока нет
        .panel-list(v-else)
          .row-item(v-for="order in realStats.recentOrders" :key="order.id")
            .row-main
              .row-title Заказ {{ order.id }}
              .row-sub {{ order.date }}
            span.badge.badge-sm(:class="getOrderStatusClass(order.status)") {{ statusLabel(order.status) }}

      .panel
        .panel-head
          h2.panel-title Последние пользователи
          NuxtLink.panel-link(to="/admin/users" prefetch) Все пользователи
        .panel-empty(v-if="!realStats.recentUsers.length") Пользователей пока нет
        .panel-list(v-else)
          .row-item(v-for="user in realStats.recentUsers" :key="user.id")
            .row-main
              .flex.items-center.gap-2.min-w-0
                .user-avatar {{ getUserInitials(user.name) }}
                .min-w-0
                  .row-title.truncate {{ user.name }}
                  .row-sub.truncate {{ user.email }}
            span.badge.badge-sm(:class="getRoleBadgeClass(user.role)") {{ getUserRoleText(user.role) }}

    //- Склад и система
    .grid.grid-cols-1.gap-3.mt-4(class="lg:grid-cols-2")
      .panel
        .panel-head
          h2.panel-title Наличие на складе
        .stock-bar(role="img" :aria-label="`В наличии ${realStats.inStock} из ${realStats.totalProducts}`")
          .stock-fill(:style="{ width: stockPercent + '%' }")
        .stock-legend
          span ✓ В наличии: {{ realStats.inStock }}
          span(class="text-error") ✕ Нет в наличии: {{ realStats.outOfStock }}

      .panel
        .panel-head
          h2.panel-title Система
        .panel-list
          .row-item
            .row-main
              .row-title Кэш каталога: попадания
            span.badge.badge-sm.badge-success {{ realStats.cacheHits }}
          .row-item
            .row-main
              .row-title Кэш: промахи / записей
            span.badge.badge-sm.badge-info {{ realStats.cacheMisses }} / {{ realStats.cacheSize }}

  //- Мобильная навигация: только < 768px (как на витрине)
  MobileNavFooter(v-if="isMobile")
</template>

<style scoped>
.admin-dashboard {
  min-height: calc(80dvh - 14px);
}

/* Приветствие */
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

/* KPI-карточки */
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

.stat-badge-info {
  background: color-mix(in oklab, var(--color-info) 14%, transparent);
  color: var(--color-info);
}

.stat-badge-primary {
  background: color-mix(in oklab, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
}

.stat-badge-warning {
  background: color-mix(in oklab, var(--color-warning) 16%, transparent);
  color: var(--color-warning);
}

.stat-badge-success {
  background: color-mix(in oklab, var(--color-success) 14%, transparent);
  color: var(--color-success);
}

/* Плитки быстрых действий */
.quick-tile {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem;
  background: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  border-radius: 1rem;
  transition: border-color 0.15s ease, box-shadow 0.2s ease;
}

@media (hover: hover) {
  .quick-tile:hover {
    border-color: color-mix(in oklab, var(--color-primary) 45%, transparent);
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.07);
  }
}

.quick-icon {
  width: 2.125rem;
  height: 2.125rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-base-200);
  color: var(--color-base-content);
  flex-shrink: 0;
}

.quick-text {
  min-width: 0;
}

.quick-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-base-content);
}

.quick-sub {
  font-size: 0.6875rem;
  color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quick-arrow {
  margin-left: auto;
  color: color-mix(in oklab, var(--color-base-content) 40%, transparent);
  flex-shrink: 0;
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

.panel-link {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary);
}

.panel-empty {
  padding: 1rem 0;
  text-align: center;
  font-size: 0.8125rem;
  color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
}

.panel-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

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

.row-sub {
  font-size: 0.6875rem;
  color: color-mix(in oklab, var(--color-base-content) 50%, transparent);
}

.user-avatar {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--color-primary) 14%, transparent);
  color: var(--color-primary);
  font-size: 0.6875rem;
  font-weight: 700;
  flex-shrink: 0;
}

/* Склад: индикатор заполненности */
.stock-bar {
  height: 0.625rem;
  border-radius: 9999px;
  background: var(--color-base-200);
  overflow: hidden;
}

.stock-fill {
  height: 100%;
  border-radius: 9999px;
  background: var(--color-success);
  transition: width 0.4s ease;
  min-width: 2px;
}

.stock-legend {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: color-mix(in oklab, var(--color-base-content) 60%, transparent);
}
</style>

<script setup>
definePageMeta({
  middleware: 'admin-auth'
})

const { isMobile } = useMobileDetection()

import Header from '~/components/layout/Header.vue'
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'

const { $notify } = useNuxtApp()
const appState = useAppState()

// Реальная статистика: сводка с /api/admin/stats + последние заказы
// с /api/orders. Всё, что отображается, приходит с сервера.
const realStats = ref({
  totalUsers: 0,
  totalProducts: 0,
  totalOrders: 0,
  revenue: 0,
  newUsers: 0,
  pendingOrders: 0,
  inStock: 0,
  outOfStock: 0,
  cacheHits: 0,
  cacheMisses: 0,
  cacheSize: 0,
  recentUsers: [],
  recentOrders: []
})

const loading = ref(false)
const todayLabel = ref('')

// Заголовок KPI-карточек: значения из реальной статистики
const kpis = computed(() => [
  {
    label: 'Пользователи',
    value: realStats.value.totalUsers,
    icon: 'heroicons:users',
    tone: 'info',
    badge: realStats.value.newUsers > 0 ? `+${realStats.value.newUsers} за неделю` : ''
  },
  {
    label: 'Товары',
    value: realStats.value.totalProducts,
    icon: 'heroicons:cube',
    tone: 'primary',
    badge: `${realStats.value.inStock} в наличии`
  },
  {
    label: 'Заказы',
    value: realStats.value.totalOrders,
    icon: 'heroicons:shopping-bag',
    tone: 'warning',
    badge: realStats.value.pendingOrders > 0 ? `${realStats.value.pendingOrders} ожидает` : ''
  },
  {
    label: 'Доход',
    value: formatPrice(realStats.value.revenue),
    icon: 'heroicons:banknotes',
    tone: 'success',
    badge: 'За всё время'
  }
])

// Плитки быстрых действий
const quickLinks = [
  { to: '/admin/products', title: 'Товары', sub: 'Каталог и склад', icon: 'heroicons:cube' },
  { to: '/admin/orders', title: 'Заказы', sub: 'Подтверждение и статусы', icon: 'heroicons:shopping-bag' },
  { to: '/admin/news', title: 'Новости', sub: 'Публикации и товары', icon: 'heroicons:newspaper' },
  { to: '/admin/users', title: 'Пользователи', sub: 'Роли и доступы', icon: 'heroicons:users' }
]

// Заполненность склада: доля товаров в наличии
const stockPercent = computed(() => {
  const total = realStats.value.totalProducts
  return total > 0 ? Math.round((realStats.value.inStock / total) * 100) : 0
})

// Загрузка реальной статистики: сводка + последние заказы одним параллельным
// запросом. Сбой /api/orders не роняет карточку статистики (catch → null).
const loadStats = async () => {
  try {
    loading.value = true

    const [stats, ordersResp] = await Promise.all([
      $fetch('/api/admin/stats'),
      $fetch('/api/orders', { query: { limit: 5 } }).catch(() => null),
    ])

    const s = stats?.stats ?? {}
    realStats.value.totalUsers = s.users?.total ?? 0
    realStats.value.totalProducts = s.products?.total ?? 0
    realStats.value.totalOrders = s.orders?.total ?? 0
    realStats.value.revenue = s.orders?.totalRevenue ?? 0
    realStats.value.newUsers = s.users?.newWeek ?? 0
    realStats.value.pendingOrders = s.orders?.pending ?? 0
    realStats.value.inStock = s.products?.inStock ?? 0
    realStats.value.outOfStock = s.products?.outOfStock ?? 0
    realStats.value.cacheHits = s.cache?.hits ?? 0
    realStats.value.cacheMisses = s.cache?.misses ?? 0
    realStats.value.cacheSize = s.cache?.size ?? 0
    realStats.value.recentUsers = (stats?.recentUsers ?? []).slice(0, 5)
    realStats.value.recentOrders = (ordersResp?.orders ?? []).map((o) => ({
      id: o.id,
      status: o.status,
      date: relativeTime(o.createdAt),
    }))
  } catch (err) {
    console.error('❌ Ошибка загрузки статистики:', err)
    $notify.error('Ошибка загрузки статистики')
  } finally {
    loading.value = false
    updateCurrentTime()
  }
}

// Обновление статистики
const refreshStats = async () => {
  await loadStats()
  if (!loading.value) $notify.success('Статистика обновлена')
}

// Выход из системы
const handleLogout = async () => {
  try {
    const result = await appState.logout()

    if (result.success) {
      $notify.success('Вы успешно вышли из системы')
      await navigateTo('/')
    } else {
      throw new Error(result.error)
    }
  } catch (error) {
    console.error('❌ Ошибка выхода:', error)
    $notify.error('Ошибка при выходе из системы')
  }
}

// Вспомогательные функции
const getUserInitials = (name) => {
  if (!name) return 'U'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const getRoleBadgeClass = (role) => {
  const classes = {
    admin: 'badge-primary',
    manager: 'badge-secondary',
    user: 'badge-accent'
  }
  return classes[role] || 'badge-neutral'
}

const getUserRoleText = (role) => {
  const texts = {
    admin: 'Админ',
    manager: 'Менеджер',
    user: 'Пользователь'
  }
  return texts[role] || role
}

// Статусы заказов: зеркалим ORDER_STATUS_LABELS сервера (ключи 'new'…)
const STATUS_LABELS = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  shipped: 'В доставке',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
}
const statusLabel = (s) => STATUS_LABELS[s] ?? s

const getOrderStatusClass = (status) => {
  const classes = {
    new: 'badge-warning',
    confirmed: 'badge-info',
    shipped: 'badge-primary',
    delivered: 'badge-success',
    cancelled: 'badge-error'
  }
  return classes[status] || 'badge-neutral'
}

// «2 мин назад» для последних заказов
const relativeTime = (iso) => {
  if (!iso) return ''
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMin < 1) return 'только что'
  if (diffMin < 60) return `${diffMin} мин назад`
  const h = Math.floor(diffMin / 60)
  if (h < 24) return `${h} ч назад`
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatPrice = (price) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0
  }).format(price)
}

// «31 октября, 14:05» — только на клиенте (после загрузки данных),
// чтобы сервер и браузер гарантированно не разошлись в тексте
const updateCurrentTime = () => {
  const now = new Date()
  todayLabel.value =
    now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) +
    ', ' +
    now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

let clockTimer = null

// Загружаем статистику при монтировании
onMounted(async () => {
  await loadStats()
  // Обновляем время каждую минуту
  clockTimer = setInterval(updateCurrentTime, 60000)
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
})
</script>
