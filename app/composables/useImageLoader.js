// composables/useImageLoader.js
export const useImageLoader = () => {
  const getSafeImageUrl = (url) => {
    if (!url) return '/images/placeholder.jpg'
    
    // Если это относительный путь
    if (url.startsWith('/')) {
      return url
    }
    
    // Если это URL Unsplash
    if (url.includes('unsplash.com')) {
      // Убедимся, что URL корректный
      try {
        const urlObj = new URL(url)
        // Добавляем параметры для оптимизации если их нет
        if (!urlObj.search) {
          return `${url}?w=1200&h=800&fit=crop&auto=format`
        }
        return url
      } catch {
        return '/images/placeholder.jpg'
      }
    }
    
    // Для других URL
    return url
  }
  
  return {
    getSafeImageUrl
  }
}