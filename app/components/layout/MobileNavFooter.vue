<!-- ~/components/layout/MobileNavFooter.vue — нижняя навигация мобильных.
    Всегда снизу, включая landscape: боковой режим удалён — крупные
    магазины не прячут навигацию в боковую колонку. Кнопка «Развернуть»
    (Fullscreen) удалена: нестандартна для магазинов, мертва на iOS.
    4 пункта: Главная, Корзина, Избранное, Профиль. -->
<template lang="pug">
ClientOnly
  div
    footer.mobile-nav-footer.border-t(class="border-base-300")
      nav.nav-items(aria-label="Основная навигация")
        button.nav-item(
          type="button"
          @click="openHome"
          :class="{ 'is-active': activeHome }"
          :aria-current="activeHome ? 'page' : undefined"
        )
          .nav-icon
            svg(width="24", height="24", viewBox="0 0 24 24", fill="none")
              path(d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", stroke="currentColor", stroke-width="2")
          span.nav-label Главная

        button.nav-item(
          type="button"
          @click="openCart"
          :class="{ 'is-active': activeCart }"
          :aria-current="activeCart ? 'page' : undefined"
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
          type="button"
          @click="openFavorites"
          :class="{ 'is-active': activeFavorites }"
          :aria-current="activeFavorites ? 'page' : undefined"
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
          type="button"
          @click="openAuth"
          :class="{ 'is-active': activeAuth }"
          :aria-current="activeAuth ? 'page' : undefined"
        )
          .nav-icon.relative
            svg(width="24", height="24", viewBox="0 0 24 24", fill="none")
              path(d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", stroke="currentColor", stroke-width="2")
            .auth-badge(v-if="isAuthenticated")
          span.nav-label {{ isAuthenticated ? 'Профиль' : 'Вход' }}
</template>

<style scoped>
/* ============================================================
   БАЗА. Карта z-index: шапка 50 · нижняя навигация 40 · FAB 30
============================================================ */
.mobile-nav-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 40;
  padding-top: 6px;
  /* Safe-area: жестовая полоса Android/iPhone не перекрывает пункты.
     Работает с viewport-fit=cover (nuxt.config) */
  padding-bottom: calc(4px + var(--safe-area-bottom, 0px));
  /* Полупрозрачный фон + blur — согласованно со шапкой (bg-base-100/95) */
  background: color-mix(in oklab, var(--color-base-100) 92%, transparent);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

/* 4 пункта — одинаковая ширина на всех мобильных экранах */
.nav-items {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
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
  min-height: 0;
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}

/* Sticky-hover на таче — источник «прилипших» подсветок:
   hover только для устройств с курсором */
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

/* Активная вкладка — цвет из темы (раньше был хардкод #3389d4).
   Цвет текста — с гарантированным контрастом на тинте 34% primary:
   corporate (светлая): тинт ≈ #a8d4ee — blue-400 давал 1.67:1 (провал
   Lighthouse color-contrast), blue-800 (#1e40af) даёт 5.5:1;
   business (тёмная): тинт ≈ #2c3540 — blue-400 даёт ≈ 4.8:1. */
.nav-item.is-active {
  background-color: color-mix(in oklab, var(--color-primary) 34%, transparent);
  color: var(--color-blue-800, #1e40af);
  font-weight: 600;
}

.nav-item.is-active .nav-icon svg {
  stroke: var(--color-primary);
  stroke-width: 2.5px;
}

.nav-item.is-active .nav-label {
  color: var(--color-blue-800, #1e40af);
}

[data-theme='business'] .nav-item.is-active {
  color: var(--color-blue-400, #51a2ff);
}

[data-theme='business'] .nav-item.is-active .nav-label {
  color: var(--color-blue-400, #51a2ff);
}

/* Бейджи — цвет ошибки из темы (раньше #ef4444) */
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
</style>

<script setup>
//- Компонент: фиксированная нижняя навигация мобильных.
//- Источники данных — общие композаблы (singleton): бейджи всегда
//- синхронны с шапкой. Слушатели resize/orientationchange больше не
//- нужны: ориентация больше ни на что не влияет
const route = useRoute()
const appState = useAppState()
const { totalItems } = useCart()
const { favoritesCount } = useFavorites()

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
const isAuthenticated = computed(() => appState.isAuthenticated.value)

const openHome = () => navigateTo('/')
const openCart = () => navigateTo('/cart')
const openFavorites = () => navigateTo('/favorites')
const openAuth = () => navigateTo(isAuthenticated.value ? '/user' : '/auth/login')
</script>