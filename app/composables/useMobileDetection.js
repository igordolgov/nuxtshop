// composables/useMobileDetection.js
// ============================================
// Composable: useMobileDetection
// Назначение: определение типа устройства и ориентации
// Возвращает: isMobile, isDesktop, isHorizontal, orientation
// ============================================

import { ref, readonly, computed } from 'vue'

// Глобальное состояние (синглтон)
const isMobileState = ref(false)
const isHorizontalState = ref(false)
let isInitialized = false

export const useMobileDetection = () => {
  // ============================================
  // Функции проверки
  // ============================================
  const checkMobile = () => {
    if (process.client) {
      isMobileState.value = window.innerWidth < 1024
    }
  }
  
  const checkOrientation = () => {
    if (process.client) {
      const width = window.innerWidth
      const height = window.innerHeight
      const isLandscape = width > height
      const isMobileDevice = width <= 768
      
      // Горизонтальный режим: мобильное устройство в landscape
      isHorizontalState.value = isMobileDevice 
        ? (isLandscape && width <= 926)
        : (isLandscape && width <= 1024)
    }
  }
  
  const checkAll = () => {
    checkMobile()
    checkOrientation()
  }
  
  const getMobileBreakpoint = () => 1024
  
  // ============================================
  // Инициализация только один раз
  // ============================================
  if (process.client && !isInitialized) {
    isInitialized = true
    checkAll()
    window.addEventListener('resize', checkAll, { passive: true })
    window.addEventListener('orientationchange', checkAll, { passive: true })
  }
  
  // ============================================
  // Вычисляемые свойства
  // ============================================
  const isDesktop = computed(() => !isMobileState.value)
  const orientation = computed(() => 
    isHorizontalState.value ? 'landscape' : 'portrait'
  )
  
  return {
    // Состояние (readonly для защиты)
    isMobile: readonly(isMobileState),
    isDesktop,
    isHorizontal: readonly(isHorizontalState),
    orientation,
    
    // Методы
    checkMobile,
    checkOrientation,
    checkAll,
    getMobileBreakpoint
  }
}