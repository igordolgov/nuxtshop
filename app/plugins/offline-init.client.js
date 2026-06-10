// plugins/offline-init.client.js
/**
 * Плагин инициализации PWA и Service Worker
 */

export default defineNuxtPlugin(async (nuxtApp) => {
  // Проверка поддержки Service Worker
  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service Workers not supported')
    return
  }

  // Регистрация Service Worker
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    })
    
    console.log('[PWA] Service Worker registered:', registration.scope)

    // Проверка обновлений
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[PWA] New version available')
          
          if (nuxtApp.$notify) {
            nuxtApp.$notify.info('Доступно обновление. Обновите страницу.')
          }
        }
      })
    })

    // Background Sync
    if ('sync' in registration) {
      console.log('[PWA] Background Sync supported')
    }

    // Push Notifications
    if ('pushManager' in registration) {
      console.log('[PWA] Push Notifications supported')
    }

  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error)
  }

  // Обработка сообщений от Service Worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, data } = event.data || {}

    switch (type) {
      case 'SYNC_COMPLETE':
        console.log('[PWA] Sync complete:', data)
        if (nuxtApp.$notify) {
          nuxtApp.$notify.success('Данные синхронизированы!')
        }
        break

      case 'CACHE_UPDATED':
        console.log('[PWA] Cache updated:', data)
        break

      case 'OFFLINE_READY':
        console.log('[PWA] App is ready for offline use')
        break

      default:
        console.log('[PWA] SW message:', event.data)
    }
  })

  // Контроллер Service Worker изменился
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[PWA] Controller changed, reloading...')
  })

  // Предзагрузка критических данных
  const preloadCriticalData = async () => {
    try {
      const { useOfflineStorage } = await import('@/composables/useOfflineStorage')
      const storage = useOfflineStorage()
      
      const productsCount = await storage.getProductsCount()
      
      if (productsCount === 0) {
        console.log('[PWA] No cached products, will cache on first load')
      } else {
        console.log(`[PWA] ${productsCount} products cached`)
      }
    } catch (error) {
      console.error('[PWA] Preload failed:', error)
    }
  }

  preloadCriticalData()
})