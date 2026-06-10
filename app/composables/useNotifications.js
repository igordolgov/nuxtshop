// useNotifications.js
import { ref, computed } from 'vue'

export const useNotifications = () => {
  const notifications = ref([])

  const addNotification = (message, type = 'info') => {
    const id = Date.now() + Math.random()
    const notification = {
      id,
      message,
      type,
      timestamp: new Date()
    }
    
    notifications.value.push(notification)
    
    if (process.client) {
      setTimeout(() => {
        removeNotification(id)
      }, 5000)
    }
    
    return notification
  }

  const removeNotification = (id) => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index !== -1) {
      notifications.value.splice(index, 1)
    }
  }

  const clearAllNotifications = () => {
    notifications.value = []
  }

  return {
    notifications: computed(() => notifications.value),
    addNotification,
    removeNotification,
    clearAllNotifications
  }
}