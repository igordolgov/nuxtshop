// composables/useImageOptimization.js
export const useImageOptimization = () => {
  // Оптимизация URL изображения
  const optimizeImageUrl = (url, options = {}) => {
    if (!url) return null
    
    const { 
      width = 800, 
      height = 600, 
      quality = 80,
      format = 'auto'
    } = options
    
    // Для Unsplash
    if (url.includes('unsplash.com')) {
      const baseUrl = url.split('?')[0]
      return `${baseUrl}?w=${width}&h=${height}&fit=crop&crop=entropy&q=${quality}&auto=${format}`
    }
    
    // Для Cloudinary
    if (url.includes('cloudinary.com')) {
      return url.replace(
        /upload\//,
        `upload/c_fill,w_${width},h_${height},q_${quality},f_${format}/`
      )
    }
    
    // Для Imgix
    if (url.includes('imgix.net')) {
      return `${url}?w=${width}&h=${height}&fit=crop&q=${quality}&auto=${format}`
    }
    
    // Для других изображений
    return url
  }
  
  // Предзагрузка изображения
  const preloadImage = (url) => {
    return new Promise((resolve) => {
      if (!process.client) return resolve(true)
      
      const img = new Image()
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = url
    })
  }
  
  // Ленивая загрузка изображений
  const lazyLoadImages = (imageSelector = 'img[data-src]') => {
    if (!process.client) return
    
    const images = document.querySelectorAll(imageSelector)
    
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target
          const src = img.getAttribute('data-src')
          if (src) {
            img.src = src
            img.removeAttribute('data-src')
            img.classList.add('loaded')
          }
          imageObserver.unobserve(img)
        }
      })
    }, {
      rootMargin: '100px',
      threshold: 0.1
    })
    
    images.forEach(img => imageObserver.observe(img))
  }
  
  // Получение placeholder
  const getPlaceholder = (width = 300, height = 200) => {
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f5f5f5"/>
        <text x="50%" y="50%" font-family="Arial" font-size="14" fill="#666" text-anchor="middle" dy=".3em">Loading...</text>
      </svg>
    `)}`
  }
  
  return {
    optimizeImageUrl,
    preloadImage,
    lazyLoadImages,
    getPlaceholder
  }
}