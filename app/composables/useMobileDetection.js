// app/composables/useMobileDetection.js
// ============================================
// Composable: useMobileDetection — единый источник правды
// по устройству. Порог согласован с CSS-брейкпоинтами:
//   isMobile — ширина < 768 (Tailwind md)
// Телефон/планшет до 768 включительно → мобильная вёрстка
// В landscape телефон (740–844px) остаётся мобильным —
// поворот экрана ничего не перестраивает (канон маркетплейсов)
// ============================================

import { ref, readonly, computed } from 'vue'

// ⚙️ НАСТРОЙКА: брейкпоинт. Менять только здесь.
const MOBILE_BREAKPOINT = 768 // ниже — мобильная раскладка (= Tailwind md)

const isMobileState = ref(false)
let isInitialized = false

export const useMobileDetection = () => {
  const checkMobile = () => {
    if (!import.meta.client) return
    isMobileState.value = window.innerWidth < MOBILE_BREAKPOINT
  }

  const checkAll = () => checkMobile()
  const getMobileBreakpoint = () => MOBILE_BREAKPOINT

  if (import.meta.client && !isInitialized) {
    isInitialized = true
    checkAll()
    window.addEventListener('resize', checkAll, { passive: true })
    window.addEventListener('orientationchange', () => {
      setTimeout(checkAll, 100)
    })
  }

  const isDesktop = computed(() => !isMobileState.value)

  return {
    isMobile: readonly(isMobileState),
    isDesktop,
    checkMobile,
    checkAll,
    getMobileBreakpoint,
  }
}