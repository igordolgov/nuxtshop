<!-- app/components/layout/HeaderMobileMenu.vue — выдвижное меню бургера
     шапки (разбивка Header.vue, этап 6). Панель, каскад пунктов, замер
     прокрутки и стили живут здесь; состояние открытия передаёт шапка
     (свойство open), клики по пунктам — событием item-click (шапка
     закрывает все меню). Бейдж сравнения остаётся на бургер-кнопке. -->
<template lang="pug">
//- Меню: СИБЛИНГ кнопки (уровень .relative), не внутри svg!
//- Ограничение высоты и скролл — в scoped-стилях .mobile-menu:
//- на невысоких экранах меню скроллится с подсказкой-градиентом внизу,
//- а не уходит за нижний край
ul#mobile-menu.mobile-menu.absolute.top-full.left-0.mt-3.z-50(
  v-show="open"
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
  //- видна staff (manager ИЛИ admin, проп isStaff), но админ-only пункты
  //- (новости, контент, промокоды, пользователи) — только админу.
  //- Гость не получает её ни в SSR, ни после гидратации
  template(v-if="isStaff")
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
        li(v-if="isAdmin")
          NuxtLink.mobile-menu-item.flex.items-center(
            class="px-2.5 py-2 rounded-xl font-semibold text-sm transition-all"
            :class="isExactActiveRoute('/admin/news') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
            :to="localePath('/admin/news')"
            @click="onMenuItemClick"
            prefetch
          ) {{ $t('nav.news') }}
        li(v-if="isAdmin")
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
        li(v-if="isAdmin")
          NuxtLink.mobile-menu-item.flex.items-center(
            class="px-2.5 py-2 rounded-xl font-semibold text-sm transition-all"
            :class="isExactActiveRoute('/admin/promocodes') ? 'bg-primary/10 text-primary' : 'hover:bg-base-200 text-base-content'"
            :to="localePath('/admin/promocodes')"
            @click="onMenuItemClick"
            prefetch
          ) {{ $t('nav.promocodes') }}
        li(v-if="isAdmin")
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

</template>

<script setup>
// Props/emits — контракт с шапкой (Header.vue): open управляет видимостью,
// itemClick — единая точка закрытия всех меню шапки.
const props = defineProps({
  open: { type: Boolean, default: false },
  userName: { type: String, default: '' },
  isAuthenticated: { type: Boolean, default: false },
  // isStaff — manager ИЛИ admin (staff-семантика useAuth.isManager):
  // раздел «Админка» виден менеджеру; isAdmin — только админ-only пункты
  isAdmin: { type: Boolean, default: false },
  isStaff: { type: Boolean, default: false },
})
const emit = defineEmits(['itemClick'])

// Активные пункты — та же логика, что у шапки и нижней навигации
const { isActiveRoute, isExactActiveRoute } = useActiveRoute()
const localePath = useLocalePath()
const { compareCount } = useCompare()

const onMenuItemClick = () => emit('itemClick')

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
watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
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
</script>

<style scoped>
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
  .mobile-menu {
    animation: none;
  }
}
</style>
