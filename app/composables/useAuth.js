// app/composables/useAuth.js
import { ref, computed } from 'vue'

let authInstance = null

export const useAuth = () => {
  // SSR: свежий инстанс на каждый запрос — никакого шаринга между пользователями
  if (import.meta.server) return createAuth()

  if (authInstance) return authInstance
  authInstance = createAuth()
  return authInstance
}

function createAuth() {
  const user = ref(null)
  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isManager = computed(() => user.value?.role === 'manager' || isAdmin.value)
  const loading = ref(false)
  const authChecked = ref(false)

  const updateAuthState = (newUser) => {
    user.value = newUser
  }

  const checkAuth = async () => {
    if (authChecked.value) {
      return { user: user.value, isAuthenticated: !!user.value }
    }

    try {
      const data = await $fetch('/api/auth/user', {
        headers: { 'Cache-Control': 'no-cache' },
        credentials: 'include',
      })
      updateAuthState(data.user)
      authChecked.value = true
      return data
    } catch {
      updateAuthState(null)
      authChecked.value = true
      return { user: null, isAuthenticated: false }
    }
  }

  const login = async (credentials) => {
    loading.value = true
    try {
      const data = await $fetch('/api/auth/login', {
        method: 'POST',
        body: credentials,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })

      if (!data.success) throw new Error(data.error || 'Ошибка входа')
      updateAuthState(data.user)
      return data
    } catch (error) {
      let msg = 'Ошибка при входе в систему'
      if (error.data?.statusMessage) msg = error.data.statusMessage
      else if (error.status === 401) msg = 'Неверный email или пароль'
      else if (error.status === 500) msg = 'Ошибка сервера. Попробуйте позже.'
      else if (error.message) msg = error.message
      throw new Error(msg)
    } finally {
      loading.value = false
    }
  }

  const register = async (userData) => {
    loading.value = true
    try {
      const data = await $fetch('/api/auth/register', {
        method: 'POST',
        body: userData,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })

      if (!data.success) throw new Error(data.error || 'Ошибка регистрации')
      updateAuthState(data.user)
      return data
    } catch (error) {
      let msg = 'Ошибка при регистрации'
      if (error.data?.statusMessage) msg = error.data.statusMessage
      else if (error.message) msg = error.message
      throw new Error(msg)
    } finally {
      loading.value = false
    }
  }

  const logout = async () => {
    try {
      await $fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      updateAuthState(null)

      if (import.meta.client) {
        localStorage.removeItem('user')
        sessionStorage.removeItem('user')
        localStorage.removeItem('auth-token')

        document.cookie.split(';').forEach((cookie) => {
          const eqPos = cookie.indexOf('=')
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
          document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'
        })
      }
      return { success: true }
    } catch (error) {
      updateAuthState(null)
      return { success: false, error: error?.message || 'Неизвестная ошибка' }
    }
  }

  const updateProfile = async (profileData) => {
    loading.value = true
    try {
      const data = await $fetch('/api/auth/profile', {
        method: 'PUT',
        body: profileData,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })

      if (!data.success) throw new Error(data.error || 'Ошибка обновления профиля')
      updateAuthState(data.user)
      return data
    } finally {
      loading.value = false
    }
  }

  const resetAuth = () => {
    updateAuthState(null)
    authChecked.value = false
  }

  return {
    user,
    isAuthenticated,
    isAdmin,
    isManager,
    loading,
    authChecked,
    checkAuth,
    login,
    register,
    logout,
    updateProfile,
    resetAuth,
    updateAuthState,
  }
}