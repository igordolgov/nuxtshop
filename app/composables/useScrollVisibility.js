// composables/useScrollVisibility.js
import { ref, onMounted, onUnmounted } from 'vue'

export const useScrollVisibility = () => {
  const showScrollTop = ref(false)
  const showMobileFooter = ref(false)

  const handleScroll = () => {
    if (!process.client) return
    
    let scrollPosition = 0
    
    // Проверяем все возможные контейнеры для прокрутки
    const mobileContainer = document.querySelector('.mobile-products-container')
    const productsContainer = document.querySelector('.products-container')
    
    if (mobileContainer) {
      scrollPosition = mobileContainer.scrollTop
    } else if (productsContainer) {
      scrollPosition = productsContainer.scrollTop
    } else {
      scrollPosition = window.scrollY || document.documentElement.scrollTop
    }
    
    // Футер появляется только при прокрутке товаров
    showMobileFooter.value = scrollPosition > 50
    showScrollTop.value = scrollPosition > 200
  }

  const init = () => {
    if (process.client) {
      const containers = [
        document.querySelector('.mobile-products-container'),
        document.querySelector('.products-container'),
        window
      ]
      
      containers.forEach(container => {
        if (container) {
          container.addEventListener('scroll', handleScroll, { passive: true })
        }
      })
      
      setTimeout(handleScroll, 100)
    }
  }

  const destroy = () => {
    if (process.client) {
      const containers = [
        document.querySelector('.mobile-products-container'),
        document.querySelector('.products-container'),
        window
      ]
      
      containers.forEach(container => {
        if (container) {
          container.removeEventListener('scroll', handleScroll)
        }
      })
    }
  }

  return {
    showScrollTop,
    showMobileFooter,
    init,
    destroy
  }
}