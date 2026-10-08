// middleware/auth-init.global.js
export default defineNuxtRouteMiddleware(async () => {
  // Только на клиенте
  if (process.client) {
    const appState = useAppState()
    
    // Инициализируем приложение только один раз
    if (!appState._initialized) {
      console.log('🔄 Инициализация приложения...')
      
      try {
        await appState.initializeApp()
        appState._initialized = true
        console.log('✅ Приложение инициализировано')
      } catch (error) {
        console.error('❌ Ошибка инициализации приложения:', error)
      }
    }
  }
})