// composables/useFavorites.js
import { ref, computed } from 'vue'

let favoritesInstance = null

export const useFavorites = () => {
  if (favoritesInstance) {
    return favoritesInstance
  }

  const favorites = ref(new Set())
  const favoriteProducts = ref([])  // ← Добавляем хранение полных данных
  
  // Загрузка избранных из localStorage
  const loadFavorites = () => {
    if (process.client) {
      try {
        // Загружаем полные данные товаров
        const storedProducts = localStorage.getItem('favoriteProducts')
        if (storedProducts) {
          const data = JSON.parse(storedProducts)
          
          // Проверяем формат данных (массив ID или массив объектов)
          if (data.length > 0 && typeof data[0] === 'object') {
            // Новый формат - массив объектов
            favoriteProducts.value = data
            favorites.value = new Set(data.map(p => p.id))
          } else {
            // Старый формат - массив ID (для совместимости)
            favorites.value = new Set(data)
            favoriteProducts.value = []
          }
          
          console.log('❤️ Загружены избранные:', favorites.value.size, 'товаров')
        }
      } catch (err) {
        console.error('❌ Ошибка загрузки избранных:', err)
        favorites.value = new Set()
        favoriteProducts.value = []
      }
    }
  }

  // Сохранение избранных в localStorage
  const saveFavorites = () => {
    if (process.client) {
      try {
        // Сохраняем ПОЛНЫЕ данные товаров, не только ID
        localStorage.setItem('favoriteProducts', JSON.stringify(favoriteProducts.value))
        console.log('💾 Избранные сохранены:', favoriteProducts.value.length, 'товаров')
      } catch (err) {
        console.error('❌ Ошибка сохранения избранных:', err)
      }
    }
  }

  // Проверка, является ли товар избранным
  const isFavorite = (productId) => {
    return favorites.value.has(String(productId)) || favorites.value.has(Number(productId))
  }

  // Добавление в избранное - принимает ПОЛНЫЙ объект товара
  const addToFavorites = (product) => {
    if (process.client) {
      const productId = product.id || product._id
      
      if (!favorites.value.has(productId)) {
        favorites.value.add(productId)
        
        // Сохраняем ПОЛНЫЕ данные товара для навигации
        const productToSave = {
          id: productId,
          slug: product.slug || null,
          categorySlug: product.categorySlug || product.category?.slug || null,
          category: product.category?.name || product.category || null,
          name: product.name,
          price: product.price || product.currentPrice,
          image: product.image || product.mainImage || product.images?.[0],
          brand: product.brand,
          description: product.description,
          inStock: product.inStock !== undefined ? product.inStock : true,  // ✅ Добавлено
          stockQuantity: product.stockQuantity || null  // ✅ Добавлено
        }
        
        favoriteProducts.value.push(productToSave)
        saveFavorites()
        console.log('❤️ Добавлен в избранное:', product.name || productId)
        
        window.dispatchEvent(new CustomEvent('favorites-updated'))
      }
    }
  }

  // Удаление из избранного
  const removeFromFavorites = (productId) => {
    if (process.client) {
      favorites.value.delete(productId)
      favorites.value.delete(String(productId))
      favorites.value.delete(Number(productId))
      
      favoriteProducts.value = favoriteProducts.value.filter(p => 
        p.id !== productId && p.id !== String(productId) && p.id !== Number(productId)
      )
      
      saveFavorites()
      console.log('💔 Удален из избранного:', productId)
      
      window.dispatchEvent(new CustomEvent('favorites-updated'))
    }
  }

  // Переключение избранного - принимает ПОЛНЫЙ объект товара
  const toggleFavorite = (product) => {
    if (process.client) {
      const productId = product.id || product._id
      if (isFavorite(productId)) {
        removeFromFavorites(productId)
      } else {
        addToFavorites(product)
      }
    }
  }

  // Получение списка ID избранных товаров
  const favoriteIds = computed(() => {
    return Array.from(favorites.value)
  })

  // Получение полных данных избранных товаров
  const getFavoriteProducts = computed(() => {
    return favoriteProducts.value
  })

  // Получение количества избранных
  const favoritesCount = computed(() => {
    return favorites.value.size
  })

  // Очистка всех избранных
  const clearAllFavorites = () => {
    if (process.client) {
      favorites.value.clear()
      favoriteProducts.value = []
      saveFavorites()
      console.log('🗑️ Все избранные товары очищены')
      
      window.dispatchEvent(new CustomEvent('favorites-updated'))
    }
  }

  // Инициализация при создании
  if (process.client) {
    loadFavorites()
  }

  favoritesInstance = {
    // Состояние
    favorites: computed(() => favorites.value),
    favoriteIds,
    favoriteProducts: getFavoriteProducts,  // ← Добавляем
    favoritesCount,
    
    // Методы
    isFavorite,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    loadFavorites,
    clearAllFavorites
  }

  return favoritesInstance
}