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
    // Первый кадр гидратации обязан совпасть с сервером (isMobile=false),
    // иначе мобильный клиент расходится с SSR по v-if сайдбара/футера
    // и классам сетки карточек. Реальную ширину окна применяем через
    // onNuxtReady: при гидратации он срабатывает после app:suspense:resolve,
    // при чистом клиентском запуске (SPA-навигация) — на ближайшем idle.
    // Синхронный checkAll здесь давал hydration mismatch и падения
    // patch'а после гидратации на мобильных.
    onNuxtReady(() => checkAll())
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