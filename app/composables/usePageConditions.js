// composables/usePageConditions.js
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute } from 'vue-router'

export const usePageConditions = () => {
  const route = useRoute()
  const isHorizontal = ref(false)
  const isHomePage = computed(() => route.path === '/')

  // Проверка ориентации
  const checkOrientation = () => {
    if (process.client) {
      isHorizontal.value = window.innerWidth > window.innerHeight && window.innerWidth <= 926
    }
  }

  // Проверка для вертикального положения
  const isVertical = computed(() => !isHorizontal.value)

  // Основное условие: главная страница + вертикальная ориентация
  const isHomePageVertical = computed(() => {
    return isHomePage.value && isVertical.value
  })

  // Условие: главная страница + горизонтальная ориентация
  const isHomePageHorizontal = computed(() => {
    return isHomePage.value && isHorizontal.value
  })

  onMounted(() => {
    if (process.client) {
      checkOrientation()
      window.addEventListener('resize', checkOrientation)
      window.addEventListener('orientationchange', checkOrientation)
    }
  })

  onUnmounted(() => {
    if (process.client) {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
    }
  })

  return {
    isHomePage,
    isHorizontal,
    isVertical,
    isHomePageVertical,
    isHomePageHorizontal,
    checkOrientation
  }
}