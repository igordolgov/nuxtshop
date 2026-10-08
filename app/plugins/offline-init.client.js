// app/plugins/offline-init.client.js
/**
 * PWA: регистрация Service Worker и обработка сообщений от него.
 *
 * В dev-режиме SW не регистрируется — @vite-pwa/nuxt не генерирует sw.js.
 * Регистрация отложена до app:mounted, чтобы не блокировать гидратацию.
 */
export default defineNuxtPlugin((nuxtApp) => {
  // В dev — ничего не делаем: sw.js не существует,
  // а HMR и так работает через Vite websocket
  if (import.meta.dev) return

  // SW не поддерживается — молча выходим
  if (!('serviceWorker' in navigator)) return

  // Откладываем всю работу до момента, когда приложение смонтировано.
  // Плагин синхронный, поэтому гидратация не блокируется.
  nuxtApp.hook('app:mounted', () => {
    registerServiceWorker(nuxtApp)
  })
})

function registerServiceWorker(nuxtApp) {
  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((registration) => {
      console.log('[PWA] Service Worker registered:', registration.scope)

      // Обновление SW
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          const isUpdate =
            newWorker.state === 'installed' && navigator.serviceWorker.controller
          if (isUpdate) {
            console.log('[PWA] New version available')
            nuxtApp.$notify?.info?.('Доступно обновление. Обновите страницу.')
          }
        })
      })

      // Возможности API
      if ('SyncManager' in window) {
        console.log('[PWA] Background Sync supported')
      }
      if ('PushManager' in window) {
        console.log('[PWA] Push Notifications supported')
      }
    })
    .catch((error) => {
      console.error('[PWA] Service Worker registration failed:', error)
    })

  // Сообщения от SW
  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, data } = event.data || {}

    switch (type) {
      case 'SYNC_COMPLETE':
        console.log('[PWA] Sync complete:', data)
        nuxtApp.$notify?.success?.('Данные синхронизированы!')
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

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[PWA] Controller changed, reloading...')
  })

  // Предзагрузка критических данных
  preloadCriticalData()
}

async function preloadCriticalData() {
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