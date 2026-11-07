<template lang="pug">
.admin-users-page.min-h-screen.bg-base-200.mobile-nav-safe
  //- Хедер
  .bg-base-100.shadow-sm.sticky.top-0.z-10
    .container.mx-auto.p-2(class="sm:p-3 lg:p-4")
      .flex.justify-between.items-center.gap-2
        .flex-1.min-w-0
          h1.card-title.text-xl(class="lg:text-2xl") {{ $t('admin.users.title') }}
        .flex.items-center.gap-2
          .badge.badge-primary.badge-sm(class="lg:badge-md") {{ $t('admin.users.adminBadge') }}
          NuxtLink.btn.btn-outline.btn-xs(class="lg:btn-sm" :to="localePath('/admin')") 
            span {{ $t('admin.users.back') }}

  .container.mx-auto.p-2(class="sm:p-3 lg:p-4")
    //- Сообщение о загрузке
    .text-center.py-6(v-if="loading")
      .loading.loading-spinner.loading-lg
      p.mt-2.text-sm {{ $t('admin.users.loading') }}

    //- Сообщение об ошибке
    template(v-else-if="error")
      .alert.alert-error.mb-2
        svg.w-4.h-4(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z")
        span.text-sm {{ error }}
        button.btn.btn-xs.btn-ghost.ml-auto(@click="loadUsers") {{ $t('admin.common.retry') }}

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
                  th {{ $t('admin.users.colName') }}
                  th Email
                  th {{ $t('admin.users.colRole') }}
                  th {{ $t('admin.users.colPhone') }}
                  th {{ $t('admin.users.colRegistered') }}
                  th {{ $t('admin.users.colActions') }}
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
                      option.rlg(value="user") {{ $t('admin.users.roleUser') }}
                      option(value="manager") {{ $t('admin.users.roleManager') }}
                      option(value="admin") {{ $t('admin.users.roleAdmin') }}
                    .text-xs.opacity-60.mt-0-5(v-if="user.id === currentUserId") {{ $t('admin.users.thisIsYou') }}
                  td {{ user.phone || '—' }}
                  td.text-xs {{ formatDate(user.createdAt) }}
                  td
                    .flex.gap-1
                      button.btn.btn-ghost.btn-xs(
                        @click="editUser(user)"
                        :title="$t('admin.users.editProfileTitle')"
                      )
                        svg.w-4.h-4(fill="none" stroke="currentColor" viewBox="0 0 24 24")
                          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z")
                      button.btn.btn-error.btn-xs(
                        @click="deleteUser(user)"
                        :disabled="user.id === currentUserId"
                        :title="$t('admin.users.deleteUserTitle')"
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
              .text-sm.opacity-60 {{ $t('admin.users.roleLabel') }}
              select.select.select-sm.select-bordered(
                :value="user.role" 
                @change="updateUserRole(user.id, $event.target.value)"
                :disabled="user.id === currentUserId"
                class="w-36"
              )
                option(value="user") {{ $t('admin.users.roleUser') }}
                option(value="manager") {{ $t('admin.users.roleManager') }}
                option(value="admin") {{ $t('admin.users.roleAdmin') }}
            
            //- Пометка "это вы"
            .text-xs.text-info(v-if="user.id === currentUserId") {{ $t('admin.users.thisIsYou') }}
            
            //- Действия
            .flex.justify-end.gap-1
              button.btn.btn-ghost.btn-sm(
                @click="editUser(user)"
                :title="$t('admin.users.editProfileTitle')"
              )
                svg.w-5.h-5(fill="none" stroke="currentColor" viewBox="0 0 24 24")
                  path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z")
                span.ml-1.text-sm {{ $t('admin.users.editBtn') }}
              button.btn.btn-error.btn-sm(
                @click="deleteUser(user)"
                :disabled="user.id === currentUserId"
                :title="$t('admin.common.delete')"
              )
                svg.w-4.h-4(fill="none" stroke="currentColor" viewBox="0 0 24 24")
                  path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16")

      //- Пустое состояние
      .card.bg-base-100.shadow-xl(v-if="users.length === 0")
        .card-body.text-center.py-8
          .text-5xl.mb-2 👥
          h3.text-lg.font-semibold.mb-1 {{ $t('admin.users.emptyTitle') }}
          p.text-sm.opacity-70.mb-3 {{ $t('admin.users.emptyHint') }}
          button.btn.btn-primary.btn-sm(@click="loadUsers") {{ $t('admin.common.refresh') }}

      //- Статистика
      .card.bg-base-100.shadow-xl.mt-2(v-if="users.length > 0")
        .card-body.p-2(class="lg:p-3")
          h4.text-lg.font-semibold(class="lg:hidden") {{ $t('admin.users.statsTitle') }}
          //- Мобильный: сетка 2x2
          .grid.grid-cols-2.gap-3.text-center(class="lg:hidden")
            .stat.bg-sky-950.rounded-lg.p-0
              .stat-title.text-xs {{ $t('admin.users.statTotal') }}
              .stat-value.text-base {{ users.length }}
            .stat.bg-sky-950.rounded-lg.p-0
              .stat-title.text-xs {{ $t('admin.users.statAdmins') }}
              .stat-value.text-base {{ adminCount }}
            .stat.bg-sky-950.rounded-lg.p-0
              .stat-title.text-xs {{ $t('admin.users.statManagers') }}
              .stat-value.text-base {{ managerCount }}
            .stat.bg-sky-950.rounded-lg.p-0
              .stat-title.text-xs {{ $t('admin.users.statUsers') }}
              .stat-value.text-base {{ userCount }}
          
          //- Десктоп: горизонтальная статистика
          .stats.shadow.w-full.hidden(class="lg:flex")
            .stat
              .stat-title {{ $t('admin.users.statTotalD') }}
              .stat-value {{ users.length }}
            .stat
              .stat-title {{ $t('admin.users.statAdminsD') }}
              .stat-value {{ adminCount }}
            .stat
              .stat-title {{ $t('admin.users.statManagersD') }}
              .stat-value {{ managerCount }}
            .stat
              .stat-title {{ $t('admin.users.statUsersD') }}
              .stat-value {{ userCount }}

  //- Модалка редактирования профиля (name/email/phone/address)
  AdminEditUserModal(
    v-model:isOpen="isEditOpen"
    :user="editingUser"
    @userSaved="onUserSaved"
  )

  //- Мобильная навигация: только < 768px (как на витрине;
  //- pb-14 на корне был неудачной компенсацией — 56px < 60px навигации)
  MobileNavFooter
</template>

<script setup>
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'
import AdminEditUserModal from '~/components/admin/AdminEditUserModal.vue'

const { isMobile } = useMobileDetection()

definePageMeta({
  middleware: 'admin-auth'
})

const { $notify } = useNuxtApp()
const appState = useAppState()
const { t, locale } = useI18n()
// Локализация серверных ошибок по кодам (server.* в словарях)
const { serverMessage } = useServerMessage()
const localePath = useLocalePath()

useHead({ title: () => t('admin.users.pageTitle') })

const users = ref([])
const loading = ref(true)
const error = ref('')

const currentUserId = computed(() => appState.user?.value?.id || '')

const adminCount = computed(() => users.value.filter(u => u.role === 'admin').length)
const managerCount = computed(() => users.value.filter(u => u.role === 'manager').length)
const userCount = computed(() => users.value.filter(u => u.role === 'user').length)

const getRoleLabel = (role) => {
  const labels = {
    admin: t('admin.users.roleAdminShort'),
    manager: t('admin.users.roleManager'),
    user: t('admin.users.roleUser'),
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
      throw new Error(data?.error || t('admin.users.loadError'))
    }
  } catch (err) {
    error.value = err.message || t('admin.users.loadErrorText')
    $notify.error(t('admin.users.loadError'))
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
      $notify.success(t('admin.users.roleChanged', { role: getRoleLabel(newRole) }))
    } else {
      throw new Error(t('admin.users.roleUpdateError'))
    }
  } catch (err) {
    // Код сервера (managerRequired/authRequired/…) → server.*
    $notify.error(serverMessage(err, 'admin.users.roleUpdateError'))
    await loadUsers()
  }
}

// Редактирование профиля — модалка (name/email/phone/address);
// роль меняется селектом в таблице, удаление — отдельной кнопкой
const isEditOpen = ref(false)
const editingUser = ref(null)

const editUser = (user) => {
  editingUser.value = user
  isEditOpen.value = true
}

// Подменяем строку без перезагрузки списка (запись приходит без пароля)
const onUserSaved = (updatedUser) => {
  const userIndex = users.value.findIndex((u) => u.id === updatedUser.id)
  if (userIndex !== -1) {
    users.value[userIndex] = updatedUser
  }
}

const deleteUser = async (user) => {
  if (!confirm(t('admin.users.deleteConfirm', { name: user.name }))) return
  
  try {
    const data = await $fetch(`/api/admin/users/${user.id}`, {
      method: 'DELETE'
    })
    
    if (data?.success) {
      $notify.success(t('admin.users.deleted', { name: user.name }))
      await loadUsers()
    } else {
      throw new Error(t('admin.users.deleteError'))
    }
  } catch (err) {
    $notify.error(serverMessage(err, 'admin.users.deleteErrorToast'))
  }
}

const formatDate = (dateString) => {
  const loc = locale.value === 'en' ? 'en-US' : locale.value === 'es' ? 'es-ES' : 'ru-RU'
  return new Date(dateString).toLocaleDateString(loc)
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