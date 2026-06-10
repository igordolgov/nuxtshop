// plugins/favorites-fix.client.js
export default defineNuxtPlugin((nuxtApp) => {
  // Временно добавляем функцию isFavorite через плагин
  const isFavorite = (productId) => {
    console.warn('⚠️ Используется временная функция isFavorite через плагин')
    
    // Проверяем наличие ID в localStorage (старый формат)
    if (process.client) {
      try {
        const favoriteProducts = localStorage.getItem('favoriteProducts')
        if (favoriteProducts) {
          const ids = JSON.parse(favoriteProducts)
          return ids.includes(productId.toString())
        }
        
        // Проверяем новый формат
        const favorites = localStorage.getItem('favorites')
        if (favorites) {
          const items = JSON.parse(favorites)
          return items.some(item => item.id.toString() === productId.toString())
        }
      } catch (error) {
        console.error('❌ Ошибка проверки избранного:', error)
      }
    }
    
    return false
  }
  
  return {
    provide: {
      isFavorite
    }
  }
})