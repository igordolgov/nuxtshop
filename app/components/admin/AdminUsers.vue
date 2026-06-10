<!-- app\components\AdminUsers.vue -->
<template lang="pug">
.admin-users
  .container.mx-auto.p-6
    .card.bg-base-100.shadow-xl
      .card-body
        .flex.justify-between.items-center.mb-6
          h1.card-title Управление пользователями
          .badge.badge-primary.badge-lg Администратор
          .flex.gap-2
            button.btn.btn-primary(@click="refreshData")
              svg.w-4.h-4.mr-2(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15")
              | Обновить

        //- Оповещение о правах
        .alert.alert-info.mb-6
          svg.w-6.h-6(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
            path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z")
          span Вы вошли как администратор

        //- Статистика
        .stats.stats-horizontal.shadow.mb-6
          .stat
            .stat-title Всего пользователей
            .stat-value.text-primary {{ totalUsers }}
            .stat-desc Всего в системе
          .stat
            .stat-title Администраторы
            .stat-value.text-secondary {{ adminCount }}
            .stat-desc Имеют полный доступ
          .stat
            .stat-title Менеджеры
            .stat-value.text-accent {{ managerCount }}
            .stat-desc Ограниченный доступ
          .stat
            .stat-title Пользователи
            .stat-value {{ userCount }}
            .stat-desc Обычные пользователи

        //- Фильтры и поиск
        .flex.flex-col.gap-4.mb-6(class="sm:flex-row")
          .form-control.flex-1
            .join.w-full
              input.input.input-bordered.join-item.flex-grow(
                type="text" 
                placeholder="Поиск пользователей..."
                v-model="searchQuery"
              )
              select.select.select-bordered.join-item(v-model="filterRole")
                option(value="") Все роли
                option(value="admin") Администратор
                option(value="user") Пользователь
                option(value="manager") Менеджер

          .form-control
            select.select.select-bordered(v-model="itemsPerPage")
              option(10) 10 на странице
              option(25) 25 на странице
              option(50) 50 на странице

        //- Загрузка
        .text-center.py-8(v-if="loading")
          .loading.loading-spinner.loading-lg.text-primary
          p.mt-4.text-base-content.opacity-70 Загрузка пользователей...

        //- Таблица пользователей
        .overflow-x-auto(v-else-if="paginatedUsers.length > 0")
          table.table.table-zebra
            thead
              tr
                th Пользователь
                th Роль
                th Статус
                th Телефон
                th Дата регистрации
                th Действия
            tbody
              tr(v-for="user in paginatedUsers" :key="user.id")
                td
                  .flex.items-center.gap-3
                    .avatar
                      .w-10.rounded-full.bg-primary.text-primary-content.flex.items-center.justify-center
                        span.text-sm {{ getUserInitials(user) }}
                    div
                      .font-bold {{ user.name }}
                      .text-sm.text-base-content.opacity-70 {{ user.email }}
                td
                  select.select.select-sm.select-bordered(
                    :value="user.role"
                    @change="updateUserRole(user.id, $event.target.value)"
                    :disabled="user.id === currentUser?.id"
                  )
                    option(value="user") Пользователь
                    option(value="manager") Менеджер
                    option(value="admin") Администратор
                  .text-xs.text-warning.mt-1(v-if="user.id === currentUser?.id") Нельзя изменить свою роль
                td
                  .badge.badge-success.badge-sm Активен
                td
                  .text-sm {{ user.phone || 'Не указан' }}
                td {{ formatDate(user.createdAt) }}
                td
                  .flex.gap-1
                    button.btn.btn-ghost.btn-sm(
                      @click="viewUserProfile(user)" 
                      title="Просмотр профиля"
                    )
                      svg.w-4.h-4(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
                        path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z")
                        path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z")

        //- Пустое состояние
        .text-center.py-12(v-else)
          .text-4xl.mb-4.opacity-30 👥
          h3.text-lg.font-semibold.mb-2 Пользователи не найдены
          p.text-sm.opacity-70.mb-4 Попробуйте изменить фильтры поиска

        //- Пагинация
        .flex.justify-between.items-center.mt-6(v-if="!loading && filteredUsers.length > 0")
          .text-sm.text-base-content.opacity-70
            | Показано {{ paginatedUsers.length }} из {{ filteredUsers.length }} пользователей
          .join
            button.join-item.btn(
              v-for="page in totalPages"
              :key="page"
              :class="{ 'btn-active': currentPage === page }"
              @click="currentPage = page"
            ) {{ page }}
</template>

<script setup>
// Используем middleware для защиты админ-роута
definePageMeta({
  middleware: 'admin-auth'
})

const { $notify } = useNuxtApp()
const { user: currentUser } = useAuth()

// Данные
const users = ref([])
const loading = ref(true)
const searchQuery = ref('')
const filterRole = ref('')
const itemsPerPage = ref(10)
const currentPage = ref(1)

// Загрузка пользователей
const loadUsers = async () => {
  try {
    loading.value = true
    const data = await $fetch('/api/admin/users')
    users.value = data.users
  } catch (error) {
    console.error('Ошибка загрузки пользователей:', error)
    $notify.error('Ошибка загрузки пользователей')
  } finally {
    loading.value = false
  }
}

// Загружаем при монтировании
onMounted(() => {
  loadUsers()
})

// Computed свойства
const filteredUsers = computed(() => {
  return users.value.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesRole = !filterRole.value || user.role === filterRole.value
    return matchesSearch && matchesRole
  })
})

const totalPages = computed(() => {
  return Math.ceil(filteredUsers.value.length / itemsPerPage.value)
})

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredUsers.value.slice(start, end)
})

// Статистика
const totalUsers = computed(() => users.value.length)
const adminCount = computed(() => users.value.filter(u => u.role === 'admin').length)
const managerCount = computed(() => users.value.filter(u => u.role === 'manager').length)
const userCount = computed(() => users.value.filter(u => u.role === 'user').length)

// Методы
const refreshData = async () => {
  await loadUsers()
  $notify.success('Данные обновлены')
}

const getUserInitials = (user) => {
  return user.name.split(' ').map(n => n[0]).join('').toUpperCase()
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('ru-RU')
}

const updateUserRole = async (userId, newRole) => {
  try {
    const data = await $fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: { role: newRole }
    })
    
    // Обновляем локальные данные
    const userIndex = users.value.findIndex(u => u.id === userId)
    if (userIndex !== -1) {
      users.value[userIndex].role = newRole
    }
    
    $notify.success('Роль пользователя обновлена')
  } catch (error) {
    console.error('Ошибка обновления роли:', error)
    $notify.error('Ошибка при обновлении роли')
  }
}

const viewUserProfile = (user) => {
  $notify.info(`Просмотр профиля: ${user.name}`, 'Профиль пользователя')
}
</script>