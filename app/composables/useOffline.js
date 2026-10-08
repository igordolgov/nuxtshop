// app/composables/useOffline.js
/**
 * Composable для отслеживания состояния сети.
 *
 * Singleton: все вызовы `useOffline()` в приложении делят один и тот же стейт.
 * Реализовано через `useState` — SSR-safe, шарится между компонентами,
 * автоматически подчищается при размонтировании Nuxt-приложения.
 */

import { computed, onMounted, onUnmounted } from 'vue'

export const useOffline = () => {
  const isOnline = useState('offline:isOnline', () => true)
  const wasOffline = useState('offline:wasOffline', () => false)
  const showRestoredMessage = useState('offline:showRestored', () => false)
  const pendingSyncCount = useState('offline:pendingSync', () => 0)
  const listenerAttached = useState('offline:listenerAttached', () => false)

  // ─── Методы ───────────────────────────────────────────────

  const updateOnlineStatus = async () => {
    const wasOfflineBefore = !isOnline.value
    isOnline.value = navigator.onLine

    if (wasOfflineBefore && isOnline.value) {
      wasOffline.value = true
      showRestoredMessage.value = true
      await syncPendingData()

      setTimeout(() => {
        showRestoredMessage.value = false
      }, 3000)
    }

    if (!isOnline.value) {
      wasOffline.value = true
    }
  }

  const syncPendingData = async () => {
    if (!('serviceWorker' in navigator)) return
    if (!('SyncManager' in window)) return

    try {
      const registration = await navigator.serviceWorker.ready
      await registration.sync.register('sync-cart')
      await registration.sync.register('sync-favorites')
      pendingSyncCount.value = 0
    } catch (error) {
      console.error('[useOffline] Sync failed:', error)
    }
  }

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

  const forceSync = async () => {
    if (!isOnline.value) {
      console.log('[useOffline] Cannot sync while offline')
      return false
    }
    await syncPendingData()
    return true
  }

  // ─── Lifecycle (только один раз на приложение) ────────────

  onMounted(() => {
    if (listenerAttached.value) return
    listenerAttached.value = true

    isOnline.value = navigator.onLine

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    checkPendingSync()
  })

  onUnmounted(() => {
    // НЕ снимаем слушатели: useState живёт дольше компонента,
    // а updateOnlineStatus — стабильная функция из замыкания.
    // Слушатели снимаются при полной разгрузке приложения.
  })

  // ─── API ──────────────────────────────────────────────────

  return {
    isOnline: computed(() => isOnline.value),
    isOffline: computed(() => !isOnline.value),
    wasOffline: computed(() => wasOffline.value),
    showRestoredMessage: computed(() => showRestoredMessage.value),
    pendingSyncCount: computed(() => pendingSyncCount.value),

    syncPendingData,
    forceSync,
    checkPendingSync,
  }
}