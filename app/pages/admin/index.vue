<!-- pages/admin/index.vue -->
<template lang="pug">
.admin-dashboard
  Header
  .container.mx-auto.px-4
    //- Заголовок и управление
    .card.bg-base-100.shadow-sm.mb-4(class="sm:ml-10")
      .card-body.py-4
        .flex.flex-col.sm_flex-row.justify-between.items-start.sm_items-center.gap-3
          .flex.items-center.gap-3
            .avatar
              .w-10.h-10.rounded-full.bg-primary.flex.items-center.justify-center.text-white
                span.text-sm.font-bold A
            div
              h1.text-lg.font-bold.text-base-content Панель администратора
              p.text-xs.text-base-content.opacity-70 {{ appState.user?.name || 'Администратор' }} • {{ currentTime }}
          
          .flex.flex-wrap.gap-2
            .badge.badge-primary.badge-sm Админ
            button.btn.btn-xs.btn-error(@click="handleLogout")
              svg.w-3.h-3.mr-1(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1")
              span.text-xs Выйти

    //- Основная статистика - 4 карточки в ряд
    .grid.grid-cols-2.lg_grid-cols-4.gap-3.mb-4(class="sm:ml-16")
      //- Пользователи
      .card.compact.bg-base-100.shadow-xs.border
        .card-body.p-3
          .flex.items-center.gap-2
            .w-8.h-8.rounded-full.bg-blue-100.flex.items-center.justify-center
              svg.w-4.h-4.text-blue-600(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z")
            div
              p.text-lg.font-bold.text-base-content {{ realStats.totalUsers }}
              p.text-xs.text-base-content.opacity-70 Пользователи
          .badge.badge-xs.badge-outline.badge-success.mt-1(v-if="realStats.newUsers > 0") +{{ realStats.newUsers }}

      //- Товары
      .card.compact.bg-base-100.shadow-xs.border
        .card-body.p-3
          .flex.items-center.gap-2
            .w-8.h-8.rounded-full.bg-green-100.flex.items-center.justify-center
              svg.w-4.h-4.text-green-600(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4")
            div
              p.text-lg.font-bold.text-base-content {{ realStats.totalProducts }}
              p.text-xs.text-base-content.opacity-70 Товары
          .badge.badge-xs.badge-outline.mt-1 В каталоге

      //- Заказы
      .card.compact.bg-base-100.shadow-xs.border
        .card-body.p-3
          .flex.items-center.gap-2
            .w-8.h-8.rounded-full.bg-purple-100.flex.items-center.justify-center
              svg.w-4.h-4.text-purple-600(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z")
            div
              p.text-lg.font-bold.text-base-content {{ realStats.totalOrders }}
              p.text-xs.text-base-content.opacity-70 Заказы
          .badge.badge-xs.badge-outline.badge-warning.mt-1(v-if="realStats.pendingOrders > 0") {{ realStats.pendingOrders }} ожидает

      //- Доход
      .card.compact.bg-base-100.shadow-xs.border
        .card-body.p-3
          .flex.items-center.gap-2
            .w-8.h-8.rounded-full.bg-orange-100.flex.items-center.justify-center
              svg.w-4.h-4.text-orange-600(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1")
            div
              p.text-lg.font-bold.text-base-content {{ formatPrice(realStats.revenue) }}
              p.text-xs.text-base-content.opacity-70 Доход
          .badge.badge-xs.badge-outline.badge-success.mt-1 За месяц

    //- Три колонки: пользователи, заказы, действия
    .grid.grid-cols-1.lg_grid-cols-3.gap-3.mb-4(class="sm:ml-16")
      //- Активность пользователей
      .card.compact.bg-base-100.shadow-xs.border
        .card-body.p-3
          .flex.justify-between.items-center.mb-2
            h2.card-title.text-md.font-semibold Активность
            .text-xs.text-base-content.opacity-70 Сегодня
            
          .space-y-2
            .flex.items-center.justify-between.p-2.bg-base-200.rounded.text-xs
              span Новые регистрации
              .badge.badge-sm.badge-success +{{ realStats.todayUsers }}
            
            .flex.items-center.justify-between.p-2.bg-base-200.rounded.text-xs
              span Активные сессии
              .badge.badge-sm.badge-info {{ realStats.activeSessions }}
            
            .flex.items-center.justify-between.p-2.bg-base-200.rounded.text-xs
              span Онлайн сейчас
              .badge.badge-sm.badge-primary {{ realStats.onlineNow }}

      //- Последние заказы
      .card.compact.bg-base-100.shadow-xs.border
        .card-body.p-3
          .flex.justify-between.items-center.mb-2
            h2.card-title.text-md.font-semibold Последние заказы
            NuxtLink.btn.btn-xs.btn-outline(to="/admin/orders" prefetch) 
              span.text-xs Все
              svg.w-3.h-3.ml-1(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7")
          
          .space-y-2(v-if="realStats.recentOrders.length > 0")
            .flex.items-center.justify-between.p-2.bg-base-200.rounded.text-xs(
              v-for="order in realStats.recentOrders" 
              :key="order.id"
            )
              .flex.items-center.gap-2
                .w-6.h-6.rounded-full.bg-primary.flex.items-center.justify-center.text-white.text-xs
                  span №
                div
                  .font-medium Заказ {{ order.id }}
                  .text-xs.opacity-70 {{ order.date }}
              .badge.badge-sm(
                :class="getOrderStatusClass(order.status)"
              ) {{ order.status }}
          
          .text-center.py-2(v-else)
            .text-sm.text-base-content.opacity-60 Нет заказов

      //- Быстрый доступ
      .card.compact.bg-base-100.shadow-xs.border
        .card-body.p-3
          h2.card-title.text-md.font-semibold.mb-2 Быстрый доступ
          .grid.grid-cols-2.gap-2
            button.btn.btn-primary.btn-xs(@click="navigateToPath('/admin/users')")
              svg.w-3.h-3.mr-1(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z")
              span.text-xs Пользователи
            
            button.btn.btn-outline.btn-xs(@click="navigateToPath('/admin/products')")
              svg.w-3.h-3.mr-1(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4")
              span.text-xs Товары
            
            button.btn.btn-outline.btn-xs(@click="navigateToPath('/admin/orders')")
              svg.w-3.h-3.mr-1(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z")
              span.text-xs Заказы
            
            button.btn.btn-outline.btn-xs(@click="navigateToPath('/admin/categories')")
              svg.w-3.h-3.mr-1(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10")
              span.text-xs Категории

    //- Две колонки: пользователи и статистика
    .grid.grid-cols-1.lg_grid-cols-2.gap-3(class="sm:ml-16")
      //- Последние пользователи
      .card.compact.bg-base-100.shadow-xs.border
        .card-body.p-3
          .flex.justify-between.items-center.mb-2
            h2.card-title.text-md.font-semibold Последние пользователи
            NuxtLink.btn.btn-xs.btn-outline(to="/admin/users" prefetch) 
              span.text-xs Все
              svg.w-3.h-3.ml-1(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7")
          
          .space-y-2(v-if="realStats.recentUsers.length > 0")
            .flex.items-center.justify-between.p-2.bg-base-200.rounded.text-xs(
              v-for="user in realStats.recentUsers" 
              :key="user.id"
            )
              .flex.items-center.gap-2
                .avatar
                  .w-6.h-6.rounded-full.bg-primary.flex.items-center.justify-center.text-white.text-xs.font-bold
                    span {{ getUserInitials(user.name) }}
                div
                  .font-medium {{ user.name }}
                  .text-xs.opacity-70 {{ user.email }}
              .badge.badge-sm(
                :class="getRoleBadgeClass(user.role)"
              ) {{ getUserRoleText(user.role) }}
          
          .text-center.py-2(v-else)
            .text-sm.text-base-content.opacity-60 Нет пользователей

      //- Статистика системы
      .card.compact.bg-base-100.shadow-xs.border
        .card-body.p-3
          .flex.justify-between.items-center.mb-2
            h2.card-title.text-md.font-semibold Статистика системы
            .flex.gap-1
              button.btn.btn-xs.btn-ghost(@click="refreshStats" :disabled="loading")
                svg.w-3.h-3(:class="{ 'animate-spin': loading }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                  path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15")
          
          .space-y-2
            .flex.justify-between.items-center.p-2.bg-base-200.rounded.text-xs
              span Загрузка сервера
              .badge.badge-sm(:class="getLoadClass(realStats.serverLoad)") {{ realStats.serverLoad }}%
            
            .flex.justify-between.items-center.p-2.bg-base-200.rounded.text-xs
              span Использование памяти
              .badge.badge-sm.badge-info {{ realStats.memoryUsage }}
            
            .flex.justify-between.items-center.p-2.bg-base-200.rounded.text-xs
              span Активные подключения
              .badge.badge-sm.badge-warning {{ realStats.activeConnections }}
            
            .flex.justify-between.items-center.p-2.bg-base-200.rounded.text-xs
              span Время работы
              .badge.badge-sm.badge-success {{ realStats.uptime }}

    //- Отладочная информация (скрыта по умолчанию)
    .card.bg-warning.bg-opacity-10.border.border-warning.border-opacity-20.mt-3(v-if="debugInfo && showDebug")
      .card-body.p-2
        .flex.items-center.justify-between.mb-1
          .flex.items-center.gap-1
            svg.w-3.h-3.text-warning(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
              path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z")
            span.text-xs.font-medium Отладка
          .flex.gap-1
            button.btn.btn-xs(@click="showDebug = false") ×
            button.btn.btn-xs.btn-warning(@click="testApiConnection") Тест API
        pre.text-xs {{ debugInfo }}
      
      .loading.loading-spinner.loading-xs.text-primary(v-if="loading")

  MobileNavFooter
</template>

<style scoped>
.admin-dashboard {
  min-height: calc(80dvh - 14px);
}

.card.compact .card-body {
  padding: 0.75rem;
}
</style>

<script setup>
definePageMeta({
  middleware: 'admin-auth'
})

import Header from '~/components/layout/Header.vue'
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'

const { $notify } = useNuxtApp()
const appState = useAppState()

// Реальная статистика с демо-данными
const realStats = ref({
  totalUsers: 1247,
  totalProducts: 563,
  totalOrders: 892,
  revenue: 284500,
  newUsers: 23,
  todayUsers: 8,
  activeSessions: 42,
  onlineNow: 18,
  pendingOrders: 12,
  serverLoad: 45,
  memoryUsage: '1.2/4GB',
  activeConnections: 156,
  uptime: '12д 4ч',
  recentUsers: [
    { id: 1, name: 'Иван Петров', email: 'ivan@mail.com', role: 'user' },
    { id: 2, name: 'Мария Сидорова', email: 'maria@mail.com', role: 'user' },
    { id: 3, name: 'Алексей Козлов', email: 'alex@mail.com', role: 'manager' },
    { id: 4, name: 'Елена Новикова', email: 'elena@mail.com', role: 'user' },
    { id: 5, name: 'Дмитрий Волков', email: 'dmitry@mail.com', role: 'user' }
  ],
  recentOrders: [
    { id: 1001, date: '2 мин назад', status: 'Обработан', amount: 12500 },
    { id: 1002, date: '5 мин назад', status: 'В обработке', amount: 8400 },
    { id: 1003, date: '12 мин назад', status: 'Доставляется', amount: 15600 },
    { id: 1004, date: '18 мин назад', status: 'Новый', amount: 9200 }
  ]
})

const loading = ref(false)
const debugInfo = ref('')
const showDebug = ref(false)
const currentTime = ref('')

// Загрузка статистики
const loadStats = async () => {
  try {
    loading.value = true
    
    // Симуляция загрузки реальных данных
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Обновляем некоторые данные для реализма
    realStats.value.todayUsers = Math.floor(Math.random() * 10) + 5
    realStats.value.onlineNow = Math.floor(Math.random() * 10) + 15
    realStats.value.activeSessions = Math.floor(Math.random() * 20) + 35
    realStats.value.serverLoad = Math.floor(Math.random() * 30) + 30
    realStats.value.pendingOrders = Math.floor(Math.random() * 5) + 8
    
    debugInfo.value = 'Статистика обновлена: ' + new Date().toLocaleString()
    
  } catch (err) {
    console.error('❌ Ошибка загрузки статистики:', err)
    debugInfo.value = `Ошибка: ${err.message}`
    $notify.error('Ошибка загрузки статистики')
  } finally {
    loading.value = false
    updateCurrentTime()
  }
}

// Тест подключения к API
const testApiConnection = async () => {
  try {
    debugInfo.value = 'Тестирование API...'
    const { data, error } = await useFetch('/api/admin/stats')
    
    if (error.value) {
      debugInfo.value = `Ошибка API: ${error.value.statusCode} - ${error.value.statusMessage}`
    } else {
      debugInfo.value = `Ответ API: ${JSON.stringify(data.value, null, 2)}`
    }
  } catch (error) {
    debugInfo.value = `Исключение: ${error.message}`
  }
}

// Обновление статистики
const refreshStats = async () => {
  await loadStats()
  $notify.success('Статистика обновлена')
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

const getOrderStatusClass = (status) => {
  const classes = {
    'Новый': 'badge-warning',
    'В обработке': 'badge-info',
    'Обработан': 'badge-success',
    'Доставляется': 'badge-primary',
    'Отменен': 'badge-error'
  }
  return classes[status] || 'badge-neutral'
}

const getLoadClass = (load) => {
  if (load < 50) return 'badge-success'
  if (load < 80) return 'badge-warning'
  return 'badge-error'
}

const formatPrice = (price) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0
  }).format(price)
}

const navigateToPath = async (path) => {
  await navigateTo(path)
}

const updateCurrentTime = () => {
  const now = new Date()
  currentTime.value = now.toLocaleTimeString('ru-RU', { 
    hour: '2-digit', 
    minute: '2-digit'
  })
}

// Загружаем статистику при монтировании
onMounted(async () => {
  await loadStats()
  // Обновляем время каждую минуту
  setInterval(updateCurrentTime, 60000)
})
</script>