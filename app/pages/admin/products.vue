<!-- pages/admin/products.vue -->
<template lang="pug">
.admin-products-page
  AdminProducts    
</template>

<script setup>
//- admin-only daisyUI-компоненты (dropdown/file-input/table): см. app/assets/css/admin.css
import '~/assets/css/admin.css'
// Используем middleware для защиты админ-роута
definePageMeta({
  middleware: 'manager-auth'
})

import AdminProducts from '../../components/admin/AdminProducts.vue'

const { logout } = useAuth()
const { $notify } = useNuxtApp()
const router = useRouter()
const { t } = useI18n()
const localePath = useLocalePath()

// Выход из системы
const handleLogout = async () => {
  try {
    await logout()
    $notify.success(t('admin.dashboard.logoutSuccess'), t('admin.dashboard.admin'))
    await router.push(localePath('/'))
  } catch (error) {
    console.error('❌ Ошибка выхода:', error)
    $notify.error(t('admin.dashboard.logoutError'), t('admin.common.error'))
  }
}
</script>