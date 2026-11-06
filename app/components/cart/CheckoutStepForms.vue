<!-- app/components/cart/CheckoutStepForms.vue — формы четырёх шагов
     оформления (контакты → доставка → оплата → подтверждение),
     разбивка checkout.vue, этап 6. Состояние формы принадлежит странице:
     orderForm/paymentData приходят через defineModel (мутации полей
     видны странице), errors/currentStep — пропсы только на чтение.
     Валидация, кнопки навигации и отправка заказа — на странице. -->
<template lang="pug">
//- Шаг 1: Контактная информация
div(v-if="currentStep === 1")
  .grid.grid-cols-1.gap-3(class="sm:grid-cols-2")
    .form-control
      label.label.block.text-base-content.font-bold.py-0
        span.label-text.text-xs(class="lg:text-sm") {{ $t('checkout.name') }}
      input.input.input-bordered.input-sm(
        type="text"
        v-model="orderForm.firstName"
        :placeholder="$t('checkout.namePh')"
        autocomplete="given-name"
        :class="{ 'input-error': errors.firstName }"
        class="lg:input-md"
      )
      .label.py-0(v-if="errors.firstName")
        span.label-text-alt.text-error(class="text-[0.65rem]") {{ errors.firstName }}

    .form-control
      label.label.block.text-base-content.font-bold.py-0
        span.label-text.text-xs(class="lg:text-sm") {{ $t('checkout.lastName') }}
      input.input.input-bordered.input-sm(
        type="text"
        v-model="orderForm.lastName"
        :placeholder="$t('checkout.lastNamePh')"
        autocomplete="family-name"
        :class="{ 'input-error': errors.lastName }"
        class="lg:input-md"
      )
      .label.py-0(v-if="errors.lastName")
        span.label-text-alt.text-error(class="text-[0.65rem]") {{ errors.lastName }}

    .form-control(class="sm:col-span-2")
      label.label.block.text-base-content.font-bold.py-0
        span.label-text.text-xs(class="lg:text-sm") Email *
      input.input.input-bordered.input-sm(
        type="email"
        v-model="orderForm.email"
        placeholder="your@email.com"
        autocomplete="email"
        inputmode="email"
        :class="{ 'input-error': errors.email }"
        class="lg:input-md"
      )
      .label.py-0(v-if="errors.email")
        span.label-text-alt.text-error(class="text-[0.65rem]") {{ errors.email }}

    .form-control(class="sm:col-span-2")
      label.label.block.text-base-content.font-bold.py-0
        span.label-text.text-xs(class="lg:text-sm") {{ $t('checkout.phone') }}
      input.input.input-bordered.input-sm.text-base(
        type="tel"
        v-model="orderForm.phone"
        placeholder="+7 (XXX) XXX-XX-XX"
        autocomplete="tel"
        inputmode="tel"
        :class="{ 'input-error': errors.phone }"
        class="lg:input-md"
      )
      .label.py-0(v-if="errors.phone")
        span.label-text-alt.text-error(class="text-[0.65rem]") {{ errors.phone }}

//- Шаг 2: Доставка
div(v-if="currentStep === 2")
  .grid.grid-cols-1.gap-3(class="lg:grid-cols-3")
    label.card.cursor-pointer.border-2.transition-all.duration-200.rounded-xl(
      v-for="method in deliveryMethods"
      :key="method.id"
      :class="orderForm.deliveryMethod === method.id ? 'border-primary bg-primary/20' : 'border-base-300 hover:border-base-400'"
    )
      .card-body.p-3
        input.radio.radio-primary.absolute.right-2.top-2.radio-sm(
          type="radio"
          name="delivery"
          :value="method.id"
          v-model="orderForm.deliveryMethod"
        )
        .flex.items-center.gap-2.mb-1
          .w-6.h-6.flex.items-center.justify-center.rounded-full.bg-base-200
            span.text-sm(v-if="method.id === 'courier'") 🚚
            span.text-sm(v-else-if="method.id === 'pickup'") 📍
            span.text-sm(v-else) 📮
          .flex-1
            .font-bold.text-sm {{ $t(method.nameKey) }}
            span.text-base-content(class="opacity-70 text-[0.65rem]") {{ $t(method.descriptionKey) }}
        .mt-1.text-right
          .text-sm.font-bold {{ methodPrice(method.id) === 0 ? $t('cart.free') : $t('checkout.plus', { price: formatPrice(methodPrice(method.id)) }) }}

  //- Адрес доставки (для курьера и почты)
  .mt-4(v-if="orderForm.deliveryMethod === 'courier' || orderForm.deliveryMethod === 'post'")
    h3.text-md.font-bold.mb-2(class="lg:text-lg") {{ orderForm.deliveryMethod === 'post' ? $t('checkout.addressPost') : $t('checkout.addressDelivery') }}

    .grid.grid-cols-1.gap-3(class="lg:grid-cols-2")
      .form-control(class="lg:col-span-2")
        label.label.py-0
          span.label-text.pr-2.text-xs(class="lg:text-sm") {{ $t('checkout.address') }}
        input.input.input-bordered.input-sm(
          type="text"
          v-model="orderForm.address"
          autocomplete="street-address"
          :placeholder="orderForm.deliveryMethod === 'post' ? $t('checkout.addressPostPh') : $t('checkout.addressPh')"
          :class="{ 'input-error': errors.address }"
          class="lg:input-md"
        )
        .label.py-0(v-if="errors.address")
          span.label-text-alt.text-error(class="text-[0.65rem]") {{ errors.address }}

      .form-control
        label.label.py-0
          span.label-text.pr-2.text-xs(class="lg:text-sm") {{ $t('checkout.city') }}
        input.input.input-bordered.input-sm(
          type="text"
          v-model="orderForm.city"
          autocomplete="address-level2"
          :placeholder="$t('checkout.cityPh')"
          :class="{ 'input-error': errors.city }"
          class="lg:input-md"
        )
        .label.py-0(v-if="errors.city")
          span.label-text-alt.text-error(class="text-[0.65rem]") {{ errors.city }}

      .form-control
        label.label.py-0
          span.label-text.pr-2.text-xs(:class="orderForm.deliveryMethod === 'post' ? 'lg:text-sm font-semibold' : 'lg:text-sm'") {{ orderForm.deliveryMethod === 'post' ? $t('checkout.zip') : $t('checkout.zipOptional') }}
        input.input.input-bordered.input-sm(
          type="text"
          v-model="orderForm.postalCode"
          autocomplete="postal-code"
          inputmode="numeric"
          :placeholder="$t('checkout.zipPh')"
          maxlength="6"
          :class="{ 'input-error': errors.postalCode }"
          class="lg:input-md"
        )
        .label.py-0(v-if="errors.postalCode")
          span.label-text-alt.text-error(class="text-[0.65rem]") {{ errors.postalCode }}

//- Шаг 3: Оплата
div(v-if="currentStep === 3")
  .grid.grid-cols-1.gap-3(class="lg:grid-cols-2")
    label.card.cursor-pointer.border-2.transition-all.duration-200.rounded-xl(
      v-for="method in paymentMethods"
      :key="method.id"
      :class="orderForm.paymentMethod === method.id ? 'border-primary bg-primary/20' : 'border-base-300 hover:border-base-400'"
    )
      .card-body.p-3
        input.radio.radio-primary.absolute.right-2.top-2.radio-sm(
          type="radio"
          name="payment"
          :value="method.id"
          v-model="orderForm.paymentMethod"
        )
        .flex.items-center.gap-2.mb-1
          .w-6.h-6.flex.items-center.justify-center.rounded-full.bg-base-200
            span.text-sm {{ method.icon }}
          .flex-1
            .font-bold.text-sm {{ $t(method.nameKey) }}
            span.text-base-content(class="opacity-70 text-[0.65rem]") {{ $t(method.descriptionKey) }}

  //- Данные карты.
  //- ⚠️ ЗАГЛУШКА: поля визуальные, данные НЕ покидают браузер
  //- и НЕ отправляются на сервер (PCI DSS). Реальная оплата —
  //- задача платёжного эквайринга, а не собственной формы.
  .mt-4(v-if="orderForm.paymentMethod === 'card'")
    .card.bg-base-200.border.border-base-300
      .card-body.p-4
        h3.text-md.font-bold.mb-2(class="lg:text-lg") {{ $t('checkout.cardData') }}
        p.text-xs.mb-3(class="text-base-content/60")
          | {{ $t('checkout.cardNote') }}

        .grid.grid-cols-1.gap-3(class="lg:grid-cols-2")
          .form-control(class="lg:col-span-2")
            label.label.py-0
              span.label-text.pr-2.text-xs(class="lg:text-sm") {{ $t('checkout.cardNumber') }}
            input.input.input-bordered.input-sm(
              type="text"
              v-model="paymentData.cardNumber"
              placeholder="0000 0000 0000 0000"
              maxlength="19"
              inputmode="numeric"
              autocomplete="off"
              class="lg:input-md"
            )

          .form-control
            label.label.py-0
              span.label-text.pr-2.text-xs(class="lg:text-sm") {{ $t('checkout.cardExpiry') }}
            input.input.input-bordered.input-sm(
              type="text"
              v-model="paymentData.expiryDate"
              placeholder="MM/YY"
              maxlength="5"
              inputmode="numeric"
              autocomplete="off"
              class="lg:input-md"
            )

          .form-control
            label.label.py-0
              span.label-text.pr-2.text-xs(class="lg:text-sm") CVV/CVC
            input.input.input-bordered.input-sm(
              type="password"
              v-model="paymentData.cvv"
              placeholder="•••"
              maxlength="3"
              inputmode="numeric"
              autocomplete="off"
              class="lg:input-md"
            )

  //- Перевод (Куба: Transfermóvil/EnZona): у каждого магазина свои
  //- номер/QR — реквизиты менеджер отправит после подтверждения заказа
  .mt-4(v-if="orderForm.paymentMethod === 'transfer'")
    .card.bg-base-200.border.border-base-300
      .card-body.p-4
        h3.text-md.font-bold.mb-2(class="lg:text-lg") {{ $t('checkout.payTransfer') }}
        p.text-xs(class="text-base-content/60")
          | {{ $t('checkout.transferNote') }}

//- Шаг 4: Подтверждение
div(v-if="currentStep === 4")
  .grid.grid-cols-1.gap-3(class="lg:grid-cols-2")
    .card.bg-base-200.p-3
      h3.text-md.font-bold.mb-1(class="lg:text-lg") {{ $t('checkout.contactInfo') }}
      .space-y-1
        p.font-medium.text-sm {{ orderForm.firstName || '—' }} {{ orderForm.lastName || '—' }}
        p.text-sm(class="text-base-content/70") {{ orderForm.email || '—' }}
        p.text-sm(class="text-base-content/70") {{ orderForm.phone || '—' }}

    .card.bg-base-200.p-3(v-if="orderForm.deliveryMethod === 'courier' || orderForm.deliveryMethod === 'post'")
      h3.text-md.font-bold.mb-1(class="lg:text-lg") {{ orderForm.deliveryMethod === 'post' ? $t('checkout.addressPostColon') : $t('checkout.addressDeliveryColon') }}
      .space-y-1
        p.font-medium.text-sm {{ orderForm.city || '—' }}, {{ orderForm.address || '—' }}
        p.text-sm(class="text-base-content/70" v-if="orderForm.postalCode") {{ $t('checkout.zipLine', { code: orderForm.postalCode }) }}
        p.text-sm(class="text-base-content/70") {{ deliveryMethods.find(m => m.id === orderForm.deliveryMethod)?.name }}

    .card.bg-base-200.p-3(v-else-if="orderForm.deliveryMethod === 'pickup'")
      h3.text-md.font-bold.mb-1(class="lg:text-lg") {{ $t('checkout.deliveryMethodTitle') }}
      .space-y-1
        p.font-medium.text-sm {{ deliveryMethods.find(m => m.id === orderForm.deliveryMethod)?.name }}
        p.text-sm(class="text-base-content/70") {{ deliveryMethods.find(m => m.id === orderForm.deliveryMethod)?.description }}

    .card.bg-base-200.p-3(class="lg:col-span-2")
      h3.text-md.font-bold.mb-1(class="lg:text-lg") {{ $t('checkout.paymentMethodTitle') }}
      .flex.items-center.gap-2
        .w-6.h-6.flex.items-center.justify-center.rounded-full.bg-base-300
          span.text-sm {{ paymentMethods.find(m => m.id === orderForm.paymentMethod)?.icon }}
        div
          .font-medium.text-sm {{ paymentMethods.find(m => m.id === orderForm.paymentMethod)?.name }}
          p.text-sm(class="text-base-content/70") {{ paymentMethods.find(m => m.id === orderForm.paymentMethod)?.description }}
</template>

<script setup>
defineProps({
  currentStep: { type: Number, required: true },
  errors: { type: Object, default: () => ({}) },
})

// defineModel: страница владеет формой (v-model:order-form / :payment-data);
// мутации вложенных полей меняют общий реактивный объект — отдельного
// события не требуется
const orderForm = defineModel('orderForm', { type: Object, required: true })
const paymentData = defineModel('paymentData', { type: Object, required: true })

import { getDeliveryPrice } from '@/utils/deliveryPrice'
// Способы оплаты — из конфига витрины (см. store.config.ts)
import { STORE_PAYMENT_METHODS } from '../../../store.config'

const { formatPrice } = useProductUtils()
const { subtotal } = useCart()

//- Методы доставки. Цен НЕ храним: она считается по единому модулю
//- app/utils/deliveryPrice.ts (зеркало server/lib/orderHelpers.ts) от
//- суммы корзины — курьер становится бесплатным от порога так же,
//- как в корзине (аудит F3: у одной закупки была одна сумма в корзине
//- и другая в чекауте)
const deliveryMethods = [
  { id: 'courier', nameKey: 'checkout.deliveryCourier', descriptionKey: 'checkout.deliveryCourierDesc' },
  { id: 'pickup', nameKey: 'checkout.deliveryPickup', descriptionKey: 'checkout.deliveryPickupDesc' },
  { id: 'post', nameKey: 'checkout.deliveryPost', descriptionKey: 'checkout.deliveryPostDesc' },
]

//- Цена конкретного способа для плиток шага «Доставка»
const methodPrice = (methodId) => getDeliveryPrice(methodId, subtotal.value)

//- Способы оплаты — список из store.config (STORE_PAYMENT_METHODS):
//- что видит покупатель И что валидирует сервер. Подписи/иконки — META по id.
const PAYMENT_META = {
  card: { icon: '💳', nameKey: 'checkout.payCard', descriptionKey: 'checkout.payCardDesc' },
  cash: { icon: '💵', nameKey: 'checkout.payCash', descriptionKey: 'checkout.payCashDesc' },
  transfer: { icon: '📲', nameKey: 'checkout.payTransfer', descriptionKey: 'checkout.payTransferDesc' },
}
const paymentMethods = STORE_PAYMENT_METHODS.map((id) => ({ id, ...PAYMENT_META[id] }))
</script>
