<!-- app/components/layout/HeaderUserMenu.vue — меню профиля в шапке
     (разбивка Header.vue, этап 6). Открытие/закрытие, клик-аутсайд, Escape,
     выход и стили dropdown живут здесь; шапка решает только, показывать ли
     меню (v-if="isAuthenticated" на компоненте; рядом v-else — кнопка входа). -->
<template lang="pug">
//- Меню пользователя
.relative(ref="userMenuRef")
  button.flex.items-center.gap-2.cursor-pointer.rounded-xl.transition-colors(
    type="button"
    :aria-expanded="isUserMenuOpen"
    aria-haspopup="menu"
    :aria-label="$t('header.userMenu')"
    class="hover:bg-base-200 px-2 h-11"
    @click="toggleUserMenu"
  )
    .avatar
      .rounded-full.bg-primary.flex.items-center.justify-center.text-primary-content.font-semibold.size-7.text-xs
        span {{ userInitials }}
    span.font-semibold.text-sm(class="hidden sm:block") {{ userName }}
    svg.w-4.h-4.transition-transform(
      xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" class="text-base-content/75"
      :class="isUserMenuOpen ? 'rotate-180' : ''"
    )
      path(stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M19 9l-7 7-7-7")

  .absolute.top-full.right-0.mt-2.z-50(
    v-show="isUserMenuOpen"
    class="bg-base-100 shadow-lg border border-base-300 rounded-2xl min-w-56"
  )
    .flex.flex-col.p-2
      .px-3.py-2.border-b.border-base-300.mb-1
        .text-xs.text-base-content.opacity-75.truncate {{ userEmail }}
        .badge.badge-sm.mt-1.rounded-full(
          :class="userRole === 'admin' ? 'badge-primary' : userRole === 'manager' ? 'badge-secondary' : 'badge-accent'"
        )
          | {{ userRole === 'admin' ? $t('header.roleAdmin') : userRole === 'manager' ? $t('header.roleManager') : $t('header.roleUser') }}

      button.flex.items-center.gap-3.px-3.py-3.rounded-xl.w-full.text-left.cursor-pointer.font-medium.text-sm.transition-colors(
        type="button"
        @click="navigateToPath('/user')"
        :class="isExactActiveRoute('/user') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
      )
        span {{ $t('header.account') }}

      button.flex.items-center.gap-3.px-3.py-3.rounded-xl.w-full.text-left.cursor-pointer.font-medium.text-sm.transition-colors(
        type="button"
        @click="navigateToPath('/user/orders')"
        :class="isExactActiveRoute('/user/orders') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
      )
        span {{ $t('header.myOrders') }}

      button.flex.items-center.gap-3.px-3.py-3.rounded-xl.w-full.text-left.cursor-pointer.font-medium.text-sm.transition-colors(
        v-if="isAdmin"
        type="button"
        @click="navigateToPath('/admin/users')"
        :class="isExactActiveRoute('/admin/users') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
      )
        span {{ $t('header.manageUsers') }}

      button.flex.items-center.gap-3.px-3.py-3.rounded-xl.w-full.text-left.cursor-pointer.font-medium.text-sm.transition-colors(
        type="button"
        @click="navigateToPath('/settings')"
        :class="isExactActiveRoute('/settings') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
      )
        span {{ $t('header.settings') }}

      .divider.my-1

      button.flex.items-center.gap-3.px-3.py-3.rounded-xl.w-full.text-left.cursor-pointer.font-medium.text-sm.text-error.transition-colors(
        type="button"
        class="hover:bg-error/10"
        @click="handleLogout"
      )
        span {{ $t('header.logout') }}

</template>

<script setup>
// isAdmin — показывать ли пункт «Пользователи» (v-if в списке меню);
// данные пользователя composables берут из общего стейта (useAppState).
defineProps({
  isAdmin: { type: Boolean, default: false },
})

const route = useRoute()
const { $notify } = useNuxtApp()
const { t } = useI18n()
const appState = useAppState()
const { isExactActiveRoute } = useActiveRoute()
const localePath = useLocalePath()

const isUserMenuOpen = ref(false)
const userMenuRef = ref(null)

const user = computed(() => appState.user?.value)
const userInitials = computed(() => {
  if (!user.value?.name) return 'U'
  return user.value.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})
const userName = computed(() => user.value?.name || t('header.defaultUserName'))
const userEmail = computed(() => user.value?.email || '')
const userRole = computed(() => user.value?.role || 'user')

const closeUserMenu = () => { isUserMenuOpen.value = false }
const toggleUserMenu = () => { isUserMenuOpen.value = !isUserMenuOpen.value }

const navigateToPath = async (path) => {
  closeUserMenu()
  await navigateTo(path)
}

const handleLogout = async () => {
  closeUserMenu()
  const result = await appState.logout()
  if (result.success) {
    $notify.success(t('header.logoutSuccess'))
    await navigateTo('/')
  }
}

//- Клик мимо меню закрывает его (прежнее поведение closeMenusOnClickOutside
//- из шапки, только для этого dropdown)
const closeMenusOnClickOutside = (event) => {
  if (!import.meta.client) return
  const target = event.target
  if (isUserMenuOpen.value && !userMenuRef.value?.contains(target)) closeUserMenu()
}

const onGlobalKeydown = (event) => {
  if (event.key === 'Escape') closeUserMenu()
}

onMounted(() => {
  if (!import.meta.client) return
  document.addEventListener('click', closeMenusOnClickOutside)
  document.addEventListener('keydown', onGlobalKeydown)
})

onUnmounted(() => {
  if (!import.meta.client) return
  document.removeEventListener('click', closeMenusOnClickOutside)
  document.removeEventListener('keydown', onGlobalKeydown)
})

watch(() => route.path, () => closeUserMenu())
</script>
