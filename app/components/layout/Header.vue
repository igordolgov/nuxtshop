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
        //- (см. app/utils/compareFly.js)
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

        //- Меню: СИБЛИНГ кнопки (уровень .relative), не внутри svg!
        //- Ограничение высоты и скролл — в scoped-стилях .mobile-menu:
        //- на невысоких экранах меню скроллится с подсказкой-градиентом внизу,
        //- а не уходит за нижний край
        ul#mobile-menu.mobile-menu.absolute.top-full.left-0.mt-3.z-50(
          v-show="isMobileMenuOpen"
          ref="menuPanel"
          @scroll.passive="updateMenuScroll"
          class="bg-base-100 shadow-xl border border-base-300 rounded-2xl w-72 overflow-x-hidden overflow-y-auto overscroll-contain"
        )
          //- Шапка меню: кто вошёл / приглашение войти
          .px-4.pt-4.pb-3.border-b.border-base-300(class="bg-base-200/50")
            .text-xs.font-semibold.uppercase.tracking-wider(class="text-base-content/80")
              | {{ $t('nav.menu') }}
            .text-sm.font-semibold.text-base-content.mt-1(v-if="isAuthenticated")
              | {{ userName }}
            .text-sm.mt-1(v-else class="text-base-content/85")
              | {{ $t('header.guestHint') }}

          //- Раздел: Магазин — без заголовка (лишние слова, экономим высоту)
          .px-3.pt-2.pb-2
            ul.space-y-1
              li
                NuxtLink.mobile-menu-item.flex.items-center.gap-3(
                  class="px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  :class="isActiveRoute('/') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                  :to="localePath('/')"
                  @click="onMenuItemClick"
                  prefetch
                )
                  svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                    path(stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6")
                  span {{ $t('nav.home') }}
              li
                NuxtLink.mobile-menu-item.flex.items-center.justify-between(
                  class="px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  :class="isActiveRoute('/favorites') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                  :to="localePath('/favorites')"
                  @click="onMenuItemClick"
                  prefetch
                )
                  span.flex.items-center.gap-3
                    svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                      path(stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z")
                    span {{ $t('nav.favorites') }}
                  span.badge.badge-sm.badge-primary.rounded-full.count-pop(v-if="favoritesCount > 0" :key="favoritesCount")
                    | {{ favoritesCount }}
              li
                NuxtLink.mobile-menu-item.flex.items-center.justify-between(
                  class="px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  :class="isActiveRoute('/compare') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                  :to="localePath('/compare')"
                  @click="onMenuItemClick"
                  prefetch
                )
                  span.flex.items-center.gap-3
                    svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                      path(stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4")
                    span {{ $t('nav.compareFull') }}
                  span.badge.badge-sm.badge-primary.rounded-full(v-if="compareCount > 0")
                    | {{ compareCount }}

          //- Раздел: Информация — без заголовка
          .px-3.pb-2
            ul.space-y-1
              li
                NuxtLink.mobile-menu-item.flex.items-center.gap-3(
                  class="px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  :class="isActiveRoute('/news') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                  :to="localePath('/news')"
                  @click="onMenuItemClick"
                  prefetch
                )
                  svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                    path(stroke-linecap="round" stroke-linejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 0h2a2 2 0 012 2v10a2 2 0 01-2 2h-4l-2-3h-4l-2 3z")
                  span {{ $t('nav.news') }}
              li
                NuxtLink.mobile-menu-item.flex.items-center.gap-3(
                  class="px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  :class="isActiveRoute('/about') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                  :to="localePath('/about')"
                  @click="onMenuItemClick"
                  prefetch
                )
                  svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                    path(stroke-linecap="round" stroke-linejoin="round" d="M13 16h8v-8l-8-5-8 5v8h8zm-8 0v4a2 2 0 002 2h4")
                  span {{ $t('nav.about') }}
              li
                NuxtLink.mobile-menu-item.flex.items-center.gap-3(
                  class="px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  :class="isActiveRoute('/contacts') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                  :to="localePath('/contacts')"
                  @click="onMenuItemClick"
                  prefetch
                )
                  svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                    path(stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z")
                  span {{ $t('nav.contacts') }}

          //- Раздел: Админка — компактная сетка в 2 колонки, без иконок;
          //- видна только вошедшему администратору (v-if): гость не получает
          //- её ни в SSR, ни после гидратации
          template(v-if="isAdmin")
            .px-3.pb-3
              ul.grid.grid-cols-2.gap-1
                li
                  NuxtLink.mobile-menu-item.flex.items-center(
                    class="px-2.5 py-2 rounded-xl font-semibold text-sm transition-all"
                    :class="isExactActiveRoute('/admin') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                    :to="localePath('/admin')"
                    @click="onMenuItemClick"
                    prefetch
                  ) {{ $t('nav.dashboard') }}
                li
                  NuxtLink.mobile-menu-item.flex.items-center(
                    class="px-2.5 py-2 rounded-xl font-semibold text-sm transition-all"
                    :class="isExactActiveRoute('/admin/products') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                    :to="localePath('/admin/products')"
                    @click="onMenuItemClick"
                    prefetch
                  ) {{ $t('nav.products') }}
                li
                  NuxtLink.mobile-menu-item.flex.items-center(
                    class="px-2.5 py-2 rounded-xl font-semibold text-sm transition-all"
                    :class="isExactActiveRoute('/admin/orders') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                    :to="localePath('/admin/orders')"
                    @click="onMenuItemClick"
                    prefetch
                  ) {{ $t('nav.orders') }}
                li
                  NuxtLink.mobile-menu-item.flex.items-center(
                    class="px-2.5 py-2 rounded-xl font-semibold text-sm transition-all"
                    :class="isExactActiveRoute('/admin/news') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                    :to="localePath('/admin/news')"
                    @click="onMenuItemClick"
                    prefetch
                  ) {{ $t('nav.news') }}
                li
                  NuxtLink.mobile-menu-item.flex.items-center(
                    class="px-2.5 py-2 rounded-xl font-semibold text-sm transition-all"
                    :class="isExactActiveRoute('/admin/content') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                    :to="localePath('/admin/content')"
                    @click="onMenuItemClick"
                    prefetch
                  ) {{ $t('nav.content') }}
                li
                  NuxtLink.mobile-menu-item.flex.items-center(
                    class="px-2.5 py-2 rounded-xl font-semibold text-sm transition-all"
                    :class="isExactActiveRoute('/admin/reviews') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                    :to="localePath('/admin/reviews')"
                    @click="onMenuItemClick"
                    prefetch
                  ) {{ $t('nav.reviews') }}
                li
                  NuxtLink.mobile-menu-item.flex.items-center(
                    class="px-2.5 py-2 rounded-xl font-semibold text-sm transition-all"
                    :class="isExactActiveRoute('/admin/promocodes') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                    :to="localePath('/admin/promocodes')"
                    @click="onMenuItemClick"
                    prefetch
                  ) {{ $t('nav.promocodes') }}
                li
                  NuxtLink.mobile-menu-item.flex.items-center(
                    class="px-2.5 py-2 rounded-xl font-semibold text-sm transition-all"
                    :class="isExactActiveRoute('/admin/users') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                    :to="localePath('/admin/users')"
                    @click="onMenuItemClick"
                    prefetch
                  ) {{ $t('nav.users') }}

          //- Признак прокрутки: градиент + стрелка видны, только когда пункты
          //- не влезли в экран (страховка для крошечных/горизонтальных экранов);
          //- у дна списка исчезают. sticky bottom внутри скролл-панели,
          //- pointer-events-none — не мешает тапам
          li.sticky.bottom-0.pointer-events-none(
            v-show="menuScrollable && !menuAtBottom"
            aria-hidden="true"
            class="h-8 -mt-3 bg-gradient-to-t from-base-100 to-transparent"
          )
            svg.menu-scroll-hint.absolute.w-4.h-4(
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              class="left-1/2 bottom-1 text-base-content/60"
            )
              path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7")

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
        li.relative(v-if="isAdmin" ref="adminMenuRef")
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
                :to="localePath(\'/admin/news\')"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin/news') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
                prefetch
              ) {{ $t('nav.news') }}
              NuxtLink.flex.items-center.gap-3.px-3.py-2.rounded-xl.text-sm(
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
                :to="localePath(\'/admin/promocodes\')"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin/promocodes') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
                prefetch
              ) {{ $t('nav.promocodes') }}
              NuxtLink.flex.items-center.gap-3.px-3.py-2.rounded-xl.text-sm(
                :to="localePath(\'/admin/users\')"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin/users') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
                prefetch
              ) {{ $t('nav.users') }}

    //- Правая группа: поиск (десктоп) · корзина (десктоп) · тема · профиль
    .flex.items-center.gap-1.shrink-0(class="lg:gap-2")
      //- Поиск — только десктоп (на мобильных строка 2). На админ-страницах
      //- скрыт: там свой поиск по каталогу, витринный только путает
      .search-desktop.hidden(class="md:block lg:w-64 xl:w-80" v-if="!isAdminRoute")
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

      //- Меню пользователя
      .relative(v-if="isAuthenticated" ref="userMenuRef")
        button.flex.items-center.gap-2.cursor-pointer.rounded-xl.transition-colors(
          type="button"
          :aria-expanded="isUserMenuOpen"
          aria-haspopup="menu"
          :aria-label="$t('header.userMenu')"
          class="hover:bg-base-200 px-2 h-11"
          @click="toggleUserMenu"
        )
          .avatar
            .rounded-full.bg-primary.flex.items-center.justify-center.text-primary-content.font-semibold.size-7.text-xs
              span {{ userInitials }}
          span.font-semibold.text-sm(class="hidden sm:block") {{ userName }}
          svg.w-4.h-4.transition-transform(
            xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" class="text-base-content/75"
            :class="isUserMenuOpen ? 'rotate-180' : ''"
          )
            path(stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M19 9l-7 7-7-7")

        .absolute.top-full.right-0.mt-2.z-50(
          v-show="isUserMenuOpen"
          class="bg-base-100 shadow-lg border border-base-300 rounded-2xl min-w-56"
        )
          .flex.flex-col.p-2
            .px-3.py-2.border-b.border-base-300.mb-1
              .text-xs.text-base-content.opacity-75.truncate {{ userEmail }}
              .badge.badge-sm.mt-1.rounded-full(
                :class="userRole === 'admin' ? 'badge-primary' : userRole === 'manager' ? 'badge-secondary' : 'badge-accent'"
              )
                | {{ userRole === 'admin' ? $t('header.roleAdmin') : userRole === 'manager' ? $t('header.roleManager') : $t('header.roleUser') }}

            button.flex.items-center.gap-3.px-3.py-3.rounded-xl.w-full.text-left.cursor-pointer.font-medium.text-sm.transition-colors(
              type="button"
              @click="navigateToPath('/user')"
              :class="isExactActiveRoute('/user') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
            )
              span {{ $t('header.account') }}

            button.flex.items-center.gap-3.px-3.py-3.rounded-xl.w-full.text-left.cursor-pointer.font-medium.text-sm.transition-colors(
              type="button"
              @click="navigateToPath('/user/orders')"
              :class="isExactActiveRoute('/user/orders') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
            )
              span {{ $t('header.myOrders') }}

            button.flex.items-center.gap-3.px-3.py-3.rounded-xl.w-full.text-left.cursor-pointer.font-medium.text-sm.transition-colors(
              v-if="isAdmin"
              type="button"
              @click="navigateToPath('/admin/users')"
              :class="isExactActiveRoute('/admin/users') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
            )
              span {{ $t('header.manageUsers') }}

            button.flex.items-center.gap-3.px-3.py-3.rounded-xl.w-full.text-left.cursor-pointer.font-medium.text-sm.transition-colors(
              type="button"
              @click="navigateToPath('/settings')"
              :class="isExactActiveRoute('/settings') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
            )
              span {{ $t('header.settings') }}

            .divider.my-1

            button.flex.items-center.gap-3.px-3.py-3.rounded-xl.w-full.text-left.cursor-pointer.font-medium.text-sm.text-error.transition-colors(
              type="button"
              class="hover:bg-error/10"
              @click="handleLogout"
            )
              span {{ $t('header.logout') }}

      //- Кнопка входа (неавторизованные)
      NuxtLink.btn.btn-primary.mr-3.rounded-xl(
        v-else
        :to="localePath('/auth/login')"
        class="min-h-11"
      )
        span {{ $t('header.login') }}

  //- ═══ Строка 2 (только мобильные): поиск на всю ширину ═══
  .px-3.pb-2(class="md:hidden" v-if="!isAdminRoute")
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

/* Каскад пунктов при каждом открытии меню: display:none → блок
   перезапускает CSS-анимацию, JS не нужен. До 8 пунктов × 30 мс —
   меню «распахивается» из-под бургера (у секций свои ul, ступени
   считаются внутри каждой). */
#mobile-menu .px-3 > ul > li {
  animation: menuItemIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
}
#mobile-menu .px-3 > ul > li:nth-child(1) { animation-delay: 0.03s; }
#mobile-menu .px-3 > ul > li:nth-child(2) { animation-delay: 0.06s; }
#mobile-menu .px-3 > ul > li:nth-child(3) { animation-delay: 0.09s; }
#mobile-menu .px-3 > ul > li:nth-child(4) { animation-delay: 0.12s; }
#mobile-menu .px-3 > ul > li:nth-child(5) { animation-delay: 0.15s; }
#mobile-menu .px-3 > ul > li:nth-child(6) { animation-delay: 0.18s; }
#mobile-menu .px-3 > ul > li:nth-child(7) { animation-delay: 0.21s; }
#mobile-menu .px-3 > ul > li:nth-child(8) { animation-delay: 0.24s; }

@keyframes menuItemIn {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: none; }
}

.burger-compare-badge.is-blinking {
  animation: badgeBlink 0.45s ease-in-out 3;
}

@keyframes badgeBlink {
  0%, 100% { transform: scale(1.2); opacity: 1; }
  50% { transform: scale(0.8); opacity: 0.45; }
}

/* ─── Люксовое меню: плавное появление ─────────────────────────── */
.mobile-menu {
  animation: menuIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: top left;
  /* Панель не выше экрана. vh понимают все браузеры (в т.ч. старые без dvh);
     @supports нужен, чтобы минификатор не выкинул фолбэк как «дублирующий» */
  max-height: calc(100vh - 5.25rem);
}
@supports (height: 100dvh) {
  .mobile-menu {
    /* dvh точнее на мобилках: не прыгает при скрытии адресной строки */
    max-height: calc(100dvh - 5.25rem);
  }
}

@keyframes menuIn {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Стрелка-подсказка прокрутки бургер-меню: покачивается, пока список не долистан */
.menu-scroll-hint {
  transform: translateX(-50%);
  animation: hintBounce 1.4s ease-in-out infinite;
}

@keyframes hintBounce {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(3px); }
}

@media (prefers-reduced-motion: reduce) {
  .menu-scroll-hint { animation: none; }
  .burger-compare-badge,
  .burger-compare-badge.is-blinking { animation: none; }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-menu {
    animation: none;
  }
}
</style>

<script setup>
const route = useRoute()
const { $notify } = useNuxtApp()
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

//- Enter: с чужой страницы → каталог с запросом; на главной — штатно
const onPerformSearch = () => {
  const q = searchQuery.value?.trim()
  if (!isHomePage.value && q) {
    navigateTo({ path: '/', query: { search: q } })
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

//- ============================================
//- Меню (управляемое состояние)
//- ============================================
const isMobileMenuOpen = ref(false)
const isAdminMenuOpen = ref(false)
const isUserMenuOpen = ref(false)

const mobileMenuRef = ref(null)
const adminMenuRef = ref(null)
const userMenuRef = ref(null)

const currentTheme = ref('corporate')

const isHomePage = computed(() => route.path === localePath('/'))
const user = computed(() => appState.user?.value)
const isAuthenticated = computed(() => appState.isAuthenticated?.value)
const isAdmin = computed(() => appState.isAdmin?.value)
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

const userName = computed(() => user.value?.name || t('header.defaultUserName'))
const userEmail = computed(() => user.value?.email || '')
const userRole = computed(() => user.value?.role || 'user')
// Подсветка «Админ» в мобильном меню — тот же локализованный предикат,
// что и у isAdminRoute (сырой startsWith('/admin') молчал на /en и /es)
const isAdminRouteActive = computed(() => isActiveRoute('/admin'))

const closeMobileMenu = () => { isMobileMenuOpen.value = false }
const closeAdminMenu = () => { isAdminMenuOpen.value = false }
const closeUserMenu = () => { isUserMenuOpen.value = false }
const closeAllMenus = () => { closeMobileMenu(); closeAdminMenu(); closeUserMenu() }

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
  if (isMobileMenuOpen.value) { closeAdminMenu(); closeUserMenu() }
}

//- Признак прокрутки бургер-меню: если пункты не влезли в экран,
//- внизу панели виден градиент со стрелкой (исчезает у дна списка).
//- Замер — после открытия (v-show => размеры есть только в DOM) и на скролле
const menuPanel = ref(null)
const menuScrollable = ref(false)
const menuAtBottom = ref(true)
const updateMenuScroll = () => {
  const el = menuPanel.value
  if (!el) return
  menuScrollable.value = el.scrollHeight > el.clientHeight + 4
  menuAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 8
}
watch(isMobileMenuOpen, async (open) => {
  if (!open) return
  await nextTick()
  // Двойной rAF + отложенный повтор: шрифты и анимация меню меняют высоту
  // контента после первого кадра — одиночного nextTick мало
  // (фидбек «стрелки нет» на Tecno Pova 5 / Opera Android)
  requestAnimationFrame(() => {
    updateMenuScroll()
    requestAnimationFrame(updateMenuScroll)
  })
  setTimeout(updateMenuScroll, 300)
})

//- Поворот телефона / изменение окна / смена высоты панели (max-height на dvh)
//- — пересчёт; ResizeObserver ловит и само открытие (display:none → блок)
let menuResizeObserver = null
onMounted(() => {
  window.addEventListener('resize', updateMenuScroll, { passive: true })
  if (typeof ResizeObserver === 'function' && menuPanel.value) {
    menuResizeObserver = new ResizeObserver(() => updateMenuScroll())
    menuResizeObserver.observe(menuPanel.value)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateMenuScroll)
  menuResizeObserver?.disconnect()
  menuResizeObserver = null
})

//- ============================================
//- Полёт «синей точки» сравнения (см. app/utils/compareFly.js):
//- карточки диспатчат COMPARE_FLY_EVENT, здесь точка летит по лёгкой дуге
//- к видимому приёмнику [data-fly-compare], исчезает у цели, а бейдж
//- на бургере мигает ~1.5 с. prefers-reduced-motion — без полёта.
//- ============================================
const burgerBlink = ref(false)
let burgerBlinkTimer = null
const blinkCompareBadge = () => {
  burgerBlink.value = false
  // перезапуск CSS-анимации: кадр без класса, затем кадр с классом
  requestAnimationFrame(() => { burgerBlink.value = true })
  clearTimeout(burgerBlinkTimer)
  burgerBlinkTimer = setTimeout(() => { burgerBlink.value = false }, 1500)
}

const flyCompareDot = (origin, targetEl) => {
  const target = elementCenter(targetEl)
  if (!target) return
  const dot = document.createElement('span')
  dot.setAttribute('aria-hidden', 'true')
  // стили инлайном: точка создаётся вне Vue, scoped-стили на неё не действуют
  dot.style.cssText =
    'position:fixed;left:0;top:0;width:14px;height:14px;margin:-7px 0 0 -7px;' +
    'border-radius:9999px;background:var(--color-primary,#007bc7);' +
    'box-shadow:0 2px 12px rgba(0,0,0,.25);z-index:9999;pointer-events:none;' +
    'will-change:transform,opacity;opacity:.95'
  document.body.appendChild(dot)
  if (typeof dot.animate !== 'function') {
    dot.remove()
    return
  }
  // лёгкая дуга: середина хорды выталкивается перпендикуляром
  const midX = (origin.x + target.x) / 2 + (target.y - origin.y) * 0.15
  const midY = (origin.y + target.y) / 2 - (target.x - origin.x) * 0.15
  const animation = dot.animate(
    [
      { transform: `translate(${origin.x}px, ${origin.y}px) scale(1)`, opacity: 1 },
      { transform: `translate(${midX}px, ${midY}px) scale(0.8)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${target.x}px, ${target.y}px) scale(0.35)`, opacity: 0.35 },
    ],
    { duration: 700, easing: 'cubic-bezier(0.32, 0.72, 0.35, 1)' },
  )
  const finish = () => { dot.remove(); blinkCompareBadge() }
  animation.onfinish = finish
  animation.oncancel = () => dot.remove()
}

const onCompareFly = (event) => {
  blinkCompareBadge()
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const origin = getFlyOrigin(
    event?.detail,
    { width: window.innerWidth, height: window.innerHeight },
  )
  const targetEl = resolveFlyTarget(document.querySelectorAll('[data-fly-compare]'))
  if (targetEl) flyCompareDot(origin, targetEl)
}

const toggleAdminMenu = () => {
  isAdminMenuOpen.value = !isAdminMenuOpen.value
  if (isAdminMenuOpen.value) { closeUserMenu(); closeMobileMenu() }
}
const toggleUserMenu = () => {
  isUserMenuOpen.value = !isUserMenuOpen.value
  if (isUserMenuOpen.value) { closeAdminMenu(); closeMobileMenu() }
}

const onMenuItemClick = () => closeAllMenus()

const navigateToPath = async (path) => {
  closeAllMenus()
  await navigateTo(path)
}

const applyTheme = (theme) => {
  currentTheme.value = theme
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
}

const toggleTheme = () => {
  if (!import.meta.client) return
  const next = currentTheme.value === 'corporate' ? 'business' : 'corporate'
  // View Transitions: мягкий кросс-фейд темы (Chrome/Safari 18+); нет API
  // или включено «уменьшить движение» — мгновенно, как раньше
  if (
    typeof document.startViewTransition === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    document.startViewTransition(() => applyTheme(next))
    return
  }
  applyTheme(next)
}

const handleLogout = async () => {
  closeAllMenus()
  const result = await appState.logout()
  if (result.success) {
    $notify.success(t('header.logoutSuccess'))
    await navigateTo('/')
  }
}

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

//- Тема, изменённая вне шапки (страница /settings), синхронизирует переключатель
const onThemeChanged = (event) => {
  const theme = event?.detail
  if (theme === 'corporate' || theme === 'business') currentTheme.value = theme
}

onMounted(() => {
  if (!import.meta.client) return
  const applied = document.documentElement.getAttribute('data-theme')
  currentTheme.value = applied === 'business' ? 'business' : 'corporate'
  document.addEventListener('click', closeMenusOnClickOutside)
  document.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener('theme-changed', onThemeChanged)
  window.addEventListener(COMPARE_FLY_EVENT, onCompareFly)
})

onUnmounted(() => {
  if (!import.meta.client) return
  document.removeEventListener('click', closeMenusOnClickOutside)
  document.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('theme-changed', onThemeChanged)
  window.removeEventListener(COMPARE_FLY_EVENT, onCompareFly)
  clearTimeout(burgerBlinkTimer)
})

watch(() => route.path, () => closeAllMenus())

watch(isMobile, (mobile) => {
  if (!mobile) closeMobileMenu()
})
</script>