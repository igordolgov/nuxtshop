<!-- ~/components/layout/MobileNavFooter.vue -->
<template lang="pug">
ClientOnly
  div
    footer.mobile-nav-footer.border-t(
      class="bg-base-100 border-base-300"
      :class="{ 'horizontal-orientation': isHorizontal }"
    )
      nav.nav-items(:class="{ 'vertical-layout': isHorizontal }")
        button.nav-item(
          @click="openHome"
          :class="{ 'is-active': activeHome }"
        )
          .nav-icon
            svg(width="24", height="24", viewBox="0 0 24 24", fill="none")
              path(d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", stroke="currentColor", stroke-width="2")
          span.nav-label Главная

        button.nav-item(
          @click="openCart"
          :class="{ 'is-active': activeCart }"
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
        )
          .nav-icon.relative
            svg(width="24", height="24", viewBox="0 0 24 24", fill="none")
              path(d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z", stroke="currentColor", stroke-width="2")
            .favorites-badge(
              v-if="displayFavoritesCount > 0"
              :class="{ 'favorites-badge-sm': displayFavoritesCount < 10, 'favorites-badge-lg': displayFavoritesCount >= 10 }"
            ) {{ displayFavoritesCount > 99 ? '99+' : displayFavoritesCount }}
          span.nav-label Избранное

        button.nav-item(
          @click="toggleFullScreen"
          :title="isFullscreen ? 'Выйти из полноэкранного режима' : 'На весь экран'"
          :class="{ 'is-active': isFullscreen }"
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
/* ============================================
  БАЗОВЫЕ СТИЛИ
============================================ */
.mobile-nav-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding-top: 6px;
  z-index: 40;
}

.nav-items {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  padding: 0 16px;
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
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: color-mix(in oklab, var(--color-base-content) 10%, transparent);
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

/* ============================================
  АКТИВНАЯ ВКЛАДКА (синяя подсветка)
============================================ */
.nav-item.is-active {
  background-color: rgba(59, 130, 246, 0.15) !important;
  color: #3389d4 !important;
  font-weight: 600;
}

.nav-item.is-active .nav-icon svg {
  stroke: #3389d4 !important;
  stroke-width: 2.5px;
}

.nav-item.is-active .nav-label {
  color: #3389d4 !important;
}

/* ============================================
  КРАСНЫЕ БЕЙДЖИ (корзина, избранное, авторизация)
============================================ */
.cart-badge,
.favorites-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: #ef4444; /* ярко-красный */
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
  border: 2px solid var(--color-base-200);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
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
  background: #ef4444;
  border-radius: 50%;
  width: 8px;
  height: 8px;
  z-index: 1;
}

/* ============================================
  ГОРИЗОНТАЛЬНАЯ ОРИЕНТАЦИЯ
============================================ */
.mobile-nav-footer.horizontal-orientation {
  position: fixed;
  left: 0;
  top: 56px;
  bottom: 0;
  width: 70px;
  border-top: none;
  border-left: none;
  padding: 0;
  z-index: 40;
  height: calc(100% - 56px);
  overflow: hidden;
  background: var(--color-base-100);
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
  background-color: rgba(96, 165, 250, 0.2) !important;
}

/* ============================================
  АДАПТИВНОСТЬ
============================================ */
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
import { useCart } from '@/composables/useCart'
import { useAppState } from '@/composables/useAppState'
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from '#app'

const { totalItems } = useCart()
const appState = useAppState()
const router = useRouter()
const route = useRoute()

const isHorizontal = ref(false)
const localFavoritesCount = ref(0)
const isAuthenticated = computed(() => appState.isAuthenticated.value)
const isFullscreen = ref(false)

const activeHome = computed(() => {
  const path = route.path
  return path === '/' || path === '/index' || path === '/home'
})
const activeCart = computed(() => route.path?.startsWith('/cart') || false)
const activeFavorites = computed(() => route.path?.startsWith('/favorites') || false)
const activeAuth = computed(() => {
  const path = route.path
  return path?.startsWith('/auth') ||
    path?.startsWith('/login') ||
    path?.startsWith('/register') ||
    path?.startsWith('/profile') ||
    path?.startsWith('/user') ||
    path?.startsWith('/account') || false
})

const displayFavoritesCount = computed(() => localFavoritesCount.value || 0)
const cartItemsCount = computed(() => totalItems.value || 0)

const checkOrientation = () => {
  if (process.client) {
    const isLandscape = window.innerWidth > window.innerHeight
    const isTabletSize = window.innerWidth <= 926 && window.innerWidth >= 768
    isHorizontal.value = isLandscape && isTabletSize
  }
}

const checkFullscreen = () => {
  if (process.client) {
    isFullscreen.value = !!(document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement)
  }
}

const toggleFullScreen = () => {
  if (!process.client) return
  if (!document.fullscreenElement &&
    !document.webkitFullscreenElement &&
    !document.mozFullScreenElement &&
    !document.msFullscreenElement) {
    const elem = document.documentElement
    if (elem.requestFullscreen) elem.requestFullscreen()
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen()
    else if (elem.mozRequestFullScreen) elem.mozRequestFullScreen()
    else if (elem.msRequestFullscreen) elem.msRequestFullscreen()
  } else {
    if (document.exitFullscreen) document.exitFullscreen()
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen()
    else if (document.mozCancelFullScreen) document.mozCancelFullScreen()
    else if (document.msExitFullscreen) document.msExitFullscreen()
  }
}

const loadFavoritesFromStorage = () => {
  if (!process.client) return
  try {
    const favoritesData = localStorage.getItem('favoriteProducts')
    if (favoritesData) {
      const parsed = JSON.parse(favoritesData)
      if (Array.isArray(parsed)) localFavoritesCount.value = parsed.length
      else if (parsed && typeof parsed === 'object') {
        let count = 0
        for (const key in parsed) if (parsed[key] === true) count++
        localFavoritesCount.value = count
      } else localFavoritesCount.value = 0
    } else {
      const otherData = localStorage.getItem('favorites') || localStorage.getItem('userFavorites')
      if (otherData) {
        const parsed = JSON.parse(otherData)
        if (Array.isArray(parsed)) localFavoritesCount.value = parsed.length
        else if (parsed?.items && Array.isArray(parsed.items)) localFavoritesCount.value = parsed.items.length
        else if (parsed && typeof parsed === 'object') localFavoritesCount.value = Object.keys(parsed).length
        else localFavoritesCount.value = 0
      } else localFavoritesCount.value = 0
    }
  } catch (error) {
    console.error('Ошибка загрузки избранного:', error)
    localFavoritesCount.value = 0
  }
}

const handleFavoritesUpdated = () => loadFavoritesFromStorage()

const openHome = () => navigateTo('/')
const openCart = () => navigateTo('/cart')
const openFavorites = () => navigateTo('/favorites')
const openAuth = () => navigateTo(isAuthenticated.value ? '/user' : '/auth/login')

const updateNavigationWidthVariable = () => {
  if (!process.client) return
  if (isHorizontal.value) {
    document.documentElement.style.setProperty('--horizontal-nav-width', window.innerWidth <= 740 ? '60px' : '70px')
  } else {
    document.documentElement.style.setProperty('--horizontal-nav-width', '0px')
  }
}

watch(isHorizontal, (newValue) => {
  updateNavigationWidthVariable()
  if (process.client) {
    if (newValue) document.body.classList.add('has-horizontal-nav')
    else document.body.classList.remove('has-horizontal-nav')
  }
})

let favoritesPollInterval = null

onMounted(() => {
  if (process.client) {
    loadFavoritesFromStorage()
    checkOrientation()
    checkFullscreen()
    updateNavigationWidthVariable()
    if (isHorizontal.value) document.body.classList.add('has-horizontal-nav')

    document.addEventListener('fullscreenchange', checkFullscreen)
    document.addEventListener('webkitfullscreenchange', checkFullscreen)
    document.addEventListener('mozfullscreenchange', checkFullscreen)
    document.addEventListener('MSFullscreenChange', checkFullscreen)

    window.addEventListener('resize', () => {
      checkOrientation()
      updateNavigationWidthVariable()
    })
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        checkOrientation()
        updateNavigationWidthVariable()
      }, 100)
    })
    window.addEventListener('visibilitychange', () => {
      if (!document.hidden) setTimeout(() => loadFavoritesFromStorage(), 100)
    })
    window.addEventListener('favorites-updated', handleFavoritesUpdated)

    favoritesPollInterval = setInterval(() => loadFavoritesFromStorage(), 2000)
  }
})

onUnmounted(() => {
  if (process.client) {
    document.removeEventListener('fullscreenchange', checkFullscreen)
    document.removeEventListener('webkitfullscreenchange', checkFullscreen)
    document.removeEventListener('mozfullscreenchange', checkFullscreen)
    document.removeEventListener('MSFullscreenChange', checkFullscreen)
    window.removeEventListener('resize', checkOrientation)
    window.removeEventListener('orientationchange', checkOrientation)
    window.removeEventListener('favorites-updated', handleFavoritesUpdated)
    if (favoritesPollInterval) clearInterval(favoritesPollInterval)
    document.body.classList.remove('has-horizontal-nav')
    document.documentElement.style.setProperty('--horizontal-nav-width', '0px')
  }
})
</script>