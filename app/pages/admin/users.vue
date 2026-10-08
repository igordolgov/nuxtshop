<template lang="pug">
.admin-users-page.min-h-screen.bg-base-200.pb-14
  //- Хедер
  .bg-base-100.shadow-sm.sticky.top-0.z-10
    .container.mx-auto.p-2(class="sm:p-3 lg:p-4")
      .flex.justify-between.items-center.gap-2
        .flex-1.min-w-0
          h1.card-title.text-xl(class="lg:text-2xl") Пользователи
        .flex.items-center.gap-2
          .badge.badge-primary.badge-sm(class="lg:badge-md") Администратор
          NuxtLink.btn.btn-outline.btn-xs(class="lg:btn-sm" to="/admin") 
            span ← Назад

  .container.mx-auto.p-2(class="sm:p-3 lg:p-4")
    //- Сообщение о загрузке
    .text-center.py-6(v-if="loading")
      .loading.loading-spinner.loading-lg
      p.mt-2.text-sm Загрузка пользователей...

    //- Сообщение об ошибке
    template(v-else-if="error")
      .alert.alert-error.mb-2
        svg.w-4.h-4(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z")
        span.text-sm {{ error }}
        button.btn.btn-xs.btn-ghost.ml-auto(@click="loadUsers") Повторить

    //- Контент
    template(v-else)
      //- Десктоп: Таблица пользователей
      .card.bg-base-100.shadow-xl.hidden(v-if="users.length > 0" class="lg:block")
        .card-body.p-3
          .overflow-x-auto
            table.table.table-zebra.text-sm
              thead
                tr
                  th ID
                  th Имя
                  th Email
                  th Роль
                  th Телефон
                  th Зарегистрирован
                  th Действия
              tbody
                tr(v-for="user in users" :key="user.id")
                  td.font-mono.text-xs {{ user.id.slice(-6) }}
                  td {{ user.name }}
                  td {{ user.email }}
                  td
                    select.select.select-sm(
                      :value="user.role" 
                      @change="updateUserRole(user.id, $event.target.value)"
                      :disabled="user.id === currentUserId"
                    )
                      option.rlg(value="user") Пользователь
                      option(value="manager") Менеджер
                      option(value="admin") Администратор
                    .text-xs.opacity-60.mt-0-5(v-if="user.id === currentUserId") (это вы)
                  td {{ user.phone || '—' }}
                  td.text-xs {{ formatDate(user.createdAt) }}
                  td
                    .flex.gap-1
                      button.btn.btn-ghost.btn-xs(
                        @click="editUser(user)"
                        title="Редактировать профиль"
                      )
                        svg.w-4.h-4(fill="none" stroke="currentColor" viewBox="0 0 24 24")
                          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z")
                      button.btn.btn-error.btn-xs(
                        @click="deleteUser(user)"
                        :disabled="user.id === currentUserId"
                        title="Удалить пользователя"
                      )
                        svg.w-4.h-4(fill="none" stroke="currentColor" viewBox="0 0 24 24")
                          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16")

      //- Мобильный: Карточки пользователей
      .flex.flex-col.gap-2(v-if="users.length > 0" class="lg:hidden")
        .card.bg-base-100.p-3.shadow-md.border.border-secondary.rounded-lg(
          v-for="user in users" 
          :key="user.id"
        )
          .card-body.p-2
            //- Верхняя строка: имя и ID
            .flex.justify-between.items-start
              .flex-1.min-w-0
                h3.font-semibold.text-lg.truncate {{ user.name }}
                p.text-sm.opacity-60.font-mono ID: {{ user.id.slice(-6) }}
              .badge.rounded-sm.px-2(
                :class="user.role === 'admin' ? 'badge-primary' : user.role === 'manager' ? 'badge-secondary' : 'badge-ghost'"
              ) {{ getRoleLabel(user.role) }}
            
            //- Контактная информация
            .flex.flex-col.gap-0-5.text-md
              .flex.items-center.gap-1
                svg.w-3.h-3.opacity-60(fill="none" stroke="currentColor" viewBox="0 0 24 24")
                  path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z")
                span.truncate {{ user.email }}
              .flex.items-center.gap-1(v-if="user.phone")
                svg.w-3.h-3.opacity-60(fill="none" stroke="currentColor" viewBox="0 0 24 24")
                  path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z")
                span {{ user.phone }}
              .flex.items-center.gap-1
                svg.w-3.h-3.opacity-60(fill="none" stroke="currentColor" viewBox="0 0 24 24")
                  path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z")
                span {{ formatDate(user.createdAt) }}
            
            //- Смена роли
            .flex.items-center.justify-between.gap-2.border-t.border-base-200
              .text-sm.opacity-60 Роль:
              select.select.select-sm.select-bordered(
                :value="user.role" 
                @change="updateUserRole(user.id, $event.target.value)"
                :disabled="user.id === currentUserId"
                class="w-36"
              )
                option(value="user") Пользователь
                option(value="manager") Менеджер
                option(value="admin") Администратор
            
            //- Пометка "это вы"
            .text-xs.text-info(v-if="user.id === currentUserId") (это вы)
            
            //- Действия
            .flex.justify-end.gap-1
              button.btn.btn-ghost.btn-sm(
                @click="editUser(user)"
                title="Редактировать"
              )
                svg.w-5.h-5(fill="none" stroke="currentColor" viewBox="0 0 24 24")
                  path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z")
                span.ml-1.text-sm Редактировать
              button.btn.btn-error.btn-sm(
                @click="deleteUser(user)"
                :disabled="user.id === currentUserId"
                title="Удалить"
              )
                svg.w-4.h-4(fill="none" stroke="currentColor" viewBox="0 0 24 24")
                  path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16")

      //- Пустое состояние
      .card.bg-base-100.shadow-xl(v-if="users.length === 0")
        .card-body.text-center.py-8
          .text-5xl.mb-2 👥
          h3.text-lg.font-semibold.mb-1 Пользователи не найдены
          p.text-sm.opacity-70.mb-3 Зарегистрируйте первого пользователя
          button.btn.btn-primary.btn-sm(@click="loadUsers") Обновить

      //- Статистика
      .card.bg-base-100.shadow-xl.mt-2(v-if="users.length > 0")
        .card-body.p-2(class="lg:p-3")
          h4.text-lg.font-semibold(class="lg:hidden") Статистика
          //- Мобильный: сетка 2x2
          .grid.grid-cols-2.gap-3.text-center(class="lg:hidden")
            .stat.bg-sky-950.rounded-lg.p-0
              .stat-title.text-xs Всего
              .stat-value.text-base {{ users.length }}
            .stat.bg-sky-950.rounded-lg.p-0
              .stat-title.text-xs Админов
              .stat-value.text-base {{ adminCount }}
            .stat.bg-sky-950.rounded-lg.p-0
              .stat-title.text-xs Менеджеров
              .stat-value.text-base {{ managerCount }}
            .stat.bg-sky-950.rounded-lg.p-0
              .stat-title.text-xs Пользователей
              .stat-value.text-base {{ userCount }}
          
          //- Десктоп: горизонтальная статистика
          .stats.shadow.w-full.hidden(class="lg:flex")
            .stat
              .stat-title Всего пользователей
              .stat-value {{ users.length }}
            .stat
              .stat-title Администраторов
              .stat-value {{ adminCount }}
            .stat
              .stat-title Менеджеров
              .stat-value {{ managerCount }}
            .stat
              .stat-title Пользователей
              .stat-value {{ userCount }}

  //- Мобильный футер
  MobileNavFooter(class="lg:hidden")
</template>

<script setup>
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'

definePageMeta({
  middleware: 'admin-auth'
})

const { $notify } = useNuxtApp()
const appState = useAppState()

const users = ref([])
const loading = ref(true)
const error = ref('')

const currentUserId = computed(() => appState.user?.value?.id || '')

const adminCount = computed(() => users.value.filter(u => u.role === 'admin').length)
const managerCount = computed(() => users.value.filter(u => u.role === 'manager').length)
const userCount = computed(() => users.value.filter(u => u.role === 'user').length)

const getRoleLabel = (role) => {
  const labels = {
    admin: 'Админ',
    manager: 'Менеджер',
    user: 'Пользователь'
  }
  return labels[role] || role
}

const loadUsers = async () => {
  try {
    loading.value = true
    error.value = ''
    const data = await $fetch('/api/admin/users')
    if (data?.success) {
      users.value = data.users
    } else {
      throw new Error(data?.error || 'Ошибка загрузки пользователей')
    }
  } catch (err) {
    error.value = err.message || 'Не удалось загрузить пользователей'
    $notify.error('Ошибка загрузки пользователей')
  } finally {
    loading.value = false
  }
}

const updateUserRole = async (userId, newRole) => {
  try {
    const currentUser = users.value.find(u => u.id === userId)
    if (currentUser.role === newRole) return
    
    const data = await $fetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: { role: newRole }
    })
    
    if (data?.success) {
      const userIndex = users.value.findIndex(u => u.id === userId)
      if (userIndex !== -1) {
        users.value[userIndex] = data.user
      }
      $notify.success(`Роль изменена на "${getRoleLabel(newRole)}"`)
    } else {
      throw new Error(data?.message || 'Ошибка обновления роли')
    }
  } catch (err) {
    $notify.error(err.message || 'Ошибка обновления роли')
    await loadUsers()
  }
}

const editUser = (user) => {
  $notify.info(`Редактирование ${user.name}`, 'В разработке')
}

const deleteUser = async (user) => {
  if (!confirm(`Удалить пользователя "${user.name}"?`)) return
  
  try {
    const data = await $fetch(`/api/admin/users/${user.id}`, {
      method: 'DELETE'
    })
    
    if (data?.success) {
      $notify.success(`Пользователь ${user.name} удален`)
      await loadUsers()
    } else {
      throw new Error(data?.message || 'Ошибка удаления')
    }
  } catch (err) {
    $notify.error(err.message || 'Ошибка удаления пользователя')
  }
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('ru-RU')
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.admin-users-page {
  min-height: 100dvh;
}

.gap-0-5 {
  gap: 0.125rem;
}

.mt-0-5 {
  margin-top: 0.125rem;
}

.mb-0-5 {
  margin-bottom: 0.125rem;
}

.mb-1 {
  margin-bottom: 0.25rem;
}

.mb-2 {
  margin-bottom: 0.375rem;
}

@media (max-width: 640px) {
  .card-body {
    padding: 0.2rem;
  }
  
  .stat {
    padding: 6px;
    border: 1px solid rgba(255, 255, 255, 0.4);
  }
  
  .stat-title {
    font-size: 0.9rem;
  }
  
  .stat-value {
    font-size: 1.5rem;
  }
}
</style>