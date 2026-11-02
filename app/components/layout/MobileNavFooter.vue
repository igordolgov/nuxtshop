<!-- ~/components/layout/MobileNavFooter.vue — нижняя навигация мобильных.
    Всегда снизу, включая landscape: боковой режим удалён — крупные
    магазины не прячут навигацию в боковую колонку. Кнопка «Развернуть»
    (Fullscreen) удалена: нестандартна для магазинов, мертва на iOS.
    5 пунктов: Главная, Корзина, Избранное, Профиль, Язык.
    Язык: popover ВВЕРХ с тремя локалями — те же обычные <a> на
    switchLocalePath(), что в LocaleSwitcher и бургер-разделе шапки
    (полный page load: клиентский резолвер @nuxtjs/i18n возвращает
    навигацию на «/» в текущую локаль). Локали и ссылки SSR-детерминированы,
    поповер закрыт в первом кадре — hydration mismatch нет. -->
<template lang="pug">
//- БЕЗ ClientOnly и v-if=isMobile: раньше футер появлялся только после
//- гидратации + onNuxtReady — «нижнее меню отрисовывается через секунду».
//- Теперь SSR рендерит его сразу, а на десктопе прячет чистый CSS
//- (media ≥768px ниже). Персональные биты (бейджи, Профиль/Вход)
//- под mounted-стражем — первый кадр гидратации совпадает с SSR.
div
  footer.mobile-nav-footer.border-t(class="border-base-300")
    nav.nav-items(:aria-label="$t('nav.mainNav')")
      button.nav-item(
        type="button"
        @click="openHome"
        :class="{ 'is-active': activeHome }"
        :aria-current="activeHome ? 'page' : undefined"
      )
        .nav-icon
          svg(width="24", height="24", viewBox="0 0 24 24", fill="none")
            path(d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", stroke="currentColor", stroke-width="2")
        span.nav-label {{ $t('nav.home') }}

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
            v-if="isMounted && cartItemsCount > 0"
            :class="{ 'cart-badge-sm': cartItemsCount < 10, 'cart-badge-lg': cartItemsCount >= 10 }"
          ) {{ cartItemsCount > 99 ? '99+' : cartItemsCount }}
        span.nav-label {{ $t('nav.cart') }}

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
            v-if="isMounted && displayFavoritesCount > 0"
            :class="{ 'favorites-badge-sm': displayFavoritesCount < 10, 'favorites-badge-lg': displayFavoritesCount >= 10 }"
          ) {{ displayFavoritesCount > 99 ? '99+' : displayFavoritesCount }}
        span.nav-label {{ $t('nav.favorites') }}

      button.nav-item(
        type="button"
        @click="openAuth"
        :class="{ 'is-active': activeAuth }"
        :aria-current="activeAuth ? 'page' : undefined"
      )
        .nav-icon.relative
          svg(width="24", height="24", viewBox="0 0 24 24", fill="none")
            path(d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", stroke="currentColor", stroke-width="2")
          .auth-badge(v-if="isMounted && isAuthenticated")
        span.nav-label {{ isMounted && isAuthenticated ? $t('nav.profile') : $t('nav.login') }}

      //- Язык — popover вверх; подсветка только пока открыт
      button.nav-item(
        type="button"
        @click="toggleLang"
        :aria-label="$t('header.language')"
        :aria-expanded="isLangOpen"
        aria-haspopup="menu"
        :class="{ 'is-active': isLangOpen }"
      )
        .lang-wrap
          .nav-icon
            svg(width="24", height="24", viewBox="0 0 24 24", fill="none")
              path(d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3 7.5 7.03 7.5 12s2.015 9 4.5 9zM3.6 9h16.8M3.6 15h16.8", stroke="currentColor", stroke-width="2")
          .lang-popover(
            v-show="isLangOpen"
            role="menu"
            :aria-label="$t('header.language')"
          )
            a.lang-option(
              v-for="l in locales"
              :key="l.code"
              :href="switchLocalePath(l.code)"
              role="menuitem"
              :class="{ 'is-current': l.code === locale }"
              @click="closeLang"
            )
              span {{ l.name }}
              span.lang-check(v-if="l.code === locale") ✓
        span.nav-label {{ $t('header.language') }}
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

/* 5 пунктов — одинаковая ширина на всех мобильных экранах */
.nav-items {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  padding: 0 16px;
}

/* ─── Язык: popover над кнопкой ───────────────────────────── */
.lang-wrap {
  position: relative;
  display: flex;
}

.lang-popover {
  position: absolute;
  bottom: calc(100% + 12px);
  right: -10px;
  z-index: 50;
  min-width: 150px;
  padding: 4px;
  background: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  border-radius: 12px;
  box-shadow: 0 10px 25px rgb(0 0 0 / 0.18);
  overflow: hidden;
  transform-origin: bottom right;
  animation: langUp 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes langUp {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lang-popover {
    animation: none;
  }
}

.lang-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 10px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-base-content);
  text-decoration: none;
}

/* Sticky-hover на таче — только для устройств с курсором */
@media (hover: hover) {
  .lang-option:hover {
    background: color-mix(in oklab, var(--color-base-content) 10%, transparent);
  }
}

.lang-option.is-current {
  background: color-mix(in oklab, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
  font-weight: 700;
}

.lang-check {
  font-size: 11px;
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
  /* 600: 11px/500 на тёмной теме визуально «дымится» */
  font-weight: 600;
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
   corporate (светлая): тинт ≈ #a8d2ed — blue-800 (#1e40af) даёт ≈ 6:1;
   business (тёмная): тинт ≈ #304861 — blue-300 (#7cc0ff) даёт ≈ 4.9:1
   (blue-400 #51a2ff после осветления primary — 3.6:1, заменён). */
.nav-item.is-active {
  background-color: color-mix(in oklab, var(--color-primary) 34%, transparent);
  color: var(--color-blue-800, #1e40af);
  font-weight: 600;
}

.nav-item.is-active .nav-icon svg {
  stroke: var(--color-primary);
  stroke-width: 2.5px;
}

/* Иконка активной вкладки — тем же цветом, что и подпись (3:1+ на тинте) */
[data-theme='business'] .nav-item.is-active .nav-icon svg {
  stroke: var(--color-blue-300, #7cc0ff);
}

.nav-item.is-active .nav-label {
  color: var(--color-blue-800, #1e40af);
}

[data-theme='business'] .nav-item.is-active {
  color: var(--color-blue-300, #7cc0ff);
}

[data-theme='business'] .nav-item.is-active .nav-label {
  color: var(--color-blue-300, #7cc0ff);
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

/* ─── Десктоп: футер в DOM (SSR единый), но невидим ──────────
   Брейкпоинт совпадает с useMobileDetection (MOBILE_BREAKPOINT = 768,
   = Tailwind md). CSS-скрытие не участвует в гидратации — без
   hydration mismatch, в отличие от старого v-if="isMobile". */
@media (min-width: 768px) {
  .mobile-nav-footer {
    display: none;
  }
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

//- Страж гидратации: бейджи корзины/избранного и «Профиль/Вход» читают
//- localStorage/сессию — SSR и первый клиентский кадр показывают
//- «пустое» состояние, реальные значения дожимаются после монтирования
const isMounted = ref(false)
onMounted(() => {
  isMounted.value = true
})

// ── Переключатель языка (5-й пункт) ─────────────────────────────
// Локали и ссылки SSR-безопасны (бургер-раздел шапки рендерится так же).
// Закрытие: клик вне .lang-wrap, Escape, смена маршрута.
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const isLangOpen = ref(false)
const toggleLang = () => {
  isLangOpen.value = !isLangOpen.value
}
const closeLang = () => {
  isLangOpen.value = false
}

const onDocClick = (event) => {
  if (isLangOpen.value && !event.target.closest('.lang-wrap')) closeLang()
}
const onKeydown = (event) => {
  if (event.key === 'Escape') closeLang()
}
onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})
watch(
  () => route.path,
  () => closeLang(),
)

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