// app/composables/useMobileDetection.js
// ============================================
// Composable: useMobileDetection — единый источник правды
// по устройству для всех потребителей (Header, MobileNavFooter,
// страницы). Пороги согласованы с CSS-брейкпоинтами:
//   isMobile     — ширина < 1024 (Tailwind lg)
//   isHorizontal — landscape И ширина 768–926 (боковая навигация)
// ============================================

import { ref, readonly, computed } from 'vue'

// ⚙️ НАСТРОЙКА: брейкпоинты. Менять только здесь —
// компоненты берут значения через этот композабл.
const MOBILE_BREAKPOINT = 1024 // ниже — мобильная раскладка (= Tailwind lg)
const HORIZONTAL_MIN = 768 // боковая навигация в landscape: от этой ширины…
const HORIZONTAL_MAX = 926 // …до этой (крупные телефоны/мини-планшеты)

// Глобальное состояние (синглтон): все потребители делят одно значение
const isMobileState = ref(false)
const isHorizontalState = ref(false)
let isInitialized = false

export const useMobileDetection = () => {
  const checkMobile = () => {
    if (!import.meta.client) return
    isMobileState.value = window.innerWidth < MOBILE_BREAKPOINT
  }

  const checkOrientation = () => {
    if (!import.meta.client) return
    const width = window.innerWidth
    const height = window.innerHeight
    // Раньше порог зависел от самой ширины (≤768 ? 926 : 1024) — из-за этого
    // при ширине 740 в landscape страница считала режим «горизонтальным»,
    // а футер — нет: меню искали то слева, то снизу
    isHorizontalState.value =
      width > height && width >= HORIZONTAL_MIN && width <= HORIZONTAL_MAX
  }

  const checkAll = () => {
    checkMobile()
    checkOrientation()
  }

  const getMobileBreakpoint = () => MOBILE_BREAKPOINT

  // Инициализация один раз на приложение (синглтон живёт вечно,
  // поэтому слушатели не снимаются — это осознанно)
  if (import.meta.client && !isInitialized) {
    isInitialized = true
    checkAll()
    window.addEventListener('resize', checkAll, { passive: true })
    window.addEventListener('orientationchange', () => {
      // Небольшая задержка: ОС меняет размеры окна позже события
      setTimeout(checkAll, 100)
    })
  }

  const isDesktop = computed(() => !isMobileState.value)
  const orientation = computed(() => (isHorizontalState.value ? 'landscape' : 'portrait'))

  return {
    // Состояние (readonly — защищает от мутаций извне)
    isMobile: readonly(isMobileState),
    isDesktop,
    isHorizontal: readonly(isHorizontalState),
    orientation,

    // Методы (сохранены для обратной совместимости)
    checkMobile,
    checkOrientation,
    checkAll,
    getMobileBreakpoint,
  }
}