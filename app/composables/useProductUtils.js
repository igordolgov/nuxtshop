// app/composables/useProductUtils.js
export const useProductUtils = () => {
  // Безопасное получение изображения
  const getSafeImage = (imageUrl) => {
    if (!imageUrl || imageUrl.includes('placeholder.com') || imageUrl.includes('via.placeholder.com')) {
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNGE1NTY4Ii8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K'
    }
    return imageUrl
  }

  // Форматирование цены
  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU').format(price)
  }

  // Обработчик ошибки загрузки изображения
  const handleImageError = (errorInfo) => {
    try {
      console.log('🖼 Обработка ошибки изображения в composable', errorInfo)
      
      // Возвращаем fallback URL вместо попытки модифицировать элемент
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjNGE1NTY4Ii8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iI2ZmZmZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIEVycm9yPC90ZXh0Pgo8L3N2Zz4K'
    } catch (error) {
      console.error('❌ Ошибка в handleImageError:', error)
      return 'https://placehold.co/600x400/d1d5db/6b7280?text=Нет+изображения'
    }
  }

  return {
    getSafeImage,
    formatPrice,
    handleImageError
  }
}