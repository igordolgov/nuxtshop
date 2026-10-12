// app/composables/usePageConditions.js
// Composable: определяет условия страницы — главная ли это, горизонтальная ли
// ориентация на мобильных. Используется для переключения раскладки главной.
// Примечание: useRoute() не импортируем — Nuxt автоимпортит его из vue-router.

import { ref, computed, onMounted, onUnmounted } from 'vue'

export const usePageConditions = () => {
  // Автоимпорт Nuxt (vue-router). Не добавлять явный import —
  // это порождает предупреждение knip о неуказанной зависимости.
  const route = useRoute()

  const isHorizontal = ref(false)
  const isHomePage = computed(() => route.path === '/')

  // Порог ориентации. ⚙️ НАСТРОЙКА: 926 — ширина крупных телефонов/мини-планшетов
  const MAX_HORIZONTAL_WIDTH = 926

  // Ориентация считается только на клиенте (на SSR окно недоступно)
  const checkOrientation = () => {
    if (import.meta.client) {
      isHorizontal.value =
        window.innerWidth > window.innerHeight && window.innerWidth <= MAX_HORIZONTAL_WIDTH
    }
  }

  // Вертикальное положение — отрицание горизонтального
  const isVertical = computed(() => !isHorizontal.value)

  // Основное условие: главная + вертикальная ориентация
  const isHomePageVertical = computed(() => isHomePage.value && isVertical.value)

  // Условие: главная + горизонтальная ориентация
  const isHomePageHorizontal = computed(() => isHomePage.value && isHorizontal.value)

  onMounted(() => {
    if (import.meta.client) {
      checkOrientation()
      // Пересчёт при изменении размеров/ориентации окна
      window.addEventListener('resize', checkOrientation)
      window.addEventListener('orientationchange', checkOrientation)
    }
  })

  onUnmounted(() => {
    if (import.meta.client) {
      // Обязательная очистка — иначе утечка листенеров при навигации
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
    checkOrientation,
  }
}