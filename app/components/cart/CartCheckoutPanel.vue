<!-- app/components/cart/CartCheckoutPanel.vue — карточка «Оформление
     заказа» в корзине (разбивка cart/index.vue, этап 6): итоги, промокод,
     доставка/оплата, кнопка. Кнопка видна на десктопе; на мобильных —
     плавающая панель страницы. -->
<template lang="pug">
.checkout-card.w-full(class="lg:top-4 lg:sticky")
  .card.bg-base-100.border.border-base-300.rounded-2xl.h-full.flex.flex-col
    .card-body.px-4.py-4.flex.flex-col.flex-1.overflow-y-auto.gap-4
      h2.text-lg.font-semibold.text-base-content(class="lg:text-xl")
        | {{ $t('cart.checkout') }}

      .space-y-2
        .flex.justify-between.text-sm
          span(class="text-base-content/65") {{ $t('cart.items', { n: totalItems }) }}
          span.font-medium {{ formatMoney(subtotal) }}

        .flex.justify-between.text-sm
          span(class="text-base-content/65") {{ $t('cart.delivery') }}
          span.font-medium {{ deliveryPrice === 0 ? $t('cart.free') : formatMoney(deliveryPrice) }}

        .flex.justify-between.text-sm(v-if="discount > 0")
          span(class="text-base-content/65") {{ $t('cart.discount') }}
          span.font-medium.text-error -{{ formatMoney(discount) }}

        .flex.justify-between.items-baseline.pt-3.border-t.border-base-300
          span.text-base.font-semibold {{ $t('cart.total') }}
          span.text-2xl.font-bold.text-base-content {{ formatMoney(total) }}

      .form-control
        .join.w-full
          input.input.input-bordered.join-item.flex-grow.rounded-l-xl.text-base(
            type="text"
            :placeholder="$t('cart.promoPlaceholder')"
            autocomplete="off"
            v-model="promoCode"
            @keyup.enter="applyPromo"
          )
          button.btn.btn-primary.join-item.rounded-r-xl(
            type="button"
            :disabled="!promoCode.trim() || isProcessing"
            class="px-4"
            @click="applyPromo"
          )
            span(v-if="!isProcessing") {{ $t('cart.apply') }}
            span.loading.loading-spinner.loading-sm(v-else)

      .form-control
        label.label.p-0.mb-2
          span.label-text.font-medium.text-sm {{ $t('cart.deliveryMethod') }}
        //- Две колонки на всех экранах (и на телефоне):
        //- по 2 плитки в блоке — одна колонка выглядела пусто
        .grid.grid-cols-2.gap-2
          label.option-tile(
            :class="{ 'option-tile-active': selectedDelivery === 'courier' }"
          )
            input.radio.radio-sm(
              type="radio"
              name="delivery"
              value="courier"
              v-model="selectedDelivery"
            )
            .flex-grow
              .font-medium.text-sm {{ $t('cart.courier') }}
              .text-xs(class="text-base-content/65") {{ $t('cart.courierEta', { price: courierPrice === 0 ? $t('cart.free').toLowerCase() : formatMoney(courierPrice) }) }}

          label.option-tile(
            :class="{ 'option-tile-active': selectedDelivery === 'pickup' }"
          )
            input.radio.radio-sm(
              type="radio"
              name="delivery"
              value="pickup"
              v-model="selectedDelivery"
            )
            .flex-grow
              .font-medium.text-sm {{ $t('cart.pickup') }}
              .text-xs(class="text-base-content/65") {{ $t('cart.pickupEta') }}

      .form-control
        label.label.p-0.mb-2
          span.label-text.font-medium.text-sm {{ $t('cart.paymentMethod') }}
        .grid.grid-cols-2.gap-2
          label.option-tile(
            :class="{ 'option-tile-active': selectedPayment === 'card' }"
          )
            input.radio.radio-sm(
              type="radio"
              name="payment"
              value="card"
              v-model="selectedPayment"
            )
            .flex-grow
              .font-medium.text-sm {{ $t('cart.card') }}
              .text-xs(class="text-base-content/65") {{ $t('cart.cardNote') }}

          label.option-tile(
            :class="{ 'option-tile-active': selectedPayment === 'cash' }"
          )
            input.radio.radio-sm(
              type="radio"
              name="payment"
              value="cash"
              v-model="selectedPayment"
            )
            .flex-grow
              .font-medium.text-sm {{ $t('cart.cash') }}
              .text-xs(class="text-base-content/65") {{ $t('cart.cashNote') }}

    .card-actions.px-4.py-3.mt-6.border-t.border-base-300(v-if="!isMobile")
      button.btn.btn-primary.btn-lg.w-full.rounded-xl(
        type="button"
        :disabled="isProcessing || hasOutOfStockItems"
        :class="{ 'btn-error': hasOutOfStockItems }"
        @click="proceedToCheckout"
      )
        template(v-if="!isProcessing")
          span {{ hasOutOfStockItems ? $t('cart.qtyProblems') : $t('cart.checkoutBtn') }}
        span.loading.loading-spinner(v-else)
</template>

<script setup>
// CartCheckoutPanel.vue — карточка оформления в корзине: итоги, промокод,
// способ доставки/оплаты, кнопка (разбивка cart/index.vue, этап 6).
// Состояние обработки и переход в чекаут — на странице (события
// applyPromo/checkout); промокод — v-model: страница чистит поле
// только при успехе, при ошибке текст остаётся для повтора.
import { getDeliveryPrice } from '@/utils/deliveryPrice'

defineProps({
  isProcessing: { type: Boolean, default: false },
  hasOutOfStockItems: { type: Boolean, default: false },
})
const emit = defineEmits(['applyPromo', 'checkout'])

const {
  subtotal,
  discount,
  total,
  totalItems,
  deliveryPrice,
  deliveryMethod,
  setDeliveryMethod,
} = useCart()
const { formatMoney, formatPrice } = useProductUtils()

// Локальный ввод промокода (применение — на странице)
const promoCode = defineModel('promoCode', { type: String, default: '' })

const applyPromo = () => emit('applyPromo', promoCode.value)
const proceedToCheckout = () => emit('checkout')

//- Способ доставки — из состояния корзины (единый источник с чекаутом);
//- v-model на радио пишет через setDeliveryMethod, выбор сразу виден
//- в чекауте (аудит F3)
const selectedDelivery = computed({
  get: () => deliveryMethod.value,
  set: (methodId) => setDeliveryMethod(methodId),
})
const selectedPayment = ref('card')

//- Цена курьера для плитки: считается именно по способу «курьер»,
//- а не по текущему выбору (раньше при самовывозе плитка курьера
//- показывала «бесплатно» — чужую цену)
const courierPrice = computed(() => getDeliveryPrice('courier', subtotal.value))

//- Кнопка оформления внутри карточки — только десктоп; на мобильных
//- плавающая панель страницы. Порог согласован с useMobileDetection (<1024)
const { isMobile } = useMobileDetection()
</script>

<style scoped>
/* ============================================
  ПЛИТКИ ВЫБОРА — «Способ доставки» / «Способ оплаты».
  Класс использовался в шаблоне, но стилей не имел вовсе:
  радио оказывалось на отдельной строке НАД названием, плитки
  сливались с карточкой, активное состояние никак не читалось.
  align-items: flex-start — радио на одной линии с названием.
============================================ */
.option-tile {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  min-width: 0;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-base-300);
  border-radius: 0.75rem;
  background: var(--color-base-100);
  cursor: pointer;
  transition:
    border-color var(--transition-fast, 0.15s),
    background var(--transition-fast, 0.15s);
}

.option-tile:hover {
  border-color: color-mix(in oklab, var(--color-primary) 45%, transparent);
}

/* Радио прижато к первой строке (названию), не сжимается текстом */
.option-tile input.radio {
  flex-shrink: 0;
  margin-top: 2px;
}

.option-tile-active {
  border-color: var(--color-primary);
  background: color-mix(in oklab, var(--color-primary) 8%, transparent);
}
</style>
