export default defineNuxtPlugin((nuxtApp) => {
  // Переопределяем обработку ошибок
  // Возврат значения хуком игнорируется — глушим тип «плавающего» промиса.
  nuxtApp.hook('app:error', (error) => {
    console.error('Global error caught:', error)

    // Если это 404, редиректим на главную
    if (error.statusCode === 404) {
      navigateTo('/')
    }
  })
})
