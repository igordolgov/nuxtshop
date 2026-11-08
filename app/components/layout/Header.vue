<!-- app/components/layout/Header.vue — шапка по паттерну маркетплейсов.
    Мобильные (<1024px) — ДВЕ строки всегда (и в landscape):
      строка 1: бургер + логотип … тема + профиль
      строка 2: поиск на всю ширину (+ «Фильтры» на главной)
    Десктоп (≥1024px) — одна строка: лого · меню · поиск · действия.
    Поиск ГЛОБАЛЬНЫЙ: состояние из appState.search напрямую. -->
<template lang="pug">
header.app-header.sticky.top-0.z-50.border-b(
  class="bg-base-100 border-base-300"
)
  //- ═══ Строка 1: навигация и действия ═══
  .flex.items-center.justify-between.gap-2(class="px-0 lg:px-6 h-14")
    //- Левая группа: бургер (моб) + логотип
    .flex.items-center.gap-1.min-w-0
      //- Бургер-меню: рендерится ВСЕГДА (и в SSR-HTML), на десктопе его
      //- прячет CSS (lg:hidden = ≥1024px — брейкпоинт самой шапки).
      //- Раньше v-if="isMobile" держал бургер вне серверного HTML:
      //- навигация появлялась только после гидратации, раскладка
      //- перестраивалась (SEO-аудит «Часть контента»). Бонус: на
      //- планшетах 768-1023px меню теперь доступно (раньше не было
      //- ни бургера, ни десктоп-меню — они включались с 1024px)
      .relative(class="lg:hidden" ref="mobileMenuRef")
        //- data-fly-compare — приёмник «синей точки» сравнения
        //- (см. app/utils/compareFly.ts)
        button.btn.btn-ghost.btn-circle.relative(
          type="button"
          :aria-expanded="isMobileMenuOpen"
          aria-controls="mobile-menu"
          :aria-label="$t('header.openMenu')"
          class="w-11 h-11 min-h-0"
          data-fly-compare
          @click="toggleMobileMenu"
        )
          svg.w-6.h-6(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="text-base-content/85")
            path(stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M4 6h16M4 12h16M4 18h16")
          //- Бейдж-счётчик сравнения: сюда прилетает точка, бейдж мягко пульсирует,
          //- после прилёта мигает (is-blinking вешается на ~1.5 с)
          span.burger-compare-badge(
            v-if="compareCount > 0"
            :key="compareCount"
            :class="{ 'is-blinking': burgerBlink }"
            aria-hidden="true"
          ) {{ compareCount }}

        //- Меню вынесено в HeaderMobileMenu.vue: панель, каскад пунктов,
        //- замер прокрутки и стили живут в нём; состояние открытия — здесь
        HeaderMobileMenu(
          :open="isMobileMenuOpen"
          :user-name="userName"
          :is-authenticated="isAuthenticated"
          :is-admin="isAdmin"
          :is-staff="isManager"
          @item-click="onMenuItemClick"
        )
      //- Логотип (текст виден всегда — двухстрочной шапке хватает места)
      NuxtLink.flex.items-center.gap-2.shrink-0(:to="localePath('/')" prefetch)
        .bg-primary.rounded-xl.flex.items-center.justify-center.size-8
          span.text-primary-content.font-bold.text-sm {{ $t('nav.brandInitial') }}
        span.font-semibold.text-base-content.tracking-tight {{ $t('nav.brand') }}

    //- Десктоп-меню (центр строки 1)
    nav.hidden(class="lg:block")
      ul.flex.items-center.gap-1
        li
          NuxtLink.px-3.py-2.rounded-xl.font-semibold.text-sm.transition-colors(
            :class="isActiveRoute('/') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content/90'"
            :to="localePath('/')"
            prefetch
          ) {{ $t('nav.home') }}
        li
          NuxtLink.px-3.py-2.rounded-xl.font-semibold.text-sm.transition-colors(
            :class="isActiveRoute('/news') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content/90'"
            :to="localePath('/news')"
            prefetch
          ) {{ $t('nav.news') }}
        li
          NuxtLink.px-3.py-2.rounded-xl.font-semibold.text-sm.transition-colors(
            :class="isActiveRoute('/about') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content/90'"
            :to="localePath('/about')"
            prefetch
          ) {{ $t('nav.about') }}
        li
          NuxtLink.px-3.py-2.rounded-xl.font-semibold.text-sm.transition-colors(
            :class="isActiveRoute('/contacts') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content/90'"
            :to="localePath('/contacts')"
            prefetch
          ) {{ $t('nav.contacts') }}
        li.relative
          NuxtLink.px-3.py-2.rounded-xl.font-semibold.text-sm.flex.items-center.gap-2.transition-colors(
            :class="isActiveRoute('/favorites') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content/90'"
            :to="localePath('/favorites')"
          )
            span {{ $t('nav.favorites') }}
            span.badge.badge-xs.badge-primary.rounded-full.count-pop(v-if="favoritesCount > 0" :key="favoritesCount")
              | {{ favoritesCount }}
        li.relative
          //- data-fly-compare: на десктопе бургер скрыт, точка летит сюда
          NuxtLink.px-3.py-2.rounded-xl.font-semibold.text-sm.flex.items-center.gap-2.transition-colors(
            :class="isActiveRoute('/compare') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content/90'"
            :to="localePath('/compare')"
            data-fly-compare
          )
            span {{ $t('nav.compare') }}
            span.badge.badge-xs.badge-primary.rounded-full.count-pop(v-if="compareCount > 0" :key="compareCount")
              | {{ compareCount }}
        li.relative(v-if="isManager" ref="adminMenuRef")
          button.px-3.py-2.rounded-xl.font-semibold.text-sm.flex.items-center.gap-1.transition-colors(
            type="button"
            :aria-expanded="isAdminMenuOpen"
            aria-haspopup="menu"
            :class="isAdminRouteActive || isAdminMenuOpen ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content/90'"
            @click="toggleAdminMenu"
          )
            span {{ $t('nav.admin') }}
            svg.w-4.h-4.transition-transform(
              xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" :class="isAdminMenuOpen ? 'rotate-180' : ''"
            )
              path(stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M19 9l-7 7-7-7")

          .absolute.top-full.left-0.mt-2.z-50(
            v-show="isAdminMenuOpen"
            class="bg-base-100 shadow-lg border border-base-300 rounded-2xl min-w-48"
          )
            .flex.flex-col.p-2.gap-1
              NuxtLink.flex.items-center.gap-3.px-3.py-2.rounded-xl.text-sm(
                :to="localePath(\'/admin\')"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
              ) {{ $t('nav.dashboard') }}
              NuxtLink.flex.items-center.gap-3.px-3.py-2.rounded-xl.text-sm(
                :to="localePath(\'/admin/products\')"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin/products') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
                prefetch
              ) {{ $t('nav.products') }}
              NuxtLink.flex.items-center.gap-3.px-3.py-2.rounded-xl.text-sm(
                :to="localePath(\'/admin/orders\')"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin/orders') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
                prefetch
              ) {{ $t('nav.orders') }}
              NuxtLink.flex.items-center.gap-3.px-3.py-2.rounded-xl.text-sm(
                v-if="isAdmin"
                :to="localePath(\'/admin/news\')"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin/news') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
                prefetch
              ) {{ $t('nav.news') }}
              NuxtLink.flex.items-center.gap-3.px-3.py-2.rounded-xl.text-sm(
                v-if="isAdmin"
                :to="localePath(\'/admin/content\')"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin/content') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
                prefetch
              ) {{ $t('nav.content') }}
              NuxtLink.flex.items-center.gap-3.px-3.py-2.rounded-xl.text-sm(
                :to="localePath(\'/admin/reviews\')"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin/reviews') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
                prefetch
              ) {{ $t('nav.reviews') }}
              NuxtLink.flex.items-center.gap-3.px-3.py-2.rounded-xl.text-sm(
                v-if="isAdmin"
                :to="localePath(\'/admin/promocodes\')"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin/promocodes') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
                prefetch
              ) {{ $t('nav.promocodes') }}
              NuxtLink.flex.items-center.gap-3.px-3.py-2.rounded-xl.text-sm(
                v-if="isAdmin"
                :to="localePath(\'/admin/users\')"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin/users') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
                prefetch
              ) {{ $t('nav.users') }}

    //- Правая группа: поиск (десктоп) · корзина (десктоп) · тема · профиль
    .flex.items-center.gap-1.shrink-0(class="lg:gap-2")
      //- Поиск — только десктоп (на мобильных строка 2). На админ-страницах
      //- скрыт: там свой поиск по каталогу, витринный только путает.
      //- На карточке товара тоже скрыт: поиск — иконка в действиях
      //- карточки (ProductInfo), открывает полноэкранный ProductSearchOverlay
      .search-desktop.hidden(class="md:block lg:w-64 xl:w-80" v-if="!isAdminRoute && !isProductRoute")
        SmartSearchInput(
          :products="allProducts"
          :isActive="true"
          :searchQuery="searchQuery"
          :isSearching="isSearching"
          :showSuggestions="showSuggestions"
          :suggestions="searchSuggestions"
          :hasSuggestions="hasSearchSuggestions"
          :activeSuggestionIndex="activeSuggestionIndex"
          @search="onSearch"
          @selectProduct="onSuggestionSelected"
          @update:searchQuery="onSearchQueryUpdate"
          @suggestionSelected="onSuggestionSelected"
          @performSearch="onPerformSearch"
          @resetSearch="onResetSearch"
          @update:activeSuggestionIndex="onActiveSuggestionIndex"
          @update:showSuggestions="onShowSuggestions"
        )

      //- Корзина — десктоп (на мобильных нижнее меню)
      .indicator.hidden(class="lg:block")
        NuxtLink.btn.btn-ghost.btn-circle(:to="localePath('/cart')" :aria-label="$t('nav.cart')" class="w-11 h-11 min-h-0")
          svg.h-5.w-5(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="text-base-content/85" stroke-width="1.75")
            path(stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z")
        span.badge.badge-xs.badge-primary.absolute.top-2.right-2.indicator-item.rounded-full.px-1.count-pop(
          v-if="cartItemsCount > 0"
          :key="cartItemsCount"
        ) {{ cartItemsCount }}

      //- Переключатель языка — на десктопе (на мобильных — раздел «Язык» в бургер-меню)
      .hidden(class="lg:block")
        LocaleSwitcher

      //- Тема
      button.btn.btn-ghost.btn-circle(
        type="button"
        :title="currentTheme === 'corporate' ? $t('header.enableDark') : $t('header.enableLight')"
        :aria-label="$t('header.toggleThemeAria')"
        class="w-11 h-11 min-h-0"
        @click="toggleTheme"
      )
        svg.w-5.h-5(
          v-if="currentTheme === 'corporate'"
          xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" stroke-width="1.75" class="text-base-content/85"
        )
          path(stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z")
        svg.w-5.h-5(
          v-else
          xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" stroke-width="1.75" class="text-base-content/85"
        )
          path(stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646A9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z")

      //- Меню пользователя вынесено в HeaderUserMenu.vue: открытие,
      //- клик-аутсайд, выход — внутри; неавторизованным — кнопка входа (v-else)
      HeaderUserMenu(v-if="isAuthenticated" :is-admin="isAdmin")
      //- Кнопка входа (неавторизованные)
      NuxtLink.btn.btn-primary.mr-3.rounded-xl(
        v-else
        :to="localePath('/auth/login')"
        class="min-h-11"
      )
        span {{ $t('header.login') }}

  //- ═══ Строка 2 (только мобильные): поиск на всю ширину ═══
  //- На карточке товара строки нет — шапка однострочная (--header-height
  //- 56px через html[data-header-compact], ставит страница /product/**)
  .px-3.pb-2(class="md:hidden" v-if="!isAdminRoute && !isProductRoute")
    .flex.items-center.gap-2
      .flex-1.min-w-0
        SmartSearchInput(
          :products="allProducts"
          :isActive="true"
          :searchQuery="searchQuery"
          :isSearching="isSearching"
          :showSuggestions="showSuggestions"
          :suggestions="searchSuggestions"
          :hasSuggestions="hasSearchSuggestions"
          :activeSuggestionIndex="activeSuggestionIndex"
          @search="onSearch"
          @selectProduct="onSuggestionSelected"
          @update:searchQuery="onSearchQueryUpdate"
          @suggestionSelected="onSuggestionSelected"
          @performSearch="onPerformSearch"
          @resetSearch="onResetSearch"
          @update:activeSuggestionIndex="onActiveSuggestionIndex"
          @update:showSuggestions="onShowSuggestions"
        )
</template>
<style scoped>
/* Шапка: safe-area для standalone-PWA (статус-бар не перекрывает).
   translateZ(0) — свой композитинг-слой: при инерционной прокрутке
   шапка — готовый GPU-слой, и контент страницы не мелькает сквозь её
   нижний край (артефакт «строка контента над шапкой» на телефонах).
   Меню в шапке absolute — transform на предке ему не мешает */
.app-header {
  padding-top: var(--safe-area-top, 0px);
  transform: translateZ(0);
}

.filters-icon {
  display: flex;
  align-items: center;
  position: relative;
}

.filters-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  border: 2px solid var(--color-base-100);
}

/* ─── Бейдж сравнения на бургер-кнопке («синяя точка») ──────────────
   Жёстко привязан к кнопке (absolute), не перекрывает тапы.
   Пока в сравнении есть товары — мягко «дышит» (badgePulse),
   после прилёта летевшей точки — мигает (is-blinking на ~1.5 с). */
.burger-compare-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 9999px;
  background: var(--color-primary);
  color: var(--color-primary-content, #fff);
  border: 2px solid var(--color-base-100);
  font-size: 10px;
  line-height: 1;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  pointer-events: none;
  /* badgeIn — упругий «поп» при изменении счётчика (remount через :key);
     badgePulse — мягкое «дыхание» после, с задержкой в конец badgeIn */
  animation:
    badgeIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    badgePulse 1.8s ease-in-out 0.35s infinite;
}

@keyframes badgeIn {
  0% { transform: scale(0.3); }
  60% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

@keyframes badgePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.22); }
}
.burger-compare-badge.is-blinking {
  animation: badgeBlink 0.45s ease-in-out 3;
}

@keyframes badgeBlink {
  0%, 100% { transform: scale(1.2); opacity: 1; }
  50% { transform: scale(0.8); opacity: 0.45; }
}

@media (prefers-reduced-motion: reduce) {
  .burger-compare-badge,
  .burger-compare-badge.is-blinking { animation: none; }
}
</style>
<script setup>
const route = useRoute()
const { t } = useI18n()

// Активные пункты меню — общая логика с нижней навигацией (useActiveRoute):
// сравнение с локализованным путём, корень ('/') на /en и /es подсвечивается
// только по точному совпадению (детали и причины — в useActiveRoute.js)
const { isActiveRoute, isExactActiveRoute } = useActiveRoute()
const localePath = useLocalePath()

//- Витринный поиск в шапке не показываем на /admin/*: на админ-страницах
//- свой поиск (например, в списке товаров), глобальный только дублирует.
//- Сравнение через isActiveRoute: сырой startsWith('/admin') на /en и /es
//- не ловит '/en/admin/...' (префикс локали)
const isAdminRoute = computed(() => isActiveRoute('/admin'))

//- На карточке товара поиск в шапке не нужен: иконка поиска стоит в
//- действиях карточки (перед «Сравнить»/«Избранное») и открывает
//- полноэкранный ProductSearchOverlay — как у крупных маркетплейсов
const isProductRoute = computed(() => isActiveRoute('/product'))

const { isMobile } = useMobileDetection()
const { favoritesCount } = useFavorites()
const { compareCount } = useCompare()
const { totalItems } = useCart()
const appState = useAppState()

//- ============================================
//- ГЛОБАЛЬНЫЙ ПОИСК: состояние из appState.search
//- ============================================
const searchQuery = computed(() => appState.search?.query?.value ?? '')
const isSearching = computed(() => appState.search?.isSearching?.value ?? false)
const showSuggestions = computed(() => appState.search?.showSuggestions?.value ?? false)
const searchSuggestions = computed(() => appState.search?.suggestions?.value ?? [])
const hasSearchSuggestions = computed(() => appState.search?.hasSuggestions?.value ?? false)
const activeSuggestionIndex = computed(() => appState.search?.activeSuggestionIndex?.value ?? -1)
const allProducts = computed(() => appState.products?.value || [])

//- Ленивая загрузка товаров для подсказок на «чужих» страницах
watch(searchQuery, (q) => {
  if (q && !allProducts.value.length && import.meta.client) {
    appState.loadProducts?.()
  }
})

const onSearchQueryUpdate = (q) => appState.setSearchQuery?.(q)
const onSearch = (q) => appState.setSearchQuery?.(q)

//- Enter: с чужой страницы → каталог с запросом; на главной — штатно.
//- localePath({ path, query }): сырой path:'/' на /en и /es вёл на
//- русскую главную (strategy prefix_except_default) — префикс локали терялся
const onPerformSearch = () => {
  const q = searchQuery.value?.trim()
  if (!isHomePage.value && q) {
    navigateTo(localePath({ path: '/', query: { search: q } }))
    return
  }
  appState.search?.performSearch?.()
}

//- Подсказка → карточка товара + сброс поиска
const onSuggestionSelected = async (item) => {
  if (!item) return
  await navigateTo(`/product/${item.id}`)
  appState.search?.resetSearch?.()
}

const onResetSearch = () => appState.search?.resetSearch?.()

const onActiveSuggestionIndex = (i) => {
  if (appState.search?.activeSuggestionIndex) {
    appState.search.activeSuggestionIndex.value = i
  }
}

const onShowSuggestions = (v) => {
  if (appState.search?.showSuggestions) {
    appState.search.showSuggestions.value = v
  }
}

//- UI-эффекты шапки — useHeaderUi.ts: полёт «синей точки» сравнения, тема
const { burgerBlink } = useCompareFlyBadge()
const { currentTheme, toggleTheme } = useHeaderTheme()

//- ============================================
//- Меню (управляемое состояние). Меню профиля — в HeaderUserMenu.vue:
//- оно само закрывается по клику мимо, Escape и смене маршрута.
//- ============================================
const isMobileMenuOpen = ref(false)
const isAdminMenuOpen = ref(false)

const mobileMenuRef = ref(null)
const adminMenuRef = ref(null)

const isHomePage = computed(() => route.path === localePath('/'))
const user = computed(() => appState.user?.value)
const isAuthenticated = computed(() => appState.isAuthenticated?.value)
const isAdmin = computed(() => appState.isAdmin?.value)
//- isManager из useAuth — staff-семантика (manager ИЛИ admin): дропдаун
//- «Админ» виден менеджеру, но админ--only пункты (новости, контент,
//- промокоды, пользователи) остаются скрытыми (v-if="isAdmin")
const isManager = computed(() => appState.isManager?.value)
const cartItemsCount = computed(() => totalItems.value)
const userName = computed(() => user.value?.name || t('header.defaultUserName'))
//- Подсветка «Админ» в мобильном меню — тот же локализованный предикат,
//- что и у isAdminRoute (сырой startsWith('/admin') молчал на /en и /es)
const isAdminRouteActive = computed(() => isActiveRoute('/admin'))

const closeMobileMenu = () => { isMobileMenuOpen.value = false }
const closeAdminMenu = () => { isAdminMenuOpen.value = false }
const closeAllMenus = () => { closeMobileMenu(); closeAdminMenu() }

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
  if (isMobileMenuOpen.value) { closeAdminMenu() }
}

const toggleAdminMenu = () => {
  isAdminMenuOpen.value = !isAdminMenuOpen.value
  if (isAdminMenuOpen.value) { closeMobileMenu() }
}

const onMenuItemClick = () => closeAllMenus()

const closeMenusOnClickOutside = (event) => {
  if (!import.meta.client) return
  const target = event.target
  if (isMobileMenuOpen.value && !mobileMenuRef.value?.contains(target)) closeMobileMenu()
  if (isAdminMenuOpen.value && !adminMenuRef.value?.contains(target)) closeAdminMenu()
}

const onGlobalKeydown = (event) => {
  if (event.key === 'Escape') closeAllMenus()
}

onMounted(() => {
  if (!import.meta.client) return
  document.addEventListener('click', closeMenusOnClickOutside)
  document.addEventListener('keydown', onGlobalKeydown)
})

onUnmounted(() => {
  if (!import.meta.client) return
  document.removeEventListener('click', closeMenusOnClickOutside)
  document.removeEventListener('keydown', onGlobalKeydown)
})

watch(() => route.path, () => closeAllMenus())

watch(isMobile, (mobile) => {
  if (!mobile) closeMobileMenu()
})
</script>
