// app/composables/useMobileDetection.js
// ============================================
// Composable: useMobileDetection — единый источник правды
// по устройству для всех потребителей (Header, MobileNavFooter,
// страницы). Порог согласован с CSS-брейкпоинтами:
//   isMobile — ширина < 1024 (Tailwind lg)
// ПРИМЕЧАНИЕ: isHorizontal удалён вместе с боковой навигацией
// в landscape (нижнее меню теперь постоянно). Ориентация как
// состояние не нужна никому; если появится потребитель —
// добавить реактивный ref, обновляемый в checkAll.
// ============================================

import { ref, readonly, computed } from 'vue'

// ⚙️ НАСТРОЙКА: брейкпоинт. Менять только здесь —
// компоненты берут значение через этот композабл.
const MOBILE_BREAKPOINT = 1024 // ниже — мобильная раскладка (= Tailwind lg)

// Глобальное состояние (синглтон): все потребители делят одно значение
const isMobileState = ref(false)
let isInitialized = false

export const useMobileDetection = () => {
  const checkMobile = () => {
    if (!import.meta.client) return
    isMobileState.value = window.innerWidth < MOBILE_BREAKPOINT
  }

  const checkAll = () => checkMobile()

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

  return {
    // Состояние (readonly — защищает от мутаций извне)
    isMobile: readonly(isMobileState),
    isDesktop,

    // Методы (сохранены для обратной совместимости)
    checkMobile,
    checkAll,
    getMobileBreakpoint,
  }
}