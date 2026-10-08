export default defineNuxtPlugin((nuxtApp) => {
  // Переопределяем обработку ошибок
  nuxtApp.hook('app:error', (error) => {
    console.error('Global error caught:', error)
    
    // Если это 404, редиректим на главную
    if (error.statusCode === 404) {
      return navigateTo('/')
    }
  })
})
