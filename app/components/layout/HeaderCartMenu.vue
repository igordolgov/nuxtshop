<!-- app/components/layout/HeaderCartMenu.vue — мини-корзина в шапке
     (десктоп ≥1024px, разбивка Header.vue по паттерну HeaderUserMenu).
     Пустая корзина (и SSR до гидратации) — обычная ссылка на /cart;
     с товарами клик открывает дропдаун: позиции с миниатюрами,
     счётчики количества, удаление, сумма и две CTA («Корзина»,
     «Оформить заказ») — паттерн Amazon/WB: состав корзины виден без
     перехода. На мобильных корзина живёт в нижнем меню — дропдаун не
     рендерится (компонент стоит в блоке .hidden.lg:block шапки).
     Открытие/закрытие, клик-аутсайд, Escape, смена маршрута — здесь;
     шапка решает только, где компонент стоит. -->
<template lang="pug">
.relative(ref="cartMenuRef")
  //- ДО гидратации / пустая корзина: обычная ссылка на /cart (SSR-дружелюбно,
  //- работает до JS). Отдельная ветка — принципиально: у NuxtLink собственный
  //- click-хендлер RouterLink, preventDefault в пользовательском @click не
  //- отменяет навигацию (хендлеры мержатся, порядок не гарантирован) —
  //- раньше это открывало панель и тут же уводило на /cart, размонтируя её.
  NuxtLink.btn.btn-ghost.btn-circle(
    v-if="!cartMode"
    :to="localePath('/cart')"
    :aria-label="$t('nav.cart')"
    class="w-11 h-11 min-h-0"
  )
    svg.h-5.w-5(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="text-base-content/85" stroke-width="1.75")
      path(stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z")

  //- Товары в корзине: кнопка открывает дропдаун (это <button>, не ссылка —
  //- никакого побочного перехода; Ctrl/Cmd-клик не нужен: страница /cart
  //- достижима из панели и из пустого состояния)
  button.btn.btn-ghost.btn-circle(
    v-else
    type="button"
    :aria-expanded="isCartMenuOpen"
    aria-controls="header-mini-cart"
    aria-haspopup="dialog"
    :aria-label="$t('nav.cart')"
    class="w-11 h-11 min-h-0"
    @click="toggleCartMenu"
  )
    svg.h-5.w-5(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="text-base-content/85" stroke-width="1.75")
      path(stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z")
    span.badge.badge-xs.badge-primary.mini-cart-badge.absolute.top-2.right-2.indicator-item.rounded-full.px-1.count-pop(
      :key="totalItems"
    ) {{ totalItems }}

  //- Дропдаун мини-корзины
  .absolute.top-full.right-0.mt-2.z-50(
    v-show="isCartMenuOpen"
    id="header-mini-cart"
    class="bg-base-100 shadow-lg border border-base-300 rounded-2xl w-96 max-w-[calc(100vw-2rem)]"
    role="dialog"
    :aria-label="$t('nav.cart')"
  )
    //- Заголовок: «N товаров» (мн. число — словарь cart.itemsCount)
    .flex.items-center.justify-between.px-4.py-3.border-b(class="border-base-300")
      span.font-semibold.text-sm.text-base-content {{ $t('cart.itemsCount', { n: totalItems }) }}
      button.btn.btn-ghost.btn-xs.btn-circle(
        type="button"
        :aria-label="$t('common.close')"
        @click="closeCartMenu"
      )
        svg.w-4.h-4(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
          path(stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12")

    //- Позиции (внутренний скролл: сколько бы ни было — панель не разъезжается)
    //- overscroll-contain: доскроллили список — страница за дропдауном
    //- не уезжает (тот же случай, что список характеристик в админке)
    .mini-cart-list.overflow-y-auto.px-2(
      class="max-h-80 divide-y divide-base-300 overscroll-contain"
    )
      .flex.gap-3.py-3(
        v-for="item in cartItems"
        :key="item.id"
      )
        //- 56px: резерв места до загрузки (width/height), ошибка → плейсхолдер.
        //- Без lazy: дропдаун скрыт через v-show, ленивые миниатюры
        //- грузились в момент открытия и мигали
        NuxtImg.flex-shrink-0.w-14.h-14.rounded-lg.bg-base-200.object-cover(
          :src="item.image || '/images/placeholder.jpg'"
          :alt="displayName(item)"
          width="56"
          height="56"
          decoding="async"
          @error="handleImageError"
        )
        .flex-grow.min-w-0
          button.w-full.text-left.cursor-pointer.line-clamp-2.text-sm.font-medium.transition-colors(
            type="button"
            class="hover:text-primary text-base-content"
            :title="displayName(item)"
            @click="goToProduct(item)"
          ) {{ displayName(item) }}
          .text-xs(class="mt-0.5 text-base-content/70" v-if="item.variantName")
            | {{ item.variantName }}
          .flex.items-center.justify-between.mt-2.gap-2
            .flex.items-center.gap-1
              button.qty-btn(
                type="button"
                :aria-label="$t('cart.decrease')"
                :disabled="item.quantity <= 1"
                @click="updateQuantity(item.id, item.quantity - 1)"
              ) –
              span.text-sm.font-semibold.min-w-6.text-center(
                class="px-1.5"
                :class="{ 'text-warning': item.quantity > getMaxQuantity(item) }"
              ) {{ item.quantity }}
              button.qty-btn(
                type="button"
                :aria-label="$t('cart.increase')"
                :disabled="item.quantity >= getMaxQuantity(item)"
                @click="updateQuantity(item.id, item.quantity + 1)"
              ) +
            .flex.items-center.gap-1.shrink-0
              span.text-sm.font-semibold {{ formatMoney(item.currentPrice * item.quantity) }}
              button.transition-colors(
                type="button"
                :aria-label="$t('cart.remove')"
                :title="$t('cart.remove')"
                class="text-base-content/45 hover:text-error"
                @click="removeFromCart(item.id)"
              )
                svg.w-4.h-4(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                  path(stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12")

    //- Предупреждение о превышении остатка (позиция есть — количество нет)
    .px-4.py-2.text-xs.text-warning.border-t(
      v-if="hasOutOfStockItems"
      class="border-base-300"
    ) {{ $t('cart.qtyWarning') }}

    //- Итог + CTA
    .px-4.py-3.border-t.space-y-2(class="border-base-300")
      .flex.items-center.justify-between.text-sm
        span(class="text-base-content/75") {{ $t('cart.subtotal') }}
        span.font-semibold {{ formatMoney(subtotal) }}
      .flex.gap-2
        button.btn.btn-outline.btn-sm.mini-cart-go-cart.flex-1.rounded-xl(
          type="button"
          @click="goToCart"
        ) {{ $t('nav.cart') }}
        button.btn.btn-primary.btn-sm.mini-cart-go-checkout.flex-1.rounded-xl(
          type="button"
          :disabled="isProcessing"
          @click="goToCheckout"
        ) {{ $t('cart.checkoutBtn') }}
</template>

<script setup>
// HeaderCartMenu.vue — данные composables берёт из useCart/useAppState
// (как CartItemsList): актуальные имена позиций — из живого каталога,
// снапшот — фолбэк; лимиты количества — getMaxQuantity.
import { parseCartLineId } from '@/utils/productVariants'

const route = useRoute()
const localePath = useLocalePath()
const { $notify } = useNuxtApp()
const { t } = useI18n()

const { cartItems, subtotal, totalItems, hasOutOfStockItems, isProcessing, updateItemQuantity, removeFromCart, getMaxQuantity, getProductUrl, proceedToCheckout } = useCart()

const appState = useAppState()
const { loc } = useLocalizedProduct()
const { formatMoney } = useProductUtils()

//- Гидратация: SSR не знает localStorage — первый кадр обязан совпасть
//- («ссылка на корзину»), дропдаун-режим включается после монтирования
const isHydrated = ref(false)
onMounted(() => {
  isHydrated.value = true
})

//- Режим «кнопка с дропдауном»: гидратировались и в корзине есть товары.
//- В остальных случаях — обычная ссылка на /cart (см. шаблон)
const cartMode = computed(() => isHydrated.value && cartItems.value.length > 0)

//- Открытие/закрытие: клик-аутсайд, Escape, смена маршрута — тот же
//- контракт, что у HeaderUserMenu/HeaderMobileMenu
const isCartMenuOpen = ref(false)
const cartMenuRef = ref(null)

const closeCartMenu = () => {
  isCartMenuOpen.value = false
}
const toggleCartMenu = () => {
  isCartMenuOpen.value = !isCartMenuOpen.value
}

const closeMenusOnClickOutside = (event) => {
  if (!import.meta.client) return
  if (isCartMenuOpen.value && !cartMenuRef.value?.contains(event.target)) closeCartMenu()
}

const onGlobalKeydown = (event) => {
  if (event.key === 'Escape') closeCartMenu()
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

//- Смена маршрута закрывает; корзина опустела (удалили всё в дропдауне) —
//- закрываем: пустая панель бессмысленна, ссылочный режим вернётся сам
watch(() => route.path, () => closeCartMenu())
watch(totalItems, (n) => {
  if (n === 0) closeCartMenu()
})

//- Актуальные имена: снапшот хранит язык момента добавления; живой каталог
//- локализован под текущую локаль (вариантные позиции — по голому productId)
const freshProductFor = (item) => {
  const { productId } = parseCartLineId(item?.id)
  return (
    appState.products.value?.find((p) => String(p.id) === String(productId)) ??
    null
  )
}
const displayName = (item) => {
  const fresh = freshProductFor(item)
  return fresh ? loc(fresh).name : (item?.name ?? '')
}

const handleImageError = (event) => {
  event.target.src = '/images/placeholder.jpg'
}

const updateQuantity = async (itemId, newQuantity) => {
  if (newQuantity < 1) return
  try {
    await updateItemQuantity(itemId, newQuantity)
  } catch (error) {
    $notify.error(error.message || t('cart.qtyUpdateError'))
  }
}

const goToProduct = (item) => {
  // id позиций — «productId::variantId»: URL строим по голому productId
  const { productId } = parseCartLineId(item?.id)
  navigateTo(getProductUrl({ ...item, id: productId }))
  closeCartMenu()
}

const goToCart = () => {
  closeCartMenu()
  navigateTo(localePath('/cart'))
}

const goToCheckout = async () => {
  closeCartMenu()
  await proceedToCheckout()
}
</script>

<style scoped>
/* Кнопки количества — компактнее, чем на странице корзины (32px):
   дропдаун плотный, шаг «±» и так под курсором */
.qty-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  border: 1px solid var(--color-base-300);
  background: transparent;
  color: var(--color-base-content);
  font-size: 0.875rem;
  line-height: 1;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.qty-btn:hover:not(:disabled) {
  background: var(--color-base-200);
}

.qty-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
