<!-- pages/admin/products.vue -->
<template lang="pug">
.admin-products-page
  AdminProducts    
</template>

<script setup>
// Используем middleware для защиты админ-роута
definePageMeta({
  middleware: 'admin-auth'
})

import AdminProducts from '../../components/admin/AdminProducts.vue'

const { logout } = useAuth()
const { $notify } = useNuxtApp()
const router = useRouter()

// Выход из системы
const handleLogout = async () => {
  try {
    await logout()
    $notify.success('Вы успешно вышли из системы', 'До свидания!')
    await router.push('/')
  } catch (error) {
    console.error('❌ Ошибка выхода:', error)
    $notify.error('Ошибка при выходе из системы', 'Ошибка')
  }
}
</script>