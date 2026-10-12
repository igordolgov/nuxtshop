<!-- ~/components/layout/MobileNavFooter.vue -->
<!-- Нижняя навигация мобильных (fixed). В landscape-режиме планшетов/крупных -->
<!-- телефонов превращается в боковую колонку слева. -->
<template lang="pug">
ClientOnly
  div
    footer.mobile-nav-footer.border-t(
      class="border-base-300"
      :class="{ 'horizontal-orientation': isHorizontal }"
    )
      nav.nav-items(
        :class="{ 'vertical-layout': isHorizontal, 'nav-items-4': !canFullscreen }"
        aria-label="Основная навигация"
      )
        button.nav-item(
          @click="openHome"
          :class="{ 'is-active': activeHome }"
          :aria-current="activeHome ? 'page' : undefined"
          type="button"
        )
          .nav-icon
            svg(width="24", height="24", viewBox="0 0 24 24", fill="none")
              path(d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", stroke="currentColor", stroke-width="2")
          span.nav-label Главная

        button.nav-item(
          @click="openCart"
          :class="{ 'is-active': activeCart }"
          :aria-current="activeCart ? 'page' : undefined"
          type="button"
        )
          .nav-icon.relative
            svg(width="24", height="24", viewBox="0 0 24 24", fill="none")
              path(d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z", stroke="currentColor", stroke-width="2")
            .cart-badge(
              v-if="cartItemsCount > 0"
              :class="{ 'cart-badge-sm': cartItemsCount < 10, 'cart-badge-lg': cartItemsCount >= 10 }"
            ) {{ cartItemsCount > 99 ? '99+' : cartItemsCount }}
          span.nav-label Корзина

        button.nav-item(
          @click="openFavorites"
          :class="{ 'is-active': activeFavorites }"
          :aria-current="activeFavorites ? 'page' : undefined"
          type="button"
        )
          .nav-icon.relative
            svg(width="24", height="24", viewBox="0 0 24 24", fill="none")
              path(d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z", stroke="currentColor", stroke-width="2")
            .favorites-badge(
              v-if="displayFavoritesCount > 0"
              :class="{ 'favorites-badge-sm': displayFavoritesCount < 10, 'favorites-badge-lg': displayFavoritesCount >= 10 }"
            ) {{ displayFavoritesCount > 99 ? '99+' : displayFavoritesCount }}
          span.nav-label Избранное

        //- Кнопка полноэкранного режима рендерится только если браузер
        //- поддерживает Fullscreen API (iOS Safari — не поддерживает)
        button.nav-item(
          v-if="canFullscreen"
          @click="toggleFullScreen"
          :title="isFullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'"
          :class="{ 'is-active': isFullscreen }"
          type="button"
        )
          .nav-icon
            svg(width="24", height="24", viewBox="0 0 24 24", fill="none")
              path(
                v-if="!isFullscreen"
                d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"
                stroke="currentColor"
                stroke-width="2"
              )
              path(
                v-else
                d="M9 9l6 6m0-6l-6 6M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke="currentColor"
                stroke-width="2"
              )
          span.nav-label {{ isFullscreen ? 'Свернуть' : 'Развернуть' }}

        button.nav-item(
          @click="openAuth"
          :class="{ 'is-active': activeAuth }"
          :aria-current="activeAuth ? 'page' : undefined"
          type="button"
        )
          .nav-icon.relative
            svg(width="24", height="24", viewBox="0 0 24 24", fill="none")
              path(
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
                stroke="currentColor",
                stroke-width="2"
              )
            .auth-badge(v-if="isAuthenticated")
          span.nav-label {{ isAuthenticated ? 'Профиль' : 'Вход' }}
</template>

<style scoped>
/* ============================================================
   БАЗА
   Карта z-index: шапка 50 · нижняя навигация 40 · FAB 30
============================================================ */
.mobile-nav-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 40;
  padding-top: 6px;
  /* Safe-area: на iPhone с жестовой полосой пункты меню не прилипают
     к краю. Работает с viewport-fit=cover (nuxt.config) */
  padding-bottom: calc(4px + var(--safe-area-bottom, 0px));
  /* Полупрозрачный фон + blur — согласованно со шапкой (bg-base-100/95) */
  background: color-mix(in oklab, var(--color-base-100) 92%, transparent);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.nav-items {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  padding: 0 16px;
}

/* Без кнопки «Развернуть» (нет Fullscreen API) — 4 колонки,
   пункты не растягиваются на ширину пятого */
.nav-items-4 {
  grid-template-columns: repeat(4, 1fr);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-base-content);
  position: relative;
  flex: 1;
  min-height: 0;
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}

/* Sticky-hover на таче — источник «прилипших» подсветок.
   Hover только для устройств с курсором */
@media (hover: hover) {
  .nav-item:hover {
    background: color-mix(in oklab, var(--color-base-content) 10%, transparent);
  }
}

.nav-item:active {
  transform: scale(0.95);
}

.nav-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.nav-label {
  font-size: 11px;
  font-weight: 500;
  line-height: 1.2;
  text-align: center;
  word-break: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  flex-shrink: 0;
}

/* ============================================================
   АКТИВНАЯ ВКЛАДКА — цвет из темы (в business тоже согласован).
   Раньше был хардкод #3389d4, выпадавший из палитры тем
============================================================ */
.nav-item.is-active {
  background-color: color-mix(in oklab, var(--color-primary) 14%, transparent);
  color: var(--color-primary);
  font-weight: 600;
}

.nav-item.is-active .nav-icon svg {
  stroke: var(--color-primary);
  stroke-width: 2.5px;
}

.nav-item.is-active .nav-label {
  color: var(--color-primary);
}

/* ============================================================
   БЕЙДЖИ — цвет ошибки из темы (--color-error вместо #ef4444)
============================================================ */
.cart-badge,
.favorites-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: var(--color-error);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 10px;
  line-height: 1;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  border: 2px solid var(--color-base-100);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.2);
  z-index: 1;
}

/* Размеры для маленьких и больших чисел */
.cart-badge-sm,
.favorites-badge-sm {
  font-size: 10px;
  min-width: 16px;
  height: 16px;
}

.cart-badge-lg,
.favorites-badge-lg {
  font-size: 9px;
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
}

.auth-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: var(--color-error);
  border-radius: 50%;
  width: 8px;
  height: 8px;
  z-index: 1;
}

/* ============================================================
   ГОРИЗОНТАЛЬНАЯ ОРИЕНТАЦИЯ — навигация колонкой слева
============================================================ */
.mobile-nav-footer.horizontal-orientation {
  left: 0;
  top: var(--header-height, 56px);
  bottom: 0;
  width: 70px;
  border-top: none;
  border-left: none;
  padding: 0;
  height: calc(100% - var(--header-height, 56px));
  overflow: hidden;
  --horizontal-nav-width: 70px;
}

.horizontal-orientation .nav-items.vertical-layout {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  justify-content: space-between;
  align-items: stretch;
}

.horizontal-orientation .nav-items.vertical-layout .nav-item {
  flex: 1;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0;
  margin: 0;
  min-height: 0;
  border-radius: 0;
  border-bottom: 1px solid color-mix(in oklab, var(--color-base-200) 50%, transparent);
  position: relative;
  overflow: auto;
}

.horizontal-orientation .nav-items.vertical-layout .nav-item:last-child {
  border-bottom: none;
}

.horizontal-orientation .nav-items.vertical-layout .nav-icon {
  width: 22px;
  height: 22px;
}

.horizontal-orientation .nav-items.vertical-layout .nav-label {
  font-size: 11px;
  line-height: 1.1;
  padding: 0 2px;
  text-overflow: ellipsis;
  max-width: 100%;
}

.mobile-nav-footer.horizontal-orientation .nav-item.is-active {
  background-color: color-mix(in oklab, var(--color-primary) 20%, transparent);
}

/* ============================================================
   АДАПТИВНОСТЬ
============================================================ */
@media (max-width: 480px) {
  .nav-items {
    padding: 0 6px;
    gap: 4px;
  }
  .nav-item {
    padding: 6px 2px;
    gap: 2px;
  }
  .nav-label {
    font-size: 10px;
  }
}

@media (max-height: 300px) {
  .horizontal-orientation .nav-items.vertical-layout .nav-label {
    font-size: 10px;
  }
  .horizontal-orientation .nav-items.vertical-layout .nav-icon {
    width: 20px;
    height: 20px;
  }
  .cart-badge,
  .favorites-badge {
    top: 2px;
    right: 2px;
    font-size: 9px;
    min-width: 14px;
    height: 14px;
  }
}

@media (max-width: 740px) and (orientation: landscape) {
  .mobile-nav-footer.horizontal-orientation {
    width: 60px;
    --horizontal-nav-width: 60px;
  }
  .horizontal-orientation .nav-items.vertical-layout .nav-label {
    font-size: 8px;
  }
  .horizontal-orientation .nav-items.vertical-layout .nav-icon {
    width: 20px;
    height: 20px;
  }
}
</style>

<script setup>
//- Компонент: фиксированная нижняя навигация мобильных.
//- Источники данных — общие композаблы (singleton): бейджи всегда
//- синхронны с шапкой, никакого локального поллинга localStorage.
import { useCart } from '@/composables/useCart'
import { useAppState } from '@/composables/useAppState'
import { useFavorites } from '@/composables/useFavorites'

const route = useRoute()
const appState = useAppState()
const { totalItems } = useCart()
// Раньше здесь был свой парсер localStorage + setInterval(2s) —
// теперь бейдж reactive из общего стейка (как в Header.vue)
const { favoritesCount } = useFavorites()

const isHorizontal = ref(false)
const isFullscreen = ref(false)
// iOS Safari не даёт Fullscreen API для произвольных элементов —
// кнопку показываем только при реальной поддержке
const canFullscreen = ref(false)

const activeHome = computed(() => {
  const path = route.path
  return path === '/' || path === '/index' || path === '/home'
})
const activeCart = computed(() => route.path?.startsWith('/cart') || false)
const activeFavorites = computed(() => route.path?.startsWith('/favorites') || false)
const activeAuth = computed(() => {
  const path = route.path
  return (
    path?.startsWith('/auth') ||
    path?.startsWith('/login') ||
    path?.startsWith('/register') ||
    path?.startsWith('/profile') ||
    path?.startsWith('/user') ||
    path?.startsWith('/account') ||
    false
  )
})

const displayFavoritesCount = computed(() => favoritesCount.value || 0)
const cartItemsCount = computed(() => totalItems.value || 0)

// ⚙️ НАСТРОЙКА: диапазон ширины, при котором в landscape навигация
// уходит в боковую колонку. Должен совпадать с usePageConditions
const checkOrientation = () => {
  if (!import.meta.client) return
  const isLandscape = window.innerWidth > window.innerHeight
  const isTabletSize = window.innerWidth >= 768 && window.innerWidth <= 926
  isHorizontal.value = isLandscape && isTabletSize
}

const checkFullscreen = () => {
  if (!import.meta.client) return
  isFullscreen.value = !!(document.fullscreenElement || document.webkitFullscreenElement)
}

const toggleFullScreen = () => {
  if (!import.meta.client || !canFullscreen.value) return
  const elem = document.documentElement
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    ;(elem.requestFullscreen || elem.webkitRequestFullscreen)?.call(elem)
  } else {
    ;(document.exitFullscreen || document.webkitExitFullscreen)?.call(document)
  }
}

const openHome = () => navigateTo('/')
const openCart = () => navigateTo('/cart')
const openFavorites = () => navigateTo('/favorites')
const openAuth = () => navigateTo(isAuthenticated.value ? '/user' : '/auth/login')

const isAuthenticated = computed(() => appState.isAuthenticated.value)

const updateNavigationWidthVariable = () => {
  if (!import.meta.client) return
  if (isHorizontal.value) {
    document.documentElement.style.setProperty(
      '--horizontal-nav-width',
      window.innerWidth <= 740 ? '60px' : '70px',
    )
  } else {
    document.documentElement.style.setProperty('--horizontal-nav-width', '0px')
  }
}

//- Именованные обработчики: обязательны для корректного
//- removeEventListener в onUnmounted (раньше добавлялись анонимными
//- стрелками, а снимались другие ссылки — утечка при каждом переходе)
const onResize = () => {
  checkOrientation()
  updateNavigationWidthVariable()
}

const onOrientationChange = () => {
  // Небольшая задержка: ориентация на iOS меняется раньше, чем размеры
  setTimeout(() => {
    checkOrientation()
    updateNavigationWidthVariable()
  }, 100)
}

const onFullscreenChange = () => checkFullscreen()

watch(isHorizontal, (newValue) => {
  updateNavigationWidthVariable()
  if (!import.meta.client) return
  // body-класс используют страницы для отступа под боковую навигацию
  document.body.classList.toggle('has-horizontal-nav', newValue)
})

onMounted(() => {
  checkOrientation()
  checkFullscreen()
  // ⚙️: определяем поддержку Fullscreen API (на iOS Safari — false,
  // кнопка «Развернуть» не рендерится)
  canFullscreen.value = !!(
    document.documentElement.requestFullscreen ||
    document.documentElement.webkitRequestFullscreen
  )
  updateNavigationWidthVariable()
  if (isHorizontal.value) document.body.classList.add('has-horizontal-nav')

  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)
  window.addEventListener('resize', onResize)
  window.addEventListener('orientationchange', onOrientationChange)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('orientationchange', onOrientationChange)
  document.body.classList.remove('has-horizontal-nav')
  document.documentElement.style.setProperty('--horizontal-nav-width', '0px')
})
</script>