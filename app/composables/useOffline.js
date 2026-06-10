// composables/useOffline.js
/**
 * Composable для отслеживания состояния сети
 * - Определяет онлайн/оффлайн статус
 * - Уведомляет о восстановлении связи
 * - Управляет синхронизацией данных
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'

export const useOffline = () => {
  // ==========================================
  // State
  // ==========================================
  
  const isOnline = ref(true)
  const wasOffline = ref(false)
  const showRestoredMessage = ref(false)
  const pendingSyncCount = ref(0)

  // ==========================================
  // Методы
  // ==========================================

  /**
   * Обновление статуса сети
   */
  const updateOnlineStatus = async () => {
    const wasOfflineBefore = !isOnline.value
    isOnline.value = navigator.onLine

    if (wasOfflineBefore && isOnline.value) {
      // Связь восстановлена
      wasOffline.value = true
      showRestoredMessage.value = true
      
      // Запускаем синхронизацию
      await syncPendingData()
      
      // Скрываем сообщение через 3 секунды
      setTimeout(() => {
        showRestoredMessage.value = false
      }, 3000)
    }

    if (!isOnline.value) {
      // Связь потеряна
      wasOffline.value = true
    }
  }

  /**
   * Синхронизация отложенных данных
   */
  const syncPendingData = async () => {
    if (!('serviceWorker' in navigator)) return

    try {
      const registration = await navigator.serviceWorker.ready
      
      // Запускаем синхронизацию разных типов данных
      if ('sync' in registration) {
        await registration.sync.register('sync-cart')
        await registration.sync.register('sync-favorites')
        pendingSyncCount.value = 0
      }
    } catch (error) {
      console.error('[useOffline] Sync failed:', error)
    }
  }

  /**
   * Проверка количества отложенных изменений
   */
  const checkPendingSync = async () => {
    try {
      const { useOfflineStorage } = await import('./useOfflineStorage')
      const storage = useOfflineStorage()
      const queue = await storage.getSyncQueue()
      pendingSyncCount.value = queue.length
    } catch (error) {
      console.error('[useOffline] Check pending failed:', error)
    }
  }

  /**
   * Принудительная синхронизация
   */
  const forceSync = async () => {
    if (!isOnline.value) {
      console.log('[useOffline] Cannot sync while offline')
      return false
    }

    await syncPendingData()
    return true
  }

  // ==========================================
  // Lifecycle
  // ==========================================

  onMounted(() => {
    if (!process.client) return

    isOnline.value = navigator.onLine
    
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    
    // Проверяем отложенные изменения
    checkPendingSync()
  })

  onUnmounted(() => {
    if (!process.client) return

    window.removeEventListener('online', updateOnlineStatus)
    window.removeEventListener('offline', updateOnlineStatus)
  })

  // ==========================================
  // API
  // ==========================================

  return {
    // State
    isOnline: computed(() => isOnline.value),
    isOffline: computed(() => !isOnline.value),
    wasOffline: computed(() => wasOffline.value),
    showRestoredMessage: computed(() => showRestoredMessage.value),
    pendingSyncCount: computed(() => pendingSyncCount.value),

    // Methods
    syncPendingData,
    forceSync,
    checkPendingSync
  }
}