// plugins/init-data.client.js (ТОЛЬКО для клиента)
export default defineNuxtPlugin(async (nuxtApp) => {
  // Этот плагин будет работать только на клиенте
  console.log('🔄 Инициализация данных приложения...')
  
  // Товары будут загружены при первом обращении через getProducts()
  // Избранное будет загружено при первом обращении через useFavorites()
  
  console.log('✅ Инициализация данных завершена')
})