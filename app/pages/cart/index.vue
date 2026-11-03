<!-- app/pages/cart/index.vue — корзина: список товаров (лента карточек на
     мобильных / таблица на десктопе), панель оформления, плавающая кнопка
     «Оформить заказ» над нижней навигацией, safe-area. -->
<template lang="pug">
.cart-page.bg-base-100.flex.flex-col
  //- Шапка сайта. Fallback — заглушка высоты шапки, layout не прыгает
  ClientOnly
    Header
    template(#fallback)
      .header-skeleton

  .content-wrapper.flex-1.flex.min-h-0.w-full
    //- До монтирования: корзина читается из localStorage только на клиенте —
    //- на SSR список пуст. Скелет вместо мигающего «Корзина пуста»
    .cart-skeleton(v-if="!isMounted" class="px-3 sm:px-4 pt-4")
      .skeleton.skeleton-row(v-for="i in 3" :key="i")

    //- ПУСТАЯ КОРЗИНА — один блок на все экраны
    .empty-cart(
      v-else-if="!cartItems || cartItems.length === 0"
      class="flex justify-center items-center"
    )
      .empty-cart-content.text-center.max-w-md.mx-auto(class="p-6 sm:p-8")
        .empty-icon.mx-auto.mb-6
          svg(width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5")
            path(d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z")
        h2.text-2xl.font-semibold.text-base-content.mb-2
          | {{ $t('cart.empty') }}
        p.text-sm.mb-8(class="text-base-content/65")
          | {{ $t('cart.emptyHint') }}
        button.btn.btn-primary.rounded-xl(type="button" @click="goCatalog")
          span {{ $t('cart.goCatalog') }}

    //- КОРЗИНА С ТОВАРАМИ
    .main-content.bg-base-100.flex-1.flex.flex-col.max-w-full(v-else)
      .container.mx-auto.flex-1.max-w-full(class="px-3 sm:px-4 lg:px-6 pt-3 lg:pt-4")
        //- grid-cols-1 ОБЯЗАТЕЛЕН на мобильных: без явной колонки grid
        //- раздувает неявную auto-колонку до max-content ленты карточек —
        //- лента перестаёт переполняться и не свайпается
        .cart-grid.grid.grid-cols-1.gap-4(class="md:gap-6 lg:grid-cols-4")
          //- ЛЕВАЯ КОЛОНКА — ТОВАРЫ
          .cart-left.col-span-2.max-w-full.min-w-0
            //- Подзаголовок: на мобильных — sticky-чип под шапкой сайта,
            //- на десктопе — статичный
            .cart-header.sticky.z-30(
              class="lg:static flex justify-between items-center gap-2 bg-base-100/95 lg:bg-transparent shadow-sm lg:shadow-none backdrop-blur lg:backdrop-blur-none mb-3 lg:mb-4 px-3 lg:px-0 py-2 lg:py-0 border border-base-300 lg:border-0 rounded-xl"
            )
              h1.text-xl.font-semibold.text-base-content(class="lg:text-2xl")
                | {{ $t('cart.title') }}
              .flex.items-center.gap-3
                span.text-sm(v-if="totalItems > 0" class="text-base-content/65")
                  | {{ $t('cart.itemsCount', totalItems) }}
                button.btn.btn-ghost.btn-xs.rounded-lg.text-error(
                  v-if="cartItems && cartItems.length > 0"
                  class="hover:bg-error/10"
                  type="button"
                  @click="clearCart"
                )
                  span {{ $t('cart.clear') }}

            .cart-content.max-w-full
              //- Предупреждение о недостаточном количестве
              .alert-banner.mb-4(v-if="hasOutOfStockItems")
                svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                  path(stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z")
                span.text-sm
                  | {{ $t('cart.qtyWarning') }}

              CartItemsList

          //- Правая колонка — оформление; панель — CartCheckoutPanel.vue
          //- (состояние обработки и переход в чекаут остаются на странице)
          .cart-right.col-span-2.max-w-full.min-w-0(v-if="totalItems" class="lg:mb-0")
            CartCheckoutPanel(
              v-model:promo-code="promoCode"
              :is-processing="isProcessing"
              :has-out-of-stock-items="hasOutOfStockItems"
              @apply-promo="applyPromo"
              @checkout="proceedToCheckout"
            )

  //- ПЛАВАЮЩАЯ ПАНЕЛЬ ОФОРМЛЕНИЯ (мобильные).
  //- Вся позиция/видимость — в scoped-CSS класса (не на Tailwind-утилитах):
  //- один источник правды, ничего не теряется при генерации утилит
  .mobile-checkout-button(v-if="isMounted && cartItems && cartItems.length > 0")
    button.btn.btn-primary.btn-lg.w-full.rounded-xl(
      type="button"
      :disabled="isProcessing || hasOutOfStockItems"
      :class="{ 'btn-error': hasOutOfStockItems }"
      @click="proceedToCheckout"
    )
      template(v-if="!isProcessing")
        span.text-base
          template(v-if="hasOutOfStockItems") {{ $t('cart.qtyProblems') }}
          template(v-else) {{ $t('cart.checkoutBtnPrice', { price: formatPrice(total) + ' ₽' }) }}
      span.loading.loading-spinner(v-else)

  //- Десктопный футер (аудит F16); на мобиле — плавающая кнопка оформления
  //- и нижнее меню, футер не нужен
  SiteFooter

  //- Нижняя навигация (сам компонент ведает ориентацией и переходами)
  MobileNavFooter
</template>

<style scoped>
/* ============================================
  ЗАГЛУШКИ (ClientOnly-fallback и скелет списка)
============================================ */
.header-skeleton {
  height: var(--header-height, 56px);
  width: 100%;
  flex-shrink: 0;
}

.cart-skeleton {
  width: 100%;
}

.skeleton-row {
  height: 6rem;
  border-radius: 1rem;
  margin-bottom: 0.75rem;
}

/* ============================================
  ПУСТАЯ КОРЗИНА — один блок на все экраны
============================================ */
.empty-cart {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: var(--color-base-100);
  padding: 1rem;
  /* Центрирование с учётом нижней навигации и жестовой полосы */
  padding-bottom: calc(var(--mobile-nav-height, 60px) + var(--safe-area-bottom, 0px) + 1rem);
}

.empty-cart-content {
  animation: fadeIn 0.4s ease-out;
}

.empty-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-base-200);
  color: color-mix(in oklab, var(--color-base-content) 30%, transparent);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ============================================
  КАРКАС СТРАНИЦЫ
  Мобильные: обычный поток — скроллится страница.
  Десктоп: фиксированная высота + внутренние скроллы колонок
============================================ */
.content-wrapper {
  flex: 1 1 auto;
  min-height: 0;
}

@media (min-width: 1024px) {
  .content-wrapper {
    height: calc(100dvh - var(--header-height, 56px));
    overflow: hidden;
  }
}

/* Нижний «воздух» на мобильных: плавающая панель (~72px) +
   нижняя навигация + safe-area + зазор */
@media (max-width: 1023.98px) {
  .main-content {
    padding-bottom: calc(var(--mobile-nav-height, 60px) + var(--safe-area-bottom, 0px) + 84px);
  }
}

/* Sticky-подзаголовок: сразу под шапкой сайта (56px) + safe-area-top.
   На десктопе элемент static — top игнорируется */
.cart-header {
  top: calc(var(--header-height, 56px) + var(--safe-area-top, 0px));
}

/* ============================================
  ПРЕДУПРЕЖДЕНИЕ О КОЛИЧЕСТВЕ
============================================ */
.alert-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  background: color-mix(in oklab, var(--color-warning) 10%, transparent);
  color: var(--color-warning);
  border: 1px solid color-mix(in oklab, var(--color-warning) 25%, transparent);
}
/* ============================================
  ПЛАВАЮЩАЯ ПАНЕЛЬ ОФОРМЛЕНИЯ — самодостаточный класс:
  позиция, фон, видимость полностью здесь (карта z-index:
  панель 40 = нижняя навигация 40; они не пересекаются)
============================================ */
.mobile-checkout-button {
  position: fixed;
  left: 0;
  right: 0;
  /* Над нижней навигацией + safe-area жестовой полосы */
  bottom: calc(var(--mobile-nav-height, 60px) + var(--safe-area-bottom, 0px));
  z-index: 40;
  background: var(--color-base-100);
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--color-base-300);
  /* Только мобильные; на десктопе кнопка внутри checkout-карточки */
  display: none;
}

@media (max-width: 1023.98px) {
  .mobile-checkout-button {
    display: block;
  }
}

</style>

<script setup>
import { ref, onMounted } from 'vue'

const { t } = useI18n()
// Ссылки корзины сохраняют префикс локали
const localePath = useLocalePath()

const { $notify } = useNuxtApp()

//- Один вызов useCart. Header/MobileNavFooter автоимпортятся Nuxt.
//- Позиции списка — CartItemsList.vue, панель оформления —
//- CartCheckoutPanel.vue (компоненты сами читают useCart)
const {
  cartItems,
  total,
  totalItems,
  clearCart,
  applyPromoCode,
  hasOutOfStockItems,
  proceedToCheckout: cartCheckout,
} = useCart()
const { formatPrice } = useProductUtils()

//- ============================================
//- Состояние
//- ============================================
const isMounted = ref(false)
const isProcessing = ref(false)
//- Строка ввода промокода живёт в панели (v-model:promo-code); здесь —
//- применение и уведомления
const promoCode = ref('')

// formatPrice — единый из useProductUtils (без валюты; ₽ добавляется
// в шаблоне — аудит F13)

const goCatalog = () => navigateTo(localePath('/'))

//- ============================================
//- Действия
//- ============================================
const applyPromo = async (code) => {
  if (!code?.trim()) return

  try {
    isProcessing.value = true
    await applyPromoCode(code)
    $notify.success(t('cart.promoOk'))
    promoCode.value = ''
  } catch {
    $notify.error(t('cart.promoBad'))
  } finally {
    isProcessing.value = false
  }
}

const proceedToCheckout = async () => {
  try {
    isProcessing.value = true
    await cartCheckout()
    await navigateTo(localePath('/cart/checkout'))
  } catch {
    $notify.error(t('cart.orderError'))
  } finally {
    isProcessing.value = false
  }
}

//- ============================================
//- Lifecycle
//- ============================================
onMounted(() => {
  isMounted.value = true
  window.scrollTo(0, 0)
})

useHead(() => ({ title: t('cart.title') }))
</script>
