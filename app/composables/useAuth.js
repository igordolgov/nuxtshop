// app/composables/useAuth.js
// app/composables/useAuth.js

// In-flight дедупликация checkAuth. Только клиент: на SSR промисы нельзя
// шарить между запросами — это утечка сессий между пользователями.
let clientCheckPromise = null

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

    // Несколько компонентов могут запросить проверку одновременно — делаем один fetch
    if (import.meta.client && clientCheckPromise) {
      return clientCheckPromise
    }

    const request = (async () => {
      try {
        const data = await $fetch('/api/auth/user', { credentials: 'include' })
        user.value = data.user ?? null
        return data
      } catch {
        user.value = null
        return { user: null, isAuthenticated: false }
      } finally {
        authChecked.value = true
        clientCheckPromise = null
      }
    })()

    if (import.meta.client) clientCheckPromise = request
    return request
  }

  const login = async (credentials) => {
    loading.value = true
    try {
      const data = await $fetch('/api/auth/login', {
        method: 'POST',
        body: credentials,
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
      authChecked.value = true
    } catch (error) {
      // Сервер не подтвердил выход — локально разлогиниваем,
      // но при следующей навигации сессия будет перепроверена
      authChecked.value = false
      updateAuthState(null)
      return { success: false, error: error?.message || 'Не удалось выйти' }
    }

    updateAuthState(null)

    // Ключи от старой auth-схемы — чистим на устройствах пользователей
    if (import.meta.client) {
      localStorage.removeItem('user')
      localStorage.removeItem('auth-token')
      sessionStorage.removeItem('user')
    }

    return { success: true }
  }

  const updateProfile = async (profileData) => {
    loading.value = true
    try {
      const data = await $fetch('/api/auth/profile', {
        method: 'PUT',
        body: profileData,
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