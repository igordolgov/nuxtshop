<!-- app/components/layout/Header.vue — шапка по паттерну маркетплейсов.
    Мобильные (<1024px) — ДВЕ строки всегда (и в landscape):
      строка 1: бургер + логотип … тема + профиль
      строка 2: поиск на всю ширину (+ «Фильтры» на главной)
    Десктоп (≥1024px) — одна строка: лого · меню · поиск · действия.
    Поиск ГЛОБАЛЬНЫЙ: состояние из appState.search напрямую. -->
<template lang="pug">
header.app-header.sticky.top-0.z-50.border-b(
  class="bg-base-100/95 backdrop-blur border-base-300"
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

        //- Меню: СИБЛИНГ кнопки (уровень .relative), не внутри svg!
        ul#mobile-menu.mobile-menu.absolute.top-full.left-0.mt-3.z-50(
          v-show="isMobileMenuOpen"
          class="bg-base-100 shadow-xl border border-base-300 rounded-2xl w-72 overflow-hidden"
        )
          //- Шапка меню: кто вошёл / приглашение войти
          .px-5.pt-5.pb-4.border-b.border-base-300(class="bg-base-200/50")
            .text-xs.font-medium.uppercase.tracking-wider(class="text-base-content/70")
              | Меню
            .text-sm.font-semibold.text-base-content.mt-1(v-if="isAuthenticated")
              | {{ userName }}
            .text-sm.mt-1(v-else class="text-base-content/70")
              | Гость — войдите для заказов

          //- Раздел: Магазин
          .px-3.py-3
            .px-2.pb-2(class="font-semibold text-[0.7rem] text-base-content/70 uppercase tracking-wider")
              | Магазин
            ul.space-y-1
              li
                NuxtLink.mobile-menu-item.flex.items-center.gap-3(
                  class="px-4 py-3.5 rounded-xl font-medium text-sm transition-all"
                  :class="isActiveRoute('/') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                  to="/"
                  @click="onMenuItemClick"
                  prefetch
                )
                  svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                    path(stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6")
                  span Главная
              li
                NuxtLink.mobile-menu-item.flex.items-center.justify-between(
                  class="px-4 py-3.5 rounded-xl font-medium text-sm transition-all"
                  :class="isActiveRoute('/favorites') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                  to="/favorites"
                  @click="onMenuItemClick"
                  prefetch
                )
                  span.flex.items-center.gap-3
                    svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                      path(stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z")
                    span Избранное
                  span.badge.badge-sm.badge-primary.rounded-full(v-if="favoritesCount > 0")
                    | {{ favoritesCount }}

          //- Раздел: Информация
          .px-3.pb-3
            .px-2.pb-2(class="font-semibold text-[0.7rem] text-base-content/70 uppercase tracking-wider")
              | Информация
            ul.space-y-1
              li
                NuxtLink.mobile-menu-item.flex.items-center.gap-3(
                  class="px-4 py-3.5 rounded-xl font-medium text-sm transition-all"
                  :class="isActiveRoute('/news') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                  to="/news"
                  @click="onMenuItemClick"
                  prefetch
                )
                  svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                    path(stroke-linecap="round" stroke-linejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 0h2a2 2 0 012 2v10a2 2 0 01-2 2h-4l-2-3h-4l-2 3z")
                  span Новости
              li
                NuxtLink.mobile-menu-item.flex.items-center.gap-3(
                  class="px-4 py-3.5 rounded-xl font-medium text-sm transition-all"
                  :class="isActiveRoute('/about') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                  to="/about"
                  @click="onMenuItemClick"
                  prefetch
                )
                  svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                    path(stroke-linecap="round" stroke-linejoin="round" d="M13 16h8v-8l-8-5-8 5v8h8zm-8 0v4a2 2 0 002 2h4")
                  span О нас
              li
                NuxtLink.mobile-menu-item.flex.items-center.gap-3(
                  class="px-4 py-3.5 rounded-xl font-medium text-sm transition-all"
                  :class="isActiveRoute('/contacts') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                  to="/contacts"
                  @click="onMenuItemClick"
                  prefetch
                )
                  svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                    path(stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z")
                  span Контакты

          //- Раздел: Админка
          template(v-if="isAdmin")
            .px-3.pb-4
              .px-2.pb-2(class="font-semibold text-[0.7rem] text-base-content/70 uppercase tracking-wider")
                | Админка
              ul.space-y-1
                li
                  NuxtLink.mobile-menu-item.flex.items-center.gap-3(
                    class="px-4 py-3.5 rounded-xl font-medium text-sm transition-all"
                    :class="isExactActiveRoute('/admin') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                    to="/admin"
                    @click="onMenuItemClick"
                    prefetch
                  )
                    svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                      path(stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z")
                    span Дашборд
                li
                  NuxtLink.mobile-menu-item.flex.items-center.gap-3(
                    class="px-4 py-3.5 rounded-xl font-medium text-sm transition-all"
                    :class="isExactActiveRoute('/admin/products') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                    to="/admin/products"
                    @click="onMenuItemClick"
                    prefetch
                  )
                    svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                      path(stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4")
                    span Товары
                li
                  NuxtLink.mobile-menu-item.flex.items-center.gap-3(
                    class="px-4 py-3.5 rounded-xl font-medium text-sm transition-all"
                    :class="isExactActiveRoute('/admin/orders') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                    to="/admin/orders"
                    @click="onMenuItemClick"
                    prefetch
                  )
                    svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                      path(stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z")
                    span Заказы
                li
                  NuxtLink.mobile-menu-item.flex.items-center.gap-3(
                    class="px-4 py-3.5 rounded-xl font-medium text-sm transition-all"
                    :class="isExactActiveRoute('/admin/news') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                    to="/admin/news"
                    @click="onMenuItemClick"
                    prefetch
                  )
                    svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                      path(stroke-linecap="round" stroke-linejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z")
                    span Новости
                li
                  NuxtLink.mobile-menu-item.flex.items-center.gap-3(
                    class="px-4 py-3.5 rounded-xl font-medium text-sm transition-all"
                    :class="isExactActiveRoute('/admin/content') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                    to="/admin/content"
                    @click="onMenuItemClick"
                    prefetch
                  )
                    svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                      path(stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10")
                    span Контент
                li
                  NuxtLink.mobile-menu-item.flex.items-center.gap-3(
                    class="px-4 py-3.5 rounded-xl font-medium text-sm transition-all"
                    :class="isExactActiveRoute('/admin/reviews') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                    to="/admin/reviews"
                    @click="onMenuItemClick"
                    prefetch
                  )
                    svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                      path(stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z")
                    span Отзывы
                li
                  NuxtLink.mobile-menu-item.flex.items-center.gap-3(
                    class="px-4 py-3.5 rounded-xl font-medium text-sm transition-all"
                    :class="isExactActiveRoute('/admin/promocodes') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                    to="/admin/promocodes"
                    @click="onMenuItemClick"
                    prefetch
                  )
                    svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                      path(stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z")
                      path(stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z")
                    span Промокоды
                li
                  NuxtLink.mobile-menu-item.flex.items-center.gap-3(
                    class="px-4 py-3.5 rounded-xl font-medium text-sm transition-all"
                    :class="isExactActiveRoute('/admin/users') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
                    to="/admin/users"
                    @click="onMenuItemClick"
                    prefetch
                  )
                    svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                      path(stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 8 4 4 0 010-8zM6 20a7 7 0 0114 0")
                    span Пользователи

      //- Логотип (текст виден всегда — двухстрочной шапке хватает места)
      NuxtLink.flex.items-center.gap-2.shrink-0(to="/" prefetch)
        .bg-primary.rounded-xl.flex.items-center.justify-center.size-8
          span.text-primary-content.font-bold.text-sm М
        span.font-semibold.text-base-content.tracking-tight Магазин

    //- Десктоп-меню (центр строки 1)
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
        li.relative
          NuxtLink.px-3.py-2.rounded-xl.font-medium.text-sm.flex.items-center.gap-2.transition-colors(
            :class="isActiveRoute('/favorites') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content/80'"
            to="/favorites"
          )
            span Избранное
            span.badge.badge-xs.badge-primary.rounded-full(v-if="favoritesCount > 0")
              | {{ favoritesCount }}
        li.relative(v-if="isAdmin" ref="adminMenuRef")
          button.px-3.py-2.rounded-xl.font-medium.text-sm.flex.items-center.gap-1.transition-colors(
            type="button"
            :aria-expanded="isAdminMenuOpen"
            aria-haspopup="menu"
            :class="isAdminRouteActive || isAdminMenuOpen ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content/80'"
            @click="toggleAdminMenu"
          )
            span Админка
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
                to="/admin/orders"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin/orders') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
                prefetch
              ) Заказы
              NuxtLink.flex.items-center.gap-3.px-3.py-2.rounded-xl.text-sm(
                to="/admin/news"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin/news') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
                prefetch
              ) Новости
              NuxtLink.flex.items-center.gap-3.px-3.py-2.rounded-xl.text-sm(
                to="/admin/content"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin/content') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
                prefetch
              ) Контент
              NuxtLink.flex.items-center.gap-3.px-3.py-2.rounded-xl.text-sm(
                to="/admin/reviews"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin/reviews') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
                prefetch
              ) Отзывы
              NuxtLink.flex.items-center.gap-3.px-3.py-2.rounded-xl.text-sm(
                to="/admin/promocodes"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin/promocodes') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
                prefetch
              ) Промокоды
              NuxtLink.flex.items-center.gap-3.px-3.py-2.rounded-xl.text-sm(
                to="/admin/users"
                @click="closeAdminMenu"
                :class="isExactActiveRoute('/admin/users') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
                prefetch
              ) Пользователи

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
        NuxtLink.btn.btn-ghost.btn-circle(to="/cart" aria-label="Корзина" class="w-11 h-11 min-h-0")
          svg.h-5.w-5(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="text-base-content/70" stroke-width="1.75")
            path(stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z")
        span.badge.badge-xs.badge-primary.absolute.top-2.right-2.indicator-item.rounded-full.px-1(
          v-if="cartItemsCount > 0"
        ) {{ cartItemsCount }}

      //- Тема
      button.btn.btn-ghost.btn-circle(
        type="button"
        :title="currentTheme === 'corporate' ? 'Включить тёмную тему' : 'Включить светлую тему'"
        aria-label="Переключить тему"
        class="w-11 h-11 min-h-0"
        @click="toggleTheme"
      )
        svg.w-5.h-5(
          v-if="currentTheme === 'corporate'"
          xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" stroke-width="1.75" class="text-base-content/70"
        )
          path(stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z")
        svg.w-5.h-5(
          v-else
          xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" stroke-width="1.75" class="text-base-content/70"
        )
          path(stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646A9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z")

      //- Меню пользователя
      .relative(v-if="isAuthenticated" ref="userMenuRef")
        button.flex.items-center.gap-2.cursor-pointer.rounded-xl.transition-colors(
          type="button"
          :aria-expanded="isUserMenuOpen"
          aria-haspopup="menu"
          aria-label="Меню пользователя"
          class="hover:bg-base-200 px-2 h-11"
          @click="toggleUserMenu"
        )
          .avatar
            .rounded-full.bg-primary.flex.items-center.justify-center.text-primary-content.font-semibold.size-7.text-xs
              span {{ userInitials }}
          span.font-medium.text-sm(class="hidden sm:block") {{ userName }}
          svg.w-4.h-4.transition-transform(
            xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" class="text-base-content/50"
            :class="isUserMenuOpen ? 'rotate-180' : ''"
          )
            path(stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M19 9l-7 7-7-7")

        .absolute.top-full.right-0.mt-2.z-50(
          v-show="isUserMenuOpen"
          class="bg-base-100 shadow-lg border border-base-300 rounded-2xl min-w-56"
        )
          .flex.flex-col.p-2
            .px-3.py-2.border-b.border-base-300.mb-1
              .text-xs.text-base-content.opacity-60.truncate {{ userEmail }}
              .badge.badge-sm.mt-1.rounded-full(
                :class="userRole === 'admin' ? 'badge-primary' : userRole === 'manager' ? 'badge-secondary' : 'badge-accent'"
              )
                | {{ userRole === 'admin' ? 'Администратор' : userRole === 'manager' ? 'Менеджер' : 'Пользователь' }}

            button.flex.items-center.gap-3.px-3.py-3.rounded-xl.w-full.text-left.cursor-pointer.text-sm.transition-colors(
              type="button"
              @click="navigateToPath('/user')"
              :class="isExactActiveRoute('/user') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
            )
              span Личный кабинет

            button.flex.items-center.gap-3.px-3.py-3.rounded-xl.w-full.text-left.cursor-pointer.text-sm.transition-colors(
              type="button"
              @click="navigateToPath('/user/orders')"
              :class="isExactActiveRoute('/user/orders') ? 'bg-primary text-primary-content' : 'hover:bg-base-200 text-base-content'"
            )
              span Мои заказы

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

            button.flex.items-center.gap-3.px-3.py-3.rounded-xl.w-full.text-left.cursor-pointer.text-sm.text-error.transition-colors(
              type="button"
              class="hover:bg-error/10"
              @click="handleLogout"
            )
              span Выйти

      //- Кнопка входа (неавторизованные)
      NuxtLink.btn.btn-primary.mr-3.rounded-xl(
        v-else
        to="/auth/login"
        class="min-h-11"
      )
        span Войти

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
/* Шапка: safe-area для standalone-PWA (статус-бар не перекрывает) */
.app-header {
  padding-top: var(--safe-area-top, 0px);
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

/* ─── Люксовое меню: плавное появление ─────────────────────────── */
.mobile-menu {
  animation: menuIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  transform-origin: top left;
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

@media (prefers-reduced-motion: reduce) {
  .mobile-menu {
    animation: none;
  }
}
</style>

<script setup>
const route = useRoute()
const { $notify } = useNuxtApp()

//- Витринный поиск в шапке не показываем на /admin/*: на админ-страницах
//- свой поиск (например, в списке товаров), глобальный только дублирует
const isAdminRoute = computed(() => route.path?.startsWith('/admin'))

const { isMobile } = useMobileDetection()
const { favoritesCount } = useFavorites()
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

const isHomePage = computed(() => route.path === '/')
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

const userName = computed(() => user.value?.name || 'Пользователь')
const userEmail = computed(() => user.value?.email || '')
const userRole = computed(() => user.value?.role || 'user')
const isAdminRouteActive = computed(() => route.path.startsWith('/admin'))

const isActiveRoute = (path) => route.path === path || route.path.startsWith(path + '/')
const isExactActiveRoute = (path) => route.path === path

const closeMobileMenu = () => { isMobileMenuOpen.value = false }
const closeAdminMenu = () => { isAdminMenuOpen.value = false }
const closeUserMenu = () => { isUserMenuOpen.value = false }
const closeAllMenus = () => { closeMobileMenu(); closeAdminMenu(); closeUserMenu() }

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
  if (isMobileMenuOpen.value) { closeAdminMenu(); closeUserMenu() }
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

const toggleTheme = () => {
  if (!import.meta.client) return
  currentTheme.value = currentTheme.value === 'corporate' ? 'business' : 'corporate'
  document.documentElement.setAttribute('data-theme', currentTheme.value)
  localStorage.setItem('theme', currentTheme.value)
}

const handleLogout = async () => {
  closeAllMenus()
  const result = await appState.logout()
  if (result.success) {
    $notify.success('Вы успешно вышли из системы')
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
})

onUnmounted(() => {
  if (!import.meta.client) return
  document.removeEventListener('click', closeMenusOnClickOutside)
  document.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('theme-changed', onThemeChanged)
})

watch(() => route.path, () => closeAllMenus())

watch(isMobile, (mobile) => {
  if (!mobile) closeMobileMenu()
})
</script>