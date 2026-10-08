<!-- app/components/layout/Header.vue -->
<template lang="pug">
header.navbar.min-h-14.backdrop-blur.sticky.top-0.z-50.border-b(
  class="bg-base-100/95 px-3 sm:px-4 lg:px-6 border-base-300"
)
  //- Начало: логотип и бургер-меню на мобильных
  .navbar-start.flex-0
    .flex.items-center.gap-1
      //- Бургер меню для мобильных
      .dropdown.dropdown-end.relative(v-if="isMobile" class="mr-1")
        label.btn.btn-ghost.btn-circle.btn-sm(
          tabindex="0"
        )
          svg.w-5.h-5(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="text-base-content/70")
            path(stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M4 6h16M4 12h16M4 18h16")
        ul.dropdown-content.menu.p-2.gap-1.shadow-lg.bg-base-100.rounded-2xl.w-60.z-50.border(
          class="-left-2 mt-3 border-base-300"
          tabindex="0"
        )
          li
            NuxtLink.px-4.py-2.rounded-xl.font-medium.text-sm(
              :class="isActiveRoute('/') ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
              to="/"
              @click="closeMobileMenu"
              prefetch
            ) Главная
          li
            NuxtLink.px-4.py-2.rounded-xl.font-medium.text-sm(
              :class="isActiveRoute('/news') ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
              to="/news"
              @click="closeMobileMenu"
              prefetch
            ) Новости
          li
            NuxtLink.px-4.py-2.rounded-xl.font-medium.text-sm(
              :class="isActiveRoute('/about') ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
              to="/about"
              @click="closeMobileMenu"
              prefetch
            ) О нас
          li
            NuxtLink.px-4.py-2.rounded-xl.font-medium.text-sm(
              :class="isActiveRoute('/contacts') ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
              to="/contacts"
              @click="closeMobileMenu"
              prefetch
            ) Контакты

          //- Админка для мобильных
          template(v-if="isAdmin")
            li
              .divider.my-1.text-xs.opacity-50 Админка
            li
              NuxtLink.px-4.py-2.rounded-xl.font-medium.text-sm(
                :class="isExactActiveRoute('/admin/products') ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
                to="/admin/products"
                @click="closeMobileMenu"
                prefetch
              ) Товары
            li
              NuxtLink.px-4.py-2.rounded-xl.font-medium.text-sm(
                :class="isExactActiveRoute('/admin/users') ? 'bg-primary text-primary-content' : 'hover:bg-base-200'"
                to="/admin/users"
                @click="closeMobileMenu"
                prefetch
              ) Пользователи

      //- Логотип
      NuxtLink.flex.items-center.gap-2.shrink-0(to="/" class="lg:mr-6" prefetch)
        .bg-primary.rounded-xl.flex.items-center.justify-center.size-8
          span.text-white.font-bold.text-sm М
        span.font-semibold.text-base-content.tracking-tight(v-show="!isHomePageVertical") Магазин

  //- Центр: поиск на мобильных, меню на десктопе
  .navbar-center.flex-1.min-w-0
    //- Мобильные: поиск
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

      //- Кнопка мобильных фильтров
      button.filters-button(
        v-if="isHomePage"
        @click="emit('toggleFilters', !showFilters)"
        type="button"
        :class="showFilters ? 'active' : ''"
      )
        .filters-icon
          svg.w-5.h-5(
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          )
            path(
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.75"
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            )
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

        //- Пункт "Избранное" с бейджем
        li.relative
          NuxtLink.px-3.py-2.rounded-xl.font-medium.text-sm.flex.items-center.gap-2.transition-colors(
            :class="isActiveRoute('/favorites') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content/80'"
            to="/favorites"
          )
            span Избранное
            span.badge.badge-xs.badge-primary.rounded-full(
              v-if="favoritesCount > 0"
            ) {{ favoritesCount }}

        //- Админка (только для админов на десктопе)
        li.relative(v-if="isAdmin" class="hidden md:block")
          button.px-3.py-2.rounded-xl.font-medium.text-sm.flex.items-center.gap-1.transition-colors(
            :class="isAdminRouteActive || isAdminMenuOpen ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content/80'"
            @click="toggleAdminMenu"
            @keydown.enter="toggleAdminMenu"
            @keydown.space="toggleAdminMenu"
            @keydown.escape="closeAdminMenu"
            tabindex="0"
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
          .absolute.top-full.left-0.mt-2.bg-base-100.rounded-2xl.shadow-lg.border.z-50(
            v-show="isAdminMenuOpen"
            class="border-base-300 min-w-48"
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

  //- Конец: элементы управления
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

      //- Корзина на десктопе
      .indicator(class="hidden lg:block")
        NuxtLink.btn.btn-ghost.btn-circle.btn-sm(
          to="/cart"
        )
          svg.h-5.w-5(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="text-base-content/70" stroke-width="1.75")
            path(stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z")
        span.badge.badge-xs.badge-primary.absolute.top-0.right-0.indicator-item.rounded-full.px-1(
          v-if="cartItemsCount > 0"
        ) {{ cartItemsCount }}

      //- Переключатель тем
      button.btn.btn-ghost.btn-circle.btn-sm(
        @click="toggleTheme"
        :title="currentTheme === 'corporate' ? 'Включить тёмную тему' : 'Включить светлую тему'"
        aria-label="Переключить тему"
      )
        svg.w-4.h-4(
          v-if="currentTheme === 'corporate'"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.75"
          class="text-base-content/70"
        )
          path(stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z")
        svg.w-4.h-4(
          v-else
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="1.75"
          class="text-base-content/70"
        )
          path(stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646A9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z")

      //- Меню пользователя
      .relative.ml-0.flex-shrink-0(v-if="isAuthenticated")
        button.flex.items-center.gap-2.cursor-pointer.rounded-xl.px-2.py-2.transition-colors(
          class="hover:bg-base-200"
          @click="toggleUserMenu"
          @keydown.enter="toggleUserMenu"
          @keydown.space="toggleUserMenu"
          @keydown.escape="closeUserMenu"
          tabindex="0"
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
        .absolute.top-full.right-0.mt-2.bg-base-100.rounded-2xl.shadow-lg.border.z-50(
          v-show="isUserMenuOpen"
          class="border-base-300 min-w-56"
        )
          .flex.flex-col.p-2
            //- Информация о пользователе
            .px-3.py-2.border-b.border-base-300.mb-1
              .text-xs.text-base-content.opacity-60.truncate {{ userEmail }}
              .badge.badge-sm.mt-1.rounded-full(
                :class="userRole === 'admin' ? 'badge-primary' : userRole === 'manager' ? 'badge-secondary' : 'badge-accent'"
              )
                | {{ userRole === 'admin' ? 'Администратор' : userRole === 'manager' ? 'Менеджер' : 'Пользователь' }}

            //- Пункты меню
            button.flex.items-center.gap-3.px-3.py-2.rounded-xl.w-full.text-left.cursor-pointer.text-sm.transition-colors(
              @click="navigateToPath('/user')"
              :class="isExactActiveRoute('/user') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
            )
              span Личный кабинет

            //- Управление пользователями только для админов
            button.flex.items-center.gap-3.px-3.py-2.rounded-xl.w-full.text-left.cursor-pointer.text-sm.transition-colors(
              v-if="isAdmin"
              @click="navigateToPath('/admin/users')"
              :class="isExactActiveRoute('/admin/users') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
            )
              span Управление пользователями

            button.flex.items-center.gap-3.px-3.py-2.rounded-xl.w-full.text-left.cursor-pointer.text-sm.transition-colors(
              @click="navigateToPath('/settings')"
              :class="isExactActiveRoute('/settings') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
            )
              span Настройки

            .divider.my-1

            button.flex.items-center.gap-3.px-3.py-2.rounded-xl.w-full.text-left.cursor-pointer.text-sm.text-error.transition-colors(
              @click="handleLogout"
              class="hover:bg-error/10"
            )
              span Выйти

      //- Кнопка входа (только для неавторизованных)
      NuxtLink.btn.btn-primary.btn-sm.rounded-xl.ml-1(
        v-else
        to="/auth/login"
      )
        span Войти
</template>

<style scoped>
/* Плавные переходы для меню */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Кнопка фильтров — минималистичный плоский стиль.
   ВАЖНО: --color-* в daisyUI 5 — готовые цвета (oklch), rgb()-обёртка
   делает значение невалидным. Прозрачность — через color-mix(). */
.filters-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--color-base-200);
  color: var(--color-base-content);
  border: 1px solid var(--color-base-300);
  border-radius: var(--radius-xl, 0.75rem);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background 150ms cubic-bezier(0.4, 0, 0.2, 1),
    border-color 150ms cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  flex-shrink: 0;
}

.filters-button:hover {
  border-color: color-mix(in oklab, var(--color-primary) 40%, transparent);
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

  .navbar-start .dropdown {
    display: none;
  }
}

.dropdown.dropdown-end .dropdown-content {
  position: absolute;
  left: 0;
  right: auto;
  min-width: 240px;
}

@media (max-width: 768px) {
  .dropdown.dropdown-end .dropdown-content {
    left: -8px;
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
  showFilters: { type: Boolean, default: false }
})

//- ============================================
//- Emits
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
  'reset-filters'
])

//- ============================================
//- Imports
//- ============================================
import SmartSearchInput from '~/components/products/SmartSearchInput.vue'

//- ============================================
//- Composables
//- ============================================
const route = useRoute()
const { $notify } = useNuxtApp()
const { isMobile } = useMobileDetection()
const { favoritesCount } = useFavorites()
const { totalItems } = useCart()
const appState = useAppState()

//- ============================================
//- Состояние
//- ============================================
// Инлайн-скрипт в <head> выставляет data-theme до первой отрисовки;
// здесь только зеркало текущего значения для иконки/титула кнопки
const currentTheme = ref('corporate')
const isAdminMenuOpen = ref(false)
const isUserMenuOpen = ref(false)

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
  return user.value.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
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
const toggleAdminMenu = () => {
  isAdminMenuOpen.value = !isAdminMenuOpen.value
  if (isAdminMenuOpen.value) isUserMenuOpen.value = false
}

const closeAdminMenu = () => {
  isAdminMenuOpen.value = false
}

const toggleUserMenu = () => {
  isUserMenuOpen.value = !isUserMenuOpen.value
  if (isUserMenuOpen.value) isAdminMenuOpen.value = false
}

const closeUserMenu = () => {
  isUserMenuOpen.value = false
}

const closeMobileMenu = () => {
  if (import.meta.client) {
    const dropdown = document.querySelector('.dropdown input[type="checkbox"]')
    if (dropdown) dropdown.checked = false
  }
}

const navigateToPath = async (path) => {
  closeAdminMenu()
  closeUserMenu()
  closeMobileMenu()
  await navigateTo(path)
}

//- ============================================
//- Переключение темы
//- Имена тем строго corporate/business — они же в localStorage,
//- их же читает инлайн-скрипт до первой отрисовки.
//- ============================================
const toggleTheme = () => {
  if (!import.meta.client) return
  currentTheme.value = currentTheme.value === 'corporate' ? 'business' : 'corporate'
  document.documentElement.setAttribute('data-theme', currentTheme.value)
  localStorage.setItem('theme', currentTheme.value)
}

//- ============================================
//- Функция выхода
//- ============================================
const handleLogout = async () => {
  closeAdminMenu()
  closeUserMenu()
  closeMobileMenu()

  const result = await appState.logout()
  if (result.success) {
    $notify.success('Вы успешно вышли из системы')
    await navigateTo('/')
  }
}

//- ============================================
//- Закрытие меню при клике вне
//- ============================================
const closeMenusOnClickOutside = (event) => {
  if (!import.meta.client) return

  const adminMenuElement = event.target.closest('li.relative')
  const userMenuElement = event.target.closest('.relative')

  if (!adminMenuElement && isAdminMenuOpen.value) {
    closeAdminMenu()
  }

  if (!userMenuElement && isUserMenuOpen.value) {
    closeUserMenu()
  }
}

//- ============================================
//- Lifecycle
//- ============================================
onMounted(() => {
  if (import.meta.client) {
    // data-theme уже выставлен инлайн-скриптом до первой отрисовки —
    // синхронизируем стейт кнопки с реально применённой темой
    const applied = document.documentElement.getAttribute('data-theme')
    currentTheme.value = applied === 'business' ? 'business' : 'corporate'
    document.addEventListener('click', closeMenusOnClickOutside)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    document.removeEventListener('click', closeMenusOnClickOutside)
  }
})

watch(() => route.path, () => {
  closeAdminMenu()
  closeUserMenu()
  closeMobileMenu()
})
</script>