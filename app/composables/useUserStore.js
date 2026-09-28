// composables/useUserStore.js
import { reactive, computed, toRefs } from 'vue'

export const useUserStore = () => {
  const state = reactive({
    isAuthenticated: false,
    user: null,
    isLoading: true
  })
  
  // Геттеры
  const userInitials = computed(() => {
    if (!state.user?.name) return 'U'
    return state.user.name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  })
  
  const isAdmin = computed(() => {
    return state.user?.role === 'admin'
  })
  
  // Методы
  const initialize = () => {
    if (process.client) {
      const token = localStorage.getItem('token')
      const userData = localStorage.getItem('user')
      
      if (token && userData) {
        try {
          state.user = JSON.parse(userData)
          state.isAuthenticated = true
        } catch (e) {
          console.error('Ошибка загрузки пользователя:', e)
          clearAuth()
        }
      }
      state.isLoading = false
    }
  }
  
  const setAuth = (user, token) => {
    state.user = user
    state.isAuthenticated = true
    if (process.client) {
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('token', token)
    }
  }
  
  const clearAuth = () => {
    state.user = null
    state.isAuthenticated = false
    if (process.client) {
      localStorage.removeItem('user')
      localStorage.removeItem('token')
    }
  }
  
  // Инициализация при создании
  if (process.client) {
    initialize()
  }
  
  return {
    ...toRefs(state),
    userInitials,
    isAdmin,
    setAuth,
    clearAuth,
    initialize
  }
}