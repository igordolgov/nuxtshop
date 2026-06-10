// composables/useAuth.js
import { ref, computed } from 'vue'

let authInstance = null

export const useAuth = () => {
  if (authInstance) {
    return authInstance
  }

  const user = ref(null)
  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isManager = computed(() => user.value?.role === 'manager' || isAdmin.value)
  const loading = ref(false)
  const authChecked = ref(false)

  // Helper для безопасного обновления состояния
  const updateAuthState = (newUser) => {
    user.value = newUser
    // isAuthenticated обновится автоматически через computed
  }

  // Проверка аутентификации при загрузке
  const checkAuth = async () => {
    try {
      console.log('🔍 Проверка аутентификации...')
      console.log('📱 Платформа:', process.client ? 'клиент' : 'сервер')
      
      const data = await $fetch('/api/auth/user', {
        headers: {
          'Cache-Control': 'no-cache'
        },
        credentials: 'include'
      })
      
      updateAuthState(data.user)
      authChecked.value = true
      
      console.log('✅ Результат проверки аутентификации:', { 
        isAuthenticated: !!data.user,
        user: data.user ? { 
          email: data.user.email, 
          role: data.user.role,
          name: data.user.name 
        } : null
      })
      
      return data
    } catch (error) {
      console.log('❌ Пользователь не аутентифицирован:', error.message)
      updateAuthState(null)
      authChecked.value = true
      return { user: null, isAuthenticated: false }
    }
  }

  // Вход - УЛУЧШЕННАЯ ВЕРСИЯ
  const login = async (credentials) => {
    loading.value = true
    try {
      console.log('🔐 Попытка входа:', credentials.email)
      
      const data = await $fetch('/api/auth/login', {
        method: 'POST',
        body: credentials,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      if (data.success) {
        updateAuthState(data.user)
        console.log('✅ Вход успешен:', { 
          email: data.user.email, 
          role: data.user.role,
          name: data.user.name
        })
        return data
      } else {
        throw new Error(data.error || 'Ошибка входа')
      }
    } catch (error) {
      console.error('❌ Ошибка входа:', error)
      
      let errorMessage = 'Ошибка при входе в систему'
      
      if (error.data?.statusMessage) {
        errorMessage = error.data.statusMessage
      } else if (error.status === 401) {
        errorMessage = 'Неверный email или пароль'
      } else if (error.status === 500) {
        errorMessage = 'Ошибка сервера. Попробуйте позже.'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  // Регистрация
  const register = async (userData) => {
    loading.value = true
    try {
      console.log('👤 Попытка регистрации:', userData.email)
      
      const data = await $fetch('/api/auth/register', {
        method: 'POST',
        body: userData,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      if (data.success) {
        updateAuthState(data.user)
        console.log('✅ Регистрация успешна:', { 
          email: data.user.email, 
          role: data.user.role,
          name: data.user.name
        })
        return data
      } else {
        throw new Error(data.error || 'Ошибка регистрации')
      }
    } catch (error) {
      console.error('❌ Ошибка регистрации:', error)
      
      let errorMessage = 'Ошибка при регистрации'
      if (error.data?.statusMessage) {
        errorMessage = error.data.statusMessage
      } else if (error.message) {
        errorMessage = error.message
      }
      
      throw new Error(errorMessage)
    } finally {
      loading.value = false
    }
  }

  // Выход - ИСПРАВЛЕННАЯ ВЕРСИЯ
  const logout = async () => {
    try {
      console.log('🚪 Начало выхода из системы...')
      
      // Отправляем запрос на сервер для выхода
      const data = await $fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })

      // Очищаем локальное состояние
      updateAuthState(null)

      // Очищаем localStorage/sessionStorage
      if (process.client) {
        localStorage.removeItem('user')
        sessionStorage.removeItem('user')
        localStorage.removeItem('auth-token')
        
        // Очищаем все куки на клиенте
        document.cookie.split(";").forEach(cookie => {
          const eqPos = cookie.indexOf("=")
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/"
        })
      }

      console.log('✅ Выход выполнен успешно')
      
      return { success: true }
    } catch (error) {
      console.error('❌ Ошибка выхода:', error)
      // Даже при ошибке очищаем локальное состояние
      updateAuthState(null)
      return { success: false, error: error.message }
    }
  }

  // Обновление профиля
  const updateProfile = async (profileData) => {
    loading.value = true
    try {
      console.log('📝 Обновление профиля:', profileData.email)
      const data = await $fetch('/api/auth/profile', {
        method: 'PUT',
        body: profileData,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      if (data.success) {
        updateAuthState(data.user)
        console.log('✅ Профиль обновлен')
        return data
      } else {
        throw new Error(data.error || 'Ошибка обновления профиля')
      }
    } catch (error) {
      console.error('❌ Ошибка обновления профиля:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // Принудительный сброс состояния
  const resetAuth = () => {
    updateAuthState(null)
    authChecked.value = false
    console.log('🔄 Состояние аутентификации сброшено')
  }

  // Инициализация при создании - ТОЛЬКО на клиенте
  if (process.client) {
    // Запускаем проверку аутентификации
    setTimeout(() => {
      checkAuth()
    }, 500)
  }

  authInstance = {
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
    // Добавляем helper функцию
    updateAuthState
  }

  return authInstance
}