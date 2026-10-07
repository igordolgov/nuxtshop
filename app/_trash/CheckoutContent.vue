<!-- components/checkout/CheckoutContent.vue -->
<template lang="pug">
.container.mx-auto(class="sm:ml-17")
  //- Хлебные крошки (только для мобильных)
  .fixed.top-13.left-1.right-0.z-50.bg-base-100.border-b.border-base-300.shadow-sm(class="sm:ml-17 lg:hidden")
    .container.mx-auto.p-1
      nav.breadcrumbs.text-sm.overflow-x-auto.whitespace-nowrap(class="text-base-content/70" aria-label="Хлебные крошки")
        ul.flex
          li
            NuxtLink.link.link-hover(to="/" prefetch) Главная
          li
            span Корзина покупок

  //- ГОРИЗОНТАЛЬНЫЕ ШАГИ - исправлено вертикальное центрирование
  .steps-horizontal-wrapper.card.bg-base-100.shadow-lg.mb-0.mt-10(class="lg:mt-0 lg:mb-6")
    .card-body.p-2.w-full.flex.items-center.justify-center(class="lg:p-4")
      .flex.items-center.justify-center.steps-container
        .step-horizontal.flex.items-center.text-center.mx-1(
          v-for="(step, index) in checkoutSteps" 
          :key="index"
          :class="{ 'step-active': currentStep === index + 1, 'step-completed': currentStep > index + 1 }" )
          .step-content.flex.flex-col.items-center.px-1
            .step-number.mb-1(:class="{ 'bg-primary text-white': currentStep >= index + 1, 'bg-base-300': currentStep < index + 1 }") {{ index + 1 }}
            span.step-name.text-3xs.whitespace-normal.break-words.text-center(class="lg:text-sm lg:font-medium") {{ step.name }}
          .step-connector(v-if="index < checkoutSteps.length - 1")

  //- Основная сетка
  .grid.grid-cols-1.gap-2(class="lg:grid-cols-3 lg:gap-6")
    //- Левая колонка - Товары и итоги (только десктоп)
    .checkout-sticky-sidebar.hidden(class="lg:block lg:col-span-1")
      .sticky.top-24.space-y-4
        //- Хлебные крошки для десктопа
        nav.breadcrumbs.text-sm.overflow-x-auto.whitespace-nowrap.mb-2(class="text-base-content/70")
          ul.flex
            li
              NuxtLink.link.link-hover(to="/" prefetch) Главная
            li
              span Корзина покупок

        //- Карточка с товарами в заказе
        .card.bg-base-100.shadow-lg
          .card-body.p-3
            h2.card-title.text-md.mb-2(class="lg:text-lg") Товары в заказе
            template(v-if="cartItems.length > 0")
              .max-h-80.overflow-y-auto
                .space-y-2
                  .flex.items-center.gap-2.p-2.rounded-lg.bg-base-200(
                    v-for="item in cartItems"
                    :key="item.id"
                  )
                    .avatar.flex-shrink-0
                      .w-10.h-10.rounded
                        NuxtImg(
                          :src="getSafeImage(item.image)" 
                          :alt="item.name" 
                          class="object-cover"
                          fetchpriority="high"
                        )
                    .flex-1.min-w-0
                      .font-medium.text-xs.truncate {{ item.name }}
                      .flex.items-center.justify-between.mt-1
                        .text-2xs.text-base-content.opacity-70 {{ formatPrice(item.currentPrice) }} ₽ × {{ item.quantity }}
                        .font-bold.text-xs {{ formatPrice(item.currentPrice * item.quantity) }} ₽
            template(v-else)
              .text-xs.text-center.py-4(class="text-base-content/70") Корзина пуста

            .mt-2.pt-2.border-t.border-base-300
              .space-y-1
                .flex.justify-between.text-xs
                  span Товары ({{ totalItems }})
                  span.font-medium {{ formatPrice(subtotal) }} ₽
                .flex.justify-between.text-xs(v-if="discount > 0")
                  span Скидка
                  span.text-error.font-medium -{{ formatPrice(discount) }} ₽
                .flex.justify-between.text-xs
                  span Доставка
                  span.font-medium {{ selectedDeliveryPrice === 0 ? 'Бесплатно' : formatPrice(selectedDeliveryPrice) + ' ₽' }}
                .divider.my-1
                .flex.justify-between.text-base.font-bold.text-sky-600
                  span Итого
                  span {{ formatPrice(finalTotal) }} ₽

    //- Правая колонка - Форма оформления - исправлено прикрепление кнопок
    .checkout-form.flex.flex-col(class="lg:col-span-2")
      .card.bg-base-100.shadow-xl.flex-1.flex.flex-col.h-full
        .card-body.p-2.pt-4.flex.flex-col.h-full(class="lg:p-6 lg:pt-6")
          //- Заголовок текущего шага
          h1.card-title.text-lg.mb-3(class="lg:text-2xl lg:mb-4") {{ checkoutSteps[currentStep - 1]?.title }}
          
          //- Контент формы - flex grow
          .step-content.flex-1.overflow-y-auto
            //- Шаг 1: Контактная информация
            div(v-if="currentStep === 1")
              .grid.grid-cols-1.gap-3(class="sm:grid-cols-2")
                .form-control
                  label.label.block.text-base-content.font-bold.py-0
                    span.label-text.text-xs(class="lg:text-sm") Имя *
                  input.input.input-bordered.input-sm(
                    type="text"
                    v-model="orderForm.firstName"
                    placeholder="Введите имя"
                    :class="{ 'input-error': errors.firstName }"
                    class="lg:input-md"
                  )
                  .label.py-0(v-if="errors.firstName")
                    span.label-text-alt.text-error.text-2xs {{ errors.firstName }}

                .form-control
                  label.label.block.text-base-content.font-bold.py-0
                    span.label-text.text-xs(class="lg:text-sm") Фамилия *
                  input.input.input-bordered.input-sm(
                    type="text"
                    v-model="orderForm.lastName"
                    placeholder="Введите фамилию"
                    :class="{ 'input-error': errors.lastName }"
                    class="lg:input-md"
                  )
                  .label.py-0(v-if="errors.lastName")
                    span.label-text-alt.text-error.text-2xs {{ errors.lastName }}

                .form-control(class="sm:col-span-2")
                  label.label.block.text-base-content.font-bold.py-0
                    span.label-text.text-xs(class="lg:text-sm") Email *
                  input.input.input-bordered.input-sm(
                    type="email"
                    v-model="orderForm.email"
                    placeholder="your@email.com"
                    :class="{ 'input-error': errors.email }"
                    class="lg:input-md"
                  )
                  .label.py-0(v-if="errors.email")
                    span.label-text-alt.text-error.text-2xs {{ errors.email }}

                .form-control(class="sm:col-span-2")
                  label.label.block.text-base-content.font-bold.py-0
                    span.label-text.text-xs(class="lg:text-sm") Телефон *
                  input.input.input-bordered.input-sm(
                    type="tel"
                    v-model="orderForm.phone"
                    placeholder="+7 (XXX) XXX-XX-XX"
                    :class="{ 'input-error': errors.phone }"
                    class="lg:input-md"
                  )
                  .label.py-0(v-if="errors.phone")
                    span.label-text-alt.text-error.text-2xs {{ errors.phone }}

            //- Шаг 2: Доставка
            div(v-if="currentStep === 2")
              .grid.grid-cols-1.gap-3(class="lg:grid-cols-3")
                label.card.cursor-pointer.border-2.transition-all.duration-200(
                  v-for="method in deliveryMethods"
                  :key="method.id"
                  :class="orderForm.deliveryMethod === method.id ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-base-400'"
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
                        .font-bold.text-sm {{ method.name }}
                        .text-2xs.text-base-content/70 {{ method.description }}
                    .mt-1.text-right
                      .text-sm.font-bold {{ method.price === 0 ? 'Бесплатно' : `+${formatPrice(method.price)}` }}

              //- Адрес доставки
              .mt-4(v-if="orderForm.deliveryMethod === 'courier'")
                h3.text-md.font-bold.mb-2(class="lg:text-lg") Адрес доставки
                
                .grid.grid-cols-1.gap-3(class="lg:grid-cols-2")
                  .form-control(class="lg:col-span-2")
                    label.label.py-0
                      span.label-text.text-xs(class="lg:text-sm") Адрес *
                    input.input.input-bordered.input-sm(
                      type="text"
                      v-model="orderForm.address"
                      placeholder="Улица, дом, квартира"
                      :class="{ 'input-error': errors.address }"
                      class="lg:input-md"
                    )
                    .label.py-0(v-if="errors.address")
                      span.label-text-alt.text-error.text-2xs {{ errors.address }}

                  .form-control
                    label.label.py-0
                      span.label-text.text-xs(class="lg:text-sm") Город *
                    input.input.input-bordered.input-sm(
                      type="text"
                      v-model="orderForm.city"
                      placeholder="Город"
                      :class="{ 'input-error': errors.city }"
                      class="lg:input-md"
                    )
                    .label.py-0(v-if="errors.city")
                      span.label-text-alt.text-error.text-2xs {{ errors.city }}

                  .form-control
                    label.label.py-0
                      span.label-text.text-xs(class="lg:text-sm") Индекс
                    input.input.input-bordered.input-sm(
                      type="text"
                      v-model="orderForm.postalCode"
                      placeholder="Почтовый индекс"
                      class="lg:input-md"
                    )

            //- Шаг 3: Оплата
            div(v-if="currentStep === 3")
              .grid.grid-cols-1.gap-3(class="lg:grid-cols-3")
                label.card.cursor-pointer.border-2.transition-all.duration-200(
                  v-for="method in paymentMethods"
                  :key="method.id"
                  :class="orderForm.paymentMethod === method.id ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-base-400'"
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
                        span.text-sm(v-if="method.id === 'card'") 💳
                        span.text-sm(v-else-if="method.id === 'cash'") 💵
                        span.text-sm(v-else) ₿
                      .flex-1
                        .font-bold.text-sm {{ method.name }}
                        .text-2xs.text-base-content/70 {{ method.description }}

              //- Данные карты (если выбран онлайн-платеж)
              .mt-4(v-if="orderForm.paymentMethod === 'card'")
                .card.bg-base-200.border.border-base-300
                  .card-body.p-4
                    h3.text-md.font-bold.mb-2(class="lg:text-lg") Данные банковской карты
                    
                    .grid.grid-cols-1.gap-3(class="lg:grid-cols-2")
                      .form-control(class="lg:col-span-2")
                        label.label.py-0
                          span.label-text.text-xs(class="lg:text-sm") Номер карты
                        input.input.input-bordered.input-sm(
                          type="text"
                          v-model="paymentData.cardNumber"
                          placeholder="0000 0000 0000 0000"
                          maxlength="19"
                          class="lg:input-md"
                        )

                      .form-control
                        label.label.py-0
                          span.label-text.text-xs(class="lg:text-sm") Срок действия
                        input.input.input-bordered.input-sm(
                          type="text"
                          v-model="paymentData.expiryDate"
                          placeholder="MM/YY"
                          maxlength="5"
                          class="lg:input-md"
                        )

                      .form-control
                        label.label.py-0
                          span.label-text.text-xs(class="lg:text-sm") CVV/CVC
                        input.input.input-bordered.input-sm(
                          type="text"
                          v-model="paymentData.cvv"
                          placeholder="123"
                          maxlength="3"
                          class="lg:input-md"
                        )

            //- Шаг 4: Подтверждение
            div(v-if="currentStep === 4")
              .grid.grid-cols-1.gap-3(class="lg:grid-cols-2")
                .card.bg-base-200.p-3
                  h3.text-md.font-bold.mb-1(class="lg:text-lg") Контактная информация
                  .space-y-1
                    p.font-medium.text-sm {{ orderForm.firstName || '—' }} {{ orderForm.lastName || '—' }}
                    p.text-2xs.text-base-content/70 {{ orderForm.email || '—' }}
                    p.text-2xs.text-base-content/70 {{ orderForm.phone || '—' }}

                .card.bg-base-200.p-3(v-if="orderForm.deliveryMethod === 'courier'")
                  h3.text-md.font-bold.mb-1(class="lg:text-lg") Адрес доставки
                  .space-y-1
                    p.font-medium.text-sm {{ orderForm.city || '—' }}, {{ orderForm.address || '—' }}
                    p.text-2xs.text-base-content/70(v-if="orderForm.postalCode") Индекс: {{ orderForm.postalCode }}
                    p.text-2xs.text-base-content/70 {{ deliveryMethods.find(m => m.id === orderForm.deliveryMethod)?.name }}

                .card.bg-base-200.p-3(v-else)
                  h3.text-md.font-bold.mb-1(class="lg:text-lg") Способ получения
                  .space-y-1
                    p.font-medium.text-sm {{ deliveryMethods.find(m => m.id === orderForm.deliveryMethod)?.name }}
                    p.text-2xs.text-base-content/70 {{ deliveryMethods.find(m => m.id === orderForm.deliveryMethod)?.description }}

                .card.bg-base-200.p-3(class="lg:col-span-2")
                  h3.text-md.font-bold.mb-1(class="lg:text-lg") Способ оплаты
                  .flex.items-center.gap-2
                    .w-6.h-6.flex.items-center.justify-center.rounded-full.bg-base-300
                      span.text-sm(v-if="orderForm.paymentMethod === 'card'") 💳
                      span.text-sm(v-else-if="orderForm.paymentMethod === 'cash'") 💵
                      span.text-sm(v-else) ₿
                    div
                      .font-medium.text-sm {{ paymentMethods.find(m => m.id === orderForm.paymentMethod)?.name }}
                      .text-2xs.text-base-content/70 {{ paymentMethods.find(m => m.id === orderForm.paymentMethod)?.description }}

          //- Кнопки навигации - прикреплены к низу
          .flex.justify-between.mt-4.pt-2.border-t.border-base-200.flex-shrink-0.sticky-navigation
            button.btn.btn-outline.btn-sm.rounded-lg(
              v-if="currentStep > 1"
              @click="previousStep"
              class="lg:btn-md lg:min-w-28"
            ) Назад
            .flex-1(v-if="currentStep > 1")
            button.btn.btn-primary.btn-sm.rounded-lg(
              v-if="currentStep < 4"
              @click="nextStep"
              :disabled="!isStepValid"
              class="lg:btn-md lg:min-w-40"
            ) Продолжить
            
            button.btn.btn-success.btn-sm.rounded-lg(
              v-if="currentStep === 4"
              @click="placeOrder"
              :disabled="isProcessing"
              class="lg:btn-md lg:min-w-56"
            )
              span(v-if="!isProcessing" class="lg:text-base") Подтвердить заказ
              span.loading.loading-spinner.loading-sm(v-else class="lg:loading-md")

    //- Карточка с товарами для мобильных (под формой)
    .mt-2(class="lg:hidden")
      .card.bg-base-100.shadow-lg
        .card-body.p-3
          h2.card-title.text-sm.mb-2 Товары в заказе
          template(v-if="cartItems.length > 0")
            .max-h-48.overflow-y-auto
              .space-y-2
                .flex.items-center.gap-2.p-2.rounded-lg.bg-base-200(
                  v-for="item in cartItems"
                  :key="item.id"
                )
                  .avatar.flex-shrink-0
                    .w-10.h-10.rounded
                      NuxtImg(
                        :src="getSafeImage(item.image)" 
                        :alt="item.name" 
                        class="object-cover"
                        fetchpriority="high"
                      )
                  .flex-1.min-w-0
                    .font-medium.text-xs.truncate {{ item.name }}
                    .flex.items-center.justify-between.mt-1
                      .text-2xs.text-base-content.opacity-70 {{ formatPrice(item.currentPrice) }} ₽ × {{ item.quantity }}
                      .font-bold.text-xs {{ formatPrice(item.currentPrice * item.quantity) }} ₽
          template(v-else)
            .text-xs.text-center.py-4(class="text-base-content/70") Корзина пуста

          .mt-2.pt-2.border-t.border-base-300
            .space-y-1
              .flex.justify-between.text-xs
                span Товары ({{ totalItems }})
                span.font-medium {{ formatPrice(subtotal) }} ₽
              .flex.justify-between.text-xs(v-if="discount > 0")
                span Скидка
                span.text-error.font-medium -{{ formatPrice(discount) }} ₽
              .flex.justify-between.text-xs
                span Доставка
                span.font-medium {{ selectedDeliveryPrice === 0 ? 'Бесплатно' : formatPrice(selectedDeliveryPrice) + ' ₽' }}
              .divider.my-1
              .flex.justify-between.text-sm.font-bold.text-sky-600
                span Итого
                span {{ formatPrice(finalTotal) }} ₽

  //- Промокод
  .mt-3(class="lg:mt-4")
    .card.bg-base-100.shadow-lg
      .card-body.p-3(class="lg:p-5")
        h3.card-title.text-sm.mb-2(class="lg:text-base lg:mb-3") Применить промокод
        .flex.gap-2
          input.input.input-bordered.flex-1.input-sm(
            type="text"
            placeholder="Введите промокод"
            v-model="promoCode"
            class="lg:input-md"
          )
          button.btn.btn-primary.btn-sm(
            @click="applyPromo"
            :disabled="!promoCode"
            class="lg:btn-md"
          ) Применить
        .alert.alert-success.mt-2(v-if="appliedPromo")
          .flex.items-center.justify-between
            span.text-2xs(class="lg:text-xs") Промокод "{{ appliedPromo }}" применен
            button.btn.btn-ghost.btn-xs(@click="removePromo") ✕

  //- Модальное окно успешного заказа
  dialog.modal(:class="{ 'modal-open': showSuccessModal }")
    .modal-box.text-center.rounded-xl(class="lg:max-w-2xl")
      h3.text-2xl.font-bold.text-success.mb-4(class="lg:text-4xl") Заказ успешно оформлен!
      .text-6xl.mb-4(class="lg:text-8xl") 🎉
      p(class="lg:text-xl lg:mb-2") Ваш заказ №{{ orderNumber }}
      p.mb-2(class="lg:text-xl lg:mb-4") принят в обработку.
      p.mb-4(class="lg:text-xl lg:mb-8") На указанную почту отправлено письмо с деталями заказа.
      .modal-action.justify-center
        NuxtLink.btn.btn-primary.rounded-xl(to="/" class="lg:btn-lg" prefetch) Вернуться на главную
</template>

<script setup>
import { useCart } from '@/composables/useCart'
import { useProductUtils } from '@/composables/useProductUtils'

const { $notify } = useNuxtApp()
const { 
  cartItems,
  subtotal,
  discount,
  totalItems,
  appliedPromo,
  applyPromoCode,
  removePromoCode,
  clearCart
} = useCart()

const { getSafeImage, formatPrice } = useProductUtils()

// Шаги оформления
const checkoutSteps = [
  { name: 'Контакты', title: 'Контактная информация' },
  { name: 'Доставка', title: 'Способ доставки' },
  { name: 'Оплата', title: 'Способ оплаты' },
  { name: 'Подтверждение', title: 'Подтверждение заказа' }
]

// Состояние оформления заказа
const currentStep = ref(1)
const isProcessing = ref(false)
const showSuccessModal = ref(false)
const orderNumber = ref('')
const promoCode = ref('')

// Форма заказа
const orderForm = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  deliveryMethod: 'courier',
  address: '',
  city: '',
  postalCode: '',
  paymentMethod: 'card'
})

// Данные оплаты
const paymentData = ref({
  cardNumber: '',
  expiryDate: '',
  cvv: ''
})

// Ошибки валидации
const errors = ref({})

// Методы доставки
const deliveryMethods = [
  { id: 'courier', name: 'Курьерская доставка', description: 'Доставка до двери', price: 300 },
  { id: 'pickup', name: 'Самовывоз', description: 'Из пункта выдачи', price: 0 },
  { id: 'post', name: 'Почта России', description: 'Доставка почтой', price: 200 }
]

// Методы оплаты
const paymentMethods = [
  { id: 'card', name: 'Банковская карта', description: 'Онлайн оплата картой' },
  { id: 'cash', name: 'Наличными', description: 'При получении заказа' },
  { id: 'online', name: 'Электронные деньги', description: 'ЮMoney, Qiwi и др.' }
]

// Вычисляемые свойства
const selectedDeliveryPrice = computed(() => {
  const method = deliveryMethods.find(m => m.id === orderForm.value.deliveryMethod)
  return method ? method.price : 0
})

const finalTotal = computed(() => {
  return subtotal.value - discount.value + selectedDeliveryPrice.value
})

const isStepValid = computed(() => {
  switch (currentStep.value) {
    case 1:
      return orderForm.value.firstName && 
            orderForm.value.lastName && 
            orderForm.value.email && 
            orderForm.value.phone
    case 2:
      if (orderForm.value.deliveryMethod === 'courier') {
        return orderForm.value.address && orderForm.value.city
      }
      return true
    case 3:
      return orderForm.value.paymentMethod
    case 4:
      return true
    default:
      return false
  }
})

// Методы
const nextStep = () => {
  if (validateStep(currentStep.value)) {
    currentStep.value++
  }
}

const previousStep = () => {
  currentStep.value--
}

const validateStep = (step) => {
  errors.value = {}
  
  switch (step) {
    case 1:
      if (!orderForm.value.firstName) errors.value.firstName = 'Введите имя'
      if (!orderForm.value.lastName) errors.value.lastName = 'Введите фамилию'
      if (!orderForm.value.email) errors.value.email = 'Введите email'
      else if (!/\S+@\S+\.\S+/.test(orderForm.value.email)) errors.value.email = 'Неверный формат email'
      if (!orderForm.value.phone) errors.value.phone = 'Введите телефон'
      break
    case 2:
      if (orderForm.value.deliveryMethod === 'courier') {
        if (!orderForm.value.address) errors.value.address = 'Введите адрес'
        if (!orderForm.value.city) errors.value.city = 'Введите город'
      }
      break
  }
  
  return Object.keys(errors.value).length === 0
}

const applyPromo = async () => {
  if (!promoCode.value.trim()) return
  
  try {
    await applyPromoCode(promoCode.value)
    $notify.success('Промокод применен!')
    promoCode.value = ''
  } catch (error) {
    $notify.error('Неверный промокод')
  }
}

const removePromo = async () => {
  await removePromoCode()
  $notify.info('Промокод удален')
}

const placeOrder = async () => {
  if (!validateStep(4)) return
  
  isProcessing.value = true
  
  try {
    await new Promise(resolve => setTimeout(resolve, 2000))
    orderNumber.value = 'ORD-' + Date.now().toString().slice(-6)
    await clearCart()
    showSuccessModal.value = true
  } catch (error) {
    $notify.error('Ошибка при оформлении заказа')
  } finally {
    isProcessing.value = false
  }
}

// Загрузка данных пользователя если авторизован
onMounted(() => {
  try {
    const { isAuthenticated, user } = useAppState()
    if (isAuthenticated?.value && user?.value) {
      orderForm.value.email = user.value.email || ''
      orderForm.value.firstName = user.value.name?.split(' ')[0] || ''
      orderForm.value.lastName = user.value.name?.split(' ')[1] || ''
    }
  } catch (error) {
    console.error('Error loading user data:', error)
  }
})
</script>

<style scoped>
.breadcrumbs > ul > li + li:before {
  opacity: 1;
}

.step-content {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ========== ШАГИ - ИДЕАЛЬНОЕ ЦЕНТРИРОВАНИЕ ========== */
.steps-horizontal-wrapper {
  overflow-x: auto;
  overflow-y: hidden;
  border-radius: 12px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  display: flex !important;
  align-items: center !important;
  min-height: 80px;
  margin-left: 0;
  margin-right: 0;
  width: 100%;
}

.steps-horizontal-wrapper::-webkit-scrollbar {
  display: none;
}

.steps-horizontal-wrapper .card-body {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
  width: 100%;
  height: 100%;
  margin: 0;
}

.steps-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-width: min-content;
  flex-wrap: nowrap;
}

.step-horizontal {
  display: flex;
  align-items: center;
  position: relative;
}

.step-horizontal .step-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.step-horizontal .step-number {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.75rem;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.step-horizontal .step-name {
  color: oklch(var(--bc) / 0.7);
  font-weight: 500;
  line-height: 1.2;
  max-width: 70px;
  word-break: break-word;
}

.text-3xs {
  font-size: 0.5rem;
}
.text-2xs {
  font-size: 0.65rem;
}

@media (min-width: 1024px) {
  .steps-horizontal-wrapper {
    min-height: 100px;
  }
  
  .step-horizontal .step-number {
    width: 2.25rem;
    height: 2.25rem;
    font-size: 0.875rem;
    margin-bottom: 0.25rem;
  }
  
  .step-horizontal .step-name {
    font-size: 0.75rem;
    white-space: nowrap;
    max-width: none;
  }
  
  .text-3xs {
    font-size: 0.7rem;
  }
}

.step-horizontal.step-active .step-name {
  color: oklch(var(--p));
  font-weight: 600;
}

.step-connector {
  width: 1px;
  height: 1.5rem;
  margin-left: 0.5rem;
  margin-right: 0.5rem;
  background-color: oklch(var(--b3));
  border-radius: 1px;
}

@media (min-width: 1024px) {
  .step-connector {
    width: 2px;
    height: 2rem;
    margin-left: 1rem;
    margin-right: 1rem;
  }
}

.step-horizontal.step-completed + .step-connector {
  background-color: oklch(var(--p));
}

/* ========== МОБИЛЬНЫЕ СТИЛИ - ИДЕАЛЬНОЕ ЦЕНТРИРОВАНИЕ ========== */
@media (max-width: 1023px) {
  .container {
    padding-left: 0.75rem !important;
    padding-right: 0.75rem !important;
  }
  
  /* Полное центрирование шагов по вертикали */
  .steps-horizontal-wrapper {
    margin-left: -0.75rem;
    margin-right: -0.75rem;
    border-radius: 0;
    width: calc(100% + 1.5rem);
    min-height: 70px !important;
    display: flex !important;
    align-items: center !important;
  }
  
  .steps-horizontal-wrapper .card-body {
    padding-top: 0.5rem !important;
    padding-bottom: 0.5rem !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    height: 100%;
  }
  
  .steps-container {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
    display: flex;
    align-items: center !important;
    justify-content: flex-start;
  }
  
  .step-horizontal {
    display: flex;
    align-items: center !important;
  }
  
  .step-horizontal .step-content {
    display: flex;
    flex-direction: column;
    align-items: center !important;
    justify-content: center !important;
  }
  
  .step-horizontal .step-number {
    width: 1.5rem;
    height: 1.5rem;
    font-size: 0.7rem;
    margin-bottom: 0.15rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .step-horizontal .step-name {
    font-size: 0.45rem;
    max-width: 50px;
    line-height: 1.1;
  }
  
  .step-connector {
    height: 1.25rem;
    margin-left: 0.25rem;
    margin-right: 0.25rem;
  }
}

/* ========== ПРИКРЕПЛЕНИЕ КНОПОК К НИЗУ ========== */
.checkout-form {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.checkout-form .card {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 500px;
}

.checkout-form .card-body {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-bottom: 1rem !important;
}

.checkout-form .step-content {
  flex: 1 1 auto;
  overflow-y: auto;
}

.checkout-form .sticky-navigation {
  flex-shrink: 0;
  margin-top: auto;
  background-color: oklch(var(--b1));
  padding-top: 1rem;
  border-top: 1px solid oklch(var(--b3));
}

@media (max-width: 1023px) {
  .checkout-form .card-body {
    min-height: calc(100vh - 200px);
    padding-bottom: 0.75rem !important;
  }
  
  .checkout-form .sticky-navigation {
    padding-top: 0.75rem;
    background-color: oklch(var(--b1));
  }
}

@media (min-width: 1024px) {
  .checkout-page {
    min-height: 100vh;
  }
  
  .container {
    max-width: 1400px !important;
    padding-left: 2rem !important;
    padding-right: 2rem !important;
  }
  
  .checkout-sticky-sidebar {
    position: sticky;
    top: 6rem;
    height: calc(100vh - 8rem);
    overflow-y: auto;
    padding-right: 0.5rem;
  }
  
  .checkout-form .card-body {
    min-height: 600px;
  }
  
  .checkout-form .sticky-navigation {
    background-color: oklch(var(--b1));
    padding-top: 1rem;
  }
}

/* Темная тема */
:global(.dark) .card {
  background-color: oklch(var(--b2));
}

:global(.dark) .card.bg-base-200 {
  background-color: oklch(var(--b3));
}

:global(.dark) .input-bordered {
  background-color: oklch(var(--b1));
  border-color: oklch(var(--b3));
}

:global(.dark) .steps-horizontal-wrapper {
  background-color: oklch(var(--b2));
}

:global(.dark) .checkout-form .sticky-navigation {
  background-color: oklch(var(--b2));
}
</style>