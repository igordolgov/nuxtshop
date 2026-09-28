// app/composables/useNotifications.js
import { ref, computed } from 'vue'

let notificationsInstance = null

export const useNotifications = () => {
  if (import.meta.server) return createNotifications()

  if (notificationsInstance) return notificationsInstance
  notificationsInstance = createNotifications()
  return notificationsInstance
}

function createNotifications() {
  const notifications = ref([])

  const removeNotification = (id) => {
    const index = notifications.value.findIndex((n) => n.id === id)
    if (index !== -1) notifications.value.splice(index, 1)
  }

  const addNotification = (message, type = 'info') => {
    const id = Date.now() + Math.random()
    const notification = { id, message, type, timestamp: new Date() }
    notifications.value.push(notification)

    if (import.meta.client) {
      setTimeout(() => removeNotification(id), 5000)
    }
    return notification
  }

  const clearAllNotifications = () => {
    notifications.value = []
  }

  return {
    notifications: computed(() => notifications.value),
    addNotification,
    removeNotification,
    clearAllNotifications,
  }
}