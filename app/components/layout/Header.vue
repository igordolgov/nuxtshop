<!-- app/components/layout/Header.vue — sticky-шапка: бургер-меню на управляемом
    состоянии (закрытие при навигации/Escape/клике вне), поиск с фильтрами,
    переключение темы, корзина, пользовательское и админское меню. -->
<template lang="pug">
header.navbar.min-h-14.sticky.top-0.z-50.border-b(
  class="bg-base-100/95 backdrop-blur px-3 sm:px-4 lg:px-6 border-base-300"
)
  //- ─── Левая часть: бургер (мобильные) + логотип ─────────────
  .navbar-start.flex-0
    .flex.items-center.gap-1
      //- Бургер-меню: управляемое состояние вместо focus-хака dropdown.
      //- Раньше closeMobileMenu() искал несуществующий чекбокс —
      //- меню не закрывалось после навигации
      .relative(v-if="isMobile" class="mr-1" ref="mobileMenuRef")
        button.btn.btn-ghost.btn-circle(
          type="button"
          :aria-expanded="isMobileMenuOpen"
          aria-controls="mobile-menu"
          aria-label="Открыть меню"
          class="w-11 h-11 min-h-0"
          @click="toggleMobileMenu"
        )
          svg.w-6.h-6(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="text-base-content/70")
            path(stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M4 6h16M4 12h16M4 18h16")

        //- Панель меню. Пункты py-3 = тач-таргет 44px
        ul#mobile-menu.absolute.top-full.left-0.mt-2.z-50(
          v-show="isMobileMenuOpen"
          class="gap-1 bg-base-100 shadow-lg p-2 border border-base-300 rounded-2xl w-60"
        )
          li
            NuxtLink.px-4.py-3.rounded-xl.font-medium.text-sm(
              :class="isActiveRoute('/') ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
              to="/"
              @click="onMenuItemClick"
              prefetch
            ) Главная
          li
            NuxtLink.px-4.py-3.rounded-xl.font-medium.text-sm(
              :class="isActiveRoute('/news') ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
              to="/news"
              @click="onMenuItemClick"
              prefetch
            ) Новости
          li
            NuxtLink.px-4.py-3.rounded-xl.font-medium.text-sm.flex.items-center.justify-between(
              :class="isActiveRoute('/favorites') ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
              to="/favorites"
              @click="onMenuItemClick"
              prefetch
            )
              span Избранное
              span.badge.badge-xs.badge-primary.rounded-full(v-if="favoritesCount > 0")
                | {{ favoritesCount }}
          li
            NuxtLink.px-4.py-3.rounded-xl.font-medium.text-sm(
              :class="isActiveRoute('/about') ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
              to="/about"
              @click="onMenuItemClick"
              prefetch
            ) О нас
          li
            NuxtLink.px-4.py-3.rounded-xl.font-medium.text-sm(
              :class="isActiveRoute('/contacts') ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
              to="/contacts"
              @click="onMenuItemClick"
              prefetch
            ) Контакты

          //- Админка для мобильных
          template(v-if="isAdmin")
            li
              .divider.my-1.text-xs.opacity-50 Админка
            li
              NuxtLink.px-4.py-3.rounded-xl.font-medium.text-sm(
                :class="isExactActiveRoute('/admin/products') ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
                to="/admin/products"
                @click="onMenuItemClick"
                prefetch
              ) Товары
            li
              NuxtLink.px-4.py-3.rounded-xl.font-medium.text-sm(
                :class="isExactActiveRoute('/admin/users') ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
                to="/admin/users"
                @click="onMenuItemClick"
                prefetch
              ) Пользователи

      //- Логотип
      NuxtLink.flex.items-center.gap-2.shrink-0(to="/" class="lg:mr-6" prefetch)
        .bg-primary.rounded-xl.flex.items-center.justify-center.size-8
          span.text-white.font-bold.text-sm М
        span.font-semibold.text-base-content.tracking-tight(v-show="!isHomePageVertical")
          | Магазин

  //- ─── Центр: поиск на мобильных, меню на десктопе ───────────
  .navbar-center.flex-1.min-w-0
    //- Мобильные: поиск + кнопка фильтров (единственный вход в фильтры —
    //- FAB в MainContent удалён)
    .search-and-filters-container.flex.items-center.gap-2.w-full.ml-2(
      v-if="isMobile"
      class="lg:hidden"
    )
      .search-container.flex-1.min-w-0
        SmartSearchInput(
          v-show="isHomePage"
          :products="allProducts"
          :isActive="isHomePage"
          :searchQuery="searchQuery"
          :isSearching="isSearching"
          :showSuggestions="showSuggestions"
          :suggestions="searchSuggestions"
          :hasSuggestions="hasSearchSuggestions"
          :activeSuggestionIndex="activeSuggestionIndex"
          @search="emit('search', $event)"
          @selectProduct="emit('suggestionSelected', $event)"
          @update:searchQuery="emit('update:searchQuery', $event)"
          @suggestionSelected="emit('suggestionSelected', $event)"
          @performSearch="emit('performSearch')"
          @resetSearch="emit('resetSearch')"
          @update:activeSuggestionIndex="emit('update:activeSuggestionIndex', $event)"
          @update:showSuggestions="emit('update:showSuggestions', $event)"
        )

      //- Кнопка мобильных фильтров (тач-таргет 44px)
      button.filters-button(
        v-if="isHomePage"
        type="button"
        :aria-expanded="showFilters"
        aria-label="Фильтры"
        :class="showFilters ? 'active' : ''"
        @click="emit('toggleFilters', !showFilters)"
      )
        .filters-icon
          svg.w-5.h-5(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
            path(stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z")
          .filters-badge(v-if="activeFiltersCount > 0") {{ activeFiltersCount }}

    //- Десктоп: меню навигации
    nav.hidden(class="lg:block")
      ul.flex.items-center.gap-1
        li
          NuxtLink.px-3.py-2.rounded-xl.font-medium.text-sm.transition-colors(
            :class="isActiveRoute('/') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content/80'"
            to="/"
            prefetch
          ) Главная
        li
          NuxtLink.px-3.py-2.rounded-xl.font-medium.text-sm.transition-colors(
            :class="isActiveRoute('/news') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content/80'"
            to="/news"
            prefetch
          ) Новости
        li
          NuxtLink.px-3.py-2.rounded-xl.font-medium.text-sm.transition-colors(
            :class="isActiveRoute('/about') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content/80'"
            to="/about"
            prefetch
          ) О нас
        li
          NuxtLink.px-3.py-2.rounded-xl.font-medium.text-sm.transition-colors(
            :class="isActiveRoute('/contacts') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content/80'"
            to="/contacts"
            prefetch
          ) Контакты

        //- Избранное с бейджем
        li.relative
          NuxtLink.px-3.py-2.rounded-xl.font-medium.text-sm.flex.items-center.gap-1.transition-colors(
            :class="isActiveRoute('/favorites') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content/80'"
            to="/favorites"
          )
            span Избранное
            span.badge.badge-xs.badge-primary.rounded-full(v-if="favoritesCount > 0")
              | {{ favoritesCount }}

        //- Админка (только для админов на десктопе) — aria-expanded,
        //- закрытие по Escape глобальному и клику вне (по ref)
        li.relative(v-if="isAdmin" class="hidden md:block" ref="adminMenuRef")
          button.px-3.py-2.rounded-xl.font-medium.text-sm.flex.items-center.gap-1.transition-colors(
            type="button"
            :aria-expanded="isAdminMenuOpen"
            aria-haspopup="menu"
            :class="isAdminRouteActive || isAdminMenuOpen ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content/80'"
            @click="toggleAdminMenu"
          )
            span Админка
            svg.w-4.h-4.transition-transform(
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              :class="isAdminMenuOpen ? 'rotate-180' : ''"
            )
              path(stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M19 9l-7 7-7-7")

          //- Выпадающее меню админки
          .absolute.top-full.left-0.mt-2.z-50(
            v-show="isAdminMenuOpen"
            class="bg-base-100 shadow-lg border border-base-300 rounded-2xl min-w-48"
          )
            .flex.flex-col.p-2.gap-1
              NuxtLink.flex.items-center.gap-3.px-3.py-2.rounded-xl.text-sm(
                to="/admin"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
              ) Дашборд

              NuxtLink.flex.items-center.gap-3.px-3.py-2.rounded-xl.text-sm(
                to="/admin/products"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin/products') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
                prefetch
              ) Товары

              NuxtLink.flex.items-center.gap-3.px-3.py-2.rounded-xl.text-sm(
                to="/admin/users"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin/users') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
                prefetch
              ) Пользователи

  //- ─── Правая часть: корзина, тема, пользователь ─────────────
  .navbar-end.flex-shrink-0
    .flex.items-center.gap-1(class="lg:gap-2")
      //- Поиск на десктопе
      .search-desktop.hidden(
        v-if="isHomePage"
        class="lg:block lg:flex-1 lg:max-w-md"
      )
        SmartSearchInput(
          :products="allProducts"
          :isActive="true"
          :searchQuery="searchQuery"
          :isSearching="isSearching"
          :showSuggestions="showSuggestions"
          :suggestions="searchSuggestions"
          :hasSuggestions="hasSearchSuggestions"
          :activeSuggestionIndex="activeSuggestionIndex"
          @search="emit('search', $event)"
          @selectProduct="emit('suggestionSelected', $event)"
          @update:searchQuery="emit('update:searchQuery', $event)"
          @suggestionSelected="emit('suggestionSelected', $event)"
          @performSearch="emit('performSearch')"
          @resetSearch="emit('resetSearch')"
          @update:activeSuggestionIndex="emit('update:activeSuggestionIndex', $event)"
          @update:showSuggestions="emit('update:showSuggestions', $event)"
        )

      //- Корзина на десктопе (тач-таргет 44px)
      .indicator(class="hidden lg:block")
        NuxtLink.btn.btn-ghost.btn-circle(
          to="/cart"
          aria-label="Корзина"
          class="w-11 h-11 min-h-0"
        )
          svg.h-5.w-5(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="text-base-content/70" stroke-width="1.75")
            path(stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z")
        span.badge.badge-xs.badge-primary.absolute.top-3.right-2.indicator-item.rounded-full.px-1(
          v-if="cartItemsCount > 0"
        ) {{ cartItemsCount }}

      //- Переключатель тем (тач-таргет 44px)
      button.btn.btn-ghost.btn-circle(
        type="button"
        :title="currentTheme === 'corporate' ? 'Включить тёмную тему' : 'Включить светлую тему'"
        aria-label="Переключить тему"
        class="w-11 h-11 min-h-0"
        @click="toggleTheme"
      )
        svg.w-5.h-5(
          v-if="currentTheme === 'corporate'"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.75"
          class="text-base-content/70"
        )
          path(stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z")
        svg.w-5.h-5(
          v-else
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.75"
          class="text-base-content/70"
        )
          path(stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646A9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z")

      //- Меню пользователя — aria-expanded, закрытие по Escape/клику вне
      .relative.ml-0.flex-shrink-0(v-if="isAuthenticated" ref="userMenuRef")
        button.flex.items-center.gap-2.cursor-pointer.rounded-xl.transition-colors(
          type="button"
          :aria-expanded="isUserMenuOpen"
          aria-haspopup="menu"
          aria-label="Меню пользователя"
          class="hover:bg-base-200 px-2 h-11"
          @click="toggleUserMenu"
        )
          .avatar
            .rounded-full.bg-primary.flex.items-center.justify-center.text-white.font-semibold.size-7.text-xs
              span {{ userInitials }}
          span.font-medium.text-sm(class="hidden sm:block") {{ userName }}
          svg.w-4.h-4.transition-transform(
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            class="text-base-content/50"
            :class="isUserMenuOpen ? 'rotate-180' : ''"
          )
            path(stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M19 9l-7 7-7-7")

        //- Выпадающее меню пользователя
        .absolute.top-full.right-0.mt-2.z-50(
          v-show="isUserMenuOpen"
          class="bg-base-100 shadow-lg border border-base-300 rounded-2xl min-w-56"
        )
          .flex.flex-col.p-2
            //- Информация о пользователе
            .px-3.py-2.border-b.border-base-300.mb-1
              .text-xs.text-base-content.opacity-60.truncate {{ userEmail }}
              .badge.badge-sm.mt-1.rounded-full(
                :class="userRole === 'admin' ? 'badge-primary' : userRole === 'manager' ? 'badge-secondary' : 'badge-accent'"
              )
                | {{ userRole === 'admin' ? 'Администратор' : userRole === 'manager' ? 'Менеджер' : 'Пользователь' }}

            //- Пункты меню (py-2.5 → тач-таргет ~44px)
            button.flex.items-center.gap-3.px-3.py-3.rounded-xl.w-full.text-left.cursor-pointer.text-sm.transition-colors(
              type="button"
              @click="navigateToPath('/user')"
              :class="isExactActiveRoute('/user') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
            )
              span Личный кабинет

            button.flex.items-center.gap-3.px-3.py-3.rounded-xl.w-full.text-left.cursor-pointer.text-sm.transition-colors(
              v-if="isAdmin"
              type="button"
              @click="navigateToPath('/admin/users')"
              :class="isExactActiveRoute('/admin/users') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
            )
              span Управление пользователями

            button.flex.items-center.gap-3.px-3.py-3.rounded-xl.w-full.text-left.cursor-pointer.text-sm.transition-colors(
              type="button"
              @click="navigateToPath('/settings')"
              :class="isExactActiveRoute('/settings') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
            )
              span Настройки

            .divider.my-1

            button.flex.items-center.gap-3.px-3.py-2.rounded-xl.w-full.text-left.cursor-pointer.text-sm.text-error.transition-colors(
              type="button"
              class="hover:bg-error/10"
              @click="handleLogout"
            )
              span Выйти

      //- Кнопка входа (только для неавторизованных, тач-таргет 44px)
      NuxtLink.btn.btn-primary.rounded-xl.ml-1(
        v-else
        to="/auth/login"
        class="min-h-11"
      )
        span Войти
</template>

<style scoped>
/* Safe-area-top: в standalone-PWA контент шапки не прилипает
   к статус-бару (в браузере inset = 0 — ничего не меняется).
   Примечание: при большом inset шапка становится выше 56px —
   sticky-чипы страниц используют --header-height, см. main.css */
.navbar {
  padding-top: var(--safe-area-top, 0px);
}

/* Кнопка фильтров — минималистичный плоский стиль.
   ВАЖНО: --color-* в daisyUI 5 — готовые цвета (oklch), rgb()-обёртка
   делает значение невалидным. Прозрачность — через color-mix() */
.filters-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  background: var(--color-base-200);
  color: var(--color-base-content);
  border: 1px solid var(--color-base-300);
  border-radius: var(--radius-xl, 0.75rem);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background 150ms cubic-bezier(0.4, 0, 0.2, 1),
    border-color 150ms cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  flex-shrink: 0;
  /* Тач-таргет 44px по высоте */
  min-height: 44px;
}

/* Hover — только для устройств с курсором (на таче прилипает) */
@media (hover: hover) {
  .filters-button:hover {
    border-color: color-mix(in oklab, var(--color-primary) 40%, transparent);
  }
}

.filters-button.active {
  background: color-mix(in oklab, var(--color-primary) 12%, transparent);
  border-color: color-mix(in oklab, var(--color-primary) 40%, transparent);
  color: var(--color-primary);
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

/* Контейнеры поиска */
.search-and-filters-container {
  min-width: 0;
}

.search-container {
  min-width: 0;
  flex: 1;
}

nav ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

nav ul li a,
nav ul li button {
  text-decoration: none;
  white-space: nowrap;
}

.search-desktop {
  min-width: 280px;
  max-width: 460px;
  flex: 1;
}

/* Адаптивность */
@media (max-width: 768px) {
  .search-and-filters-container {
    gap: 8px;
  }

  .search-container {
    min-width: 140px;
  }
}

@media (max-width: 480px) {
  .search-container {
    min-width: 100px;
    margin-right: 4px;
  }
}

@media (min-width: 1024px) {
  .navbar-center nav {
    display: block;
  }

  .search-and-filters-container {
    display: none;
  }
}

@media (min-width: 1025px) {
  .filters-button {
    display: none;
  }
}
</style>

<script setup>
//- ============================================
//- Props
//- ============================================
const props = defineProps({
  displayedProductsCount: { type: Number, default: 0 },
  totalProductsCount: { type: Number, default: 0 },
  activeFiltersCount: { type: Number, default: 0 },
  searchQuery: { type: String, default: '' },
  isSearching: { type: Boolean, default: false },
  showSuggestions: { type: Boolean, default: false },
  searchSuggestions: { type: Array, default: () => [] },
  hasSearchSuggestions: { type: Boolean, default: false },
  activeSuggestionIndex: { type: Number, default: -1 },
  showFilters: { type: Boolean, default: false },
})

//- ============================================
//- Emits (полный список — index.vue подключает через v-on="headerEvents")
//- ============================================
const emit = defineEmits([
  'update:searchQuery',
  'suggestionSelected',
  'performSearch',
  'resetSearch',
  'toggleFilters',
  'search',
  'clear-search',
  'update:activeSuggestionIndex',
  'update:showSuggestions',
  'filters-update',
  'sort-update',
  'search-query-update',
  'reset-filters',
])

//- ============================================
//- Composables (SmartSearchInput автоимпортится Nuxt)
//- ============================================
const route = useRoute()
const { $notify } = useNuxtApp()
const { isMobile } = useMobileDetection()
const { favoritesCount } = useFavorites()
const { totalItems } = useCart()
const appState = useAppState()

//- ============================================
//- Состояние меню — всё управляемое (ref), никаких focus-хаков
//- ============================================
const isMobileMenuOpen = ref(false)
const isAdminMenuOpen = ref(false)
const isUserMenuOpen = ref(false)

//- Refs контейнеров — для закрытия по клику вне (раньше были
//- хрупкие closest('li.relative')/closest('.relative'))
const mobileMenuRef = ref(null)
const adminMenuRef = ref(null)
const userMenuRef = ref(null)

// Зеркало текущей темы для иконки/титула кнопки.
// Инлайн-скрипт в <head> выставляет data-theme до первой отрисовки
const currentTheme = ref('corporate')

//- ============================================
//- Вычисляемые свойства
//- ============================================
const isHomePage = computed(() => route.path === '/')
const isHomePageVertical = computed(() => isHomePage.value && isMobile.value)
const user = computed(() => appState.user?.value)
const isAuthenticated = computed(() => appState.isAuthenticated?.value)
const isAdmin = computed(() => appState.isAdmin?.value)
const allProducts = computed(() => appState.products?.value || [])
const cartItemsCount = computed(() => totalItems.value)

const userInitials = computed(() => {
  if (!user.value?.name) return 'U'
  return user.value.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const userName = computed(() => user.value?.name || 'Пользователь')
const userEmail = computed(() => user.value?.email || '')
const userRole = computed(() => user.value?.role || 'user')
const isAdminRouteActive = computed(() => route.path.startsWith('/admin'))

//- ============================================
//- Функции маршрутизации
//- ============================================
const isActiveRoute = (path) => route.path === path || route.path.startsWith(path + '/')
const isExactActiveRoute = (path) => route.path === path

//- ============================================
//- Функции меню
//- ============================================
const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

const closeAdminMenu = () => {
  isAdminMenuOpen.value = false
}

const closeUserMenu = () => {
  isUserMenuOpen.value = false
}

const closeAllMenus = () => {
  closeMobileMenu()
  closeAdminMenu()
  closeUserMenu()
}

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
  if (isMobileMenuOpen.value) {
    closeAdminMenu()
    closeUserMenu()
  }
}

const toggleAdminMenu = () => {
  isAdminMenuOpen.value = !isAdminMenuOpen.value
  if (isAdminMenuOpen.value) {
    closeUserMenu()
    closeMobileMenu()
  }
}

const toggleUserMenu = () => {
  isUserMenuOpen.value = !isUserMenuOpen.value
  if (isUserMenuOpen.value) {
    closeAdminMenu()
    closeMobileMenu()
  }
}

//- Клик по пункту бургер-меню: закрыть меню (переход сделает NuxtLink)
const onMenuItemClick = () => closeAllMenus()

const navigateToPath = async (path) => {
  closeAllMenus()
  await navigateTo(path)
}

//- ============================================
//- Переключение темы.
//- Имена тем строго corporate/business — их же читает инлайн-скрипт
//- ============================================
const toggleTheme = () => {
  if (!import.meta.client) return
  currentTheme.value = currentTheme.value === 'corporate' ? 'business' : 'corporate'
  document.documentElement.setAttribute('data-theme', currentTheme.value)
  localStorage.setItem('theme', currentTheme.value)
}

//- ============================================
//- Выход
//- ============================================
const handleLogout = async () => {
  closeAllMenus()

  const result = await appState.logout()
  if (result.success) {
    $notify.success('Вы успешно вышли из системы')
    await navigateTo('/')
  }
}

//- ============================================
//- Глобальные слушатели: клик вне (по refs) + Escape
//- ============================================
const closeMenusOnClickOutside = (event) => {
  if (!import.meta.client) return
  const target = event.target
  if (isMobileMenuOpen.value && !mobileMenuRef.value?.contains(target)) closeMobileMenu()
  if (isAdminMenuOpen.value && !adminMenuRef.value?.contains(target)) closeAdminMenu()
  if (isUserMenuOpen.value && !userMenuRef.value?.contains(target)) closeUserMenu()
}

const onGlobalKeydown = (event) => {
  if (event.key === 'Escape') closeAllMenus()
}

//- ============================================
//- Lifecycle
//- ============================================
onMounted(() => {
  if (!import.meta.client) return
  // data-theme уже выставлен инлайн-скриптом — синхронизируем кнопку темы
  const applied = document.documentElement.getAttribute('data-theme')
  currentTheme.value = applied === 'business' ? 'business' : 'corporate'

  document.addEventListener('click', closeMenusOnClickOutside)
  document.addEventListener('keydown', onGlobalKeydown)
})

onUnmounted(() => {
  if (!import.meta.client) return
  document.removeEventListener('click', closeMenusOnClickOutside)
  document.removeEventListener('keydown', onGlobalKeydown)
})

//- Закрытие всех меню при любом переходе (раньше не работало:
//- closeMobileMenu искала несуществующий чекбокс)
watch(
  () => route.path,
  () => closeAllMenus(),
)

//- Ушли в десктопный режим — мобильное меню не должно висеть открытым
watch(isMobile, (mobile) => {
  if (!mobile) closeMobileMenu()
})
</script>