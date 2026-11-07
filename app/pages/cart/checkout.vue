<!-- pages/cart/checkout.vue — оформление заказа: 4 шага (контакты, доставка,
     оплата, подтверждение), отправка заказа на сервер (POST /api/orders —
     деньги пересчитывает сервер), экран успеха с реальным номером заказа. -->
<template lang="pug">
.checkout-page.mobile-nav-safe
  Header
  .container.mx-auto(class="sm:ml-17")
    //- ГОРИЗОНТАЛЬНЫЕ ШАГИ
    //- Полоса шагов — CheckoutStepper.vue (стили полосы тоже там)
    CheckoutStepper(:steps="checkoutSteps" :current-step="currentStep")
    //- Основная сетка
    .grid.grid-cols-1.gap-2(class="lg:gap-6 lg:grid-cols-3")
      //- Левая колонка — Товары и итоги (только десктоп)
        //- Сводка заказа — CheckoutOrderSummary.vue (единый блок вместо
        //- бывших дублирующихся десктоп/мобильных карточек)
        CheckoutOrderSummary
      //- Правая колонка — Форма оформления
      .checkout-form.flex.flex-col(class="lg:col-span-2")
        .card.bg-base-100.shadow-xl.flex-1.flex.flex-col.h-full
          .card-body.p-2.pt-4.flex.flex-col.h-full(class="lg:p-6 lg:pt-0")
            //- Заголовок текущего шага
            h1.card-title.text-lg.mb-3(class="lg:mb-4 lg:text-2xl") {{ checkoutSteps[currentStep - 1]?.title }}

            //- Контент формы
            .step-content.flex-1.overflow-y-auto
              //- Формы четырёх шагов — CheckoutStepForms.vue; состояние
              //- формы и валидация остаются на странице
              CheckoutStepForms(
                v-model:order-form="orderForm"
                v-model:payment-data="paymentData"
                :current-step="currentStep"
                :errors="errors"
              )

            //- Кнопки навигации
            .flex.justify-between.mt-4.pt-2.border-t.border-base-200.flex-shrink-0.sticky-navigation
              button.btn.btn-outline.btn-sm.rounded-lg(
                v-if="currentStep > 1"
                type="button"
                @click="previousStep"
                class="lg:min-w-28 lg:btn-md"
              ) {{ $t('checkout.back') }}
              .flex-1(v-if="currentStep > 1")
              button.btn.btn-primary.btn-sm.rounded-lg(
                v-if="currentStep < 4"
                type="button"
                @click="nextStep"
                :disabled="!isStepValid"
                class="lg:min-w-40 lg:btn-md"
              ) {{ $t('checkout.continue') }}

              button.btn.btn-success.btn-sm.rounded-lg(
                v-if="currentStep === 4"
                type="button"
                @click="placeOrder"
                :disabled="isProcessing"
                class="lg:min-w-56 lg:btn-md"
              )
                span(v-if="!isProcessing" class="lg:text-base") {{ $t('checkout.confirmOrder') }}
                span.loading.loading-spinner.loading-sm(v-else class="lg:loading-md")

    //- Карточка с товарами для мобильных
    //- Мобильная сводка заказа — тот же CheckoutOrderSummary в compact-режиме
    .mt-2(class="lg:hidden")
      CheckoutOrderSummary(compact)

    //- Промокод
    .mb-16(class="lg:mt-4")
      .card.bg-base-100.shadow-lg
        .card-body.p-3(class="lg:p-5")
          h3.card-title.text-sm.mb-2(class="lg:mb-3 lg:text-base") {{ $t('checkout.promoTitle') }}
          .flex.gap-2
            input.input.input-bordered.flex-1.input-sm.text-base(
              type="text"
              :placeholder="$t('checkout.promoPh')"
              v-model="promoCode"
              autocomplete="off"
              class="lg:input-md"
            )
            button.btn.btn-primary.btn-sm(
              type="button"
              @click="applyPromo"
              :disabled="!promoCode"
              class="lg:btn-md"
            ) {{ $t('cart.apply') }}
          .alert.alert-success.mt-2(v-if="appliedPromo")
            .flex.items-center.justify-between
              span(class="text-[0.65rem] lg:text-xs") {{ $t('checkout.promoAppliedChip', { code: appliedPromo?.code }) }}
              button.btn.btn-ghost.btn-xs(type="button" @click="removePromo") ✕

    //- Модальное окно успешного заказа
    dialog.modal(:class="{ 'modal-open': showSuccessModal }")
      .modal-box.py-8.text-center.rounded-xl(class="lg:max-w-2xl")
        h3.text-2xl.font-bold.text-success.mb-4(class="lg:text-4xl") {{ $t('checkout.successTitle') }}
        .text-6xl.mb-4(class="lg:text-6xl") 🎉
        p(class="lg:mb-2 lg:text-xl") {{ $t('checkout.successNumber', { n: orderNumber }) }}
        p.mb-2(class="lg:mb-4 lg:text-xl") {{ $t('checkout.successAccepted') }}
        p.mb-4(class="lg:mb-8 lg:text-xl")
          | {{ $t('checkout.successTotal', { sum: formatMoney(orderTotal) }) }}
          br
          | {{ $t('checkout.successContact') }}
        .modal-action.justify-center
          NuxtLink.btn.btn-primary.rounded-xl(:to="$localePath('/')" class="lg:btn-lg" prefetch)
            | {{ $t('checkout.successBack') }}

  //- Мобильный футер
  MobileNavFooter
</template>

<script setup>
// Конфиг витрины: дефолтный способ оплаты — первый включённый в
// STORE_PAYMENT_METHODS (кубинская копия: ['transfer','cash'] → transfer)
import { STORE_PAYMENT_METHODS } from '../../../store.config'
// Отключаем SSR для этой страницы: корзина и форма живут в localStorage/клиенте
definePageMeta({
  ssr: false,
})

const { isMobile } = useMobileDetection()
const { t } = useI18n()
const { $notify } = useNuxtApp()
const {
  cartItems,
  appliedPromo,
  applyPromoCode,
  removePromoCode,
  revalidatePromo,
  clearCart,
  deliveryMethod,
  setDeliveryMethod,
} = useCart()
const { formatPrice, formatMoney } = useProductUtils()

const { createOrder } = useOrders()

//- Шаги оформления
const checkoutSteps = [
  { nameKey: 'checkout.stepContacts', titleKey: 'checkout.stepContactsTitle' },
  { nameKey: 'checkout.stepDelivery', titleKey: 'checkout.stepDeliveryTitle' },
  { nameKey: 'checkout.stepPayment', titleKey: 'checkout.stepPaymentTitle' },
  { nameKey: 'checkout.stepConfirm', titleKey: 'checkout.stepConfirmTitle' },
]

//- Состояние
const currentStep = ref(1)
const isProcessing = ref(false)
const showSuccessModal = ref(false)
const orderNumber = ref('')
const orderTotal = ref(0)
const promoCode = ref('')

//- Форма заказа
const orderForm = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  deliveryMethod: 'courier',
  address: '',
  city: '',
  postalCode: '',
  // Дефолт — первый включённый способ из store.config (RU: card, Куба: transfer)
  paymentMethod: STORE_PAYMENT_METHODS[0],
})

//- Данные карты — ВИЗУАЛЬНАЯ ЗАГЛУШКА: никуда не отправляются
const paymentData = ref({
  cardNumber: '',
  expiryDate: '',
  cvv: '',
})

//- Ошибки валидации
const errors = ref({})

//- Локализация серверных ошибок по кодам (server.* в словарях)
const { serverMessage } = useServerMessage()

//- Человекочитаемое сообщение из ошибки $fetch. Серверные коды
//- (emptyCart/missingName/stockShortage/…) переводятся словарём;
//- нехватка склада — особый случай: список позиций из data.params.items
//- локализуется по-штучно (server.stockShortageItem). Русский текст
//- сервера больше не показываем напрямую (i18n страницы).
const errorMessage = (err) => {
  const payload = err?.data?.data ?? err?.data ?? {}
  const items = payload?.params?.items ?? payload?.items
  if (payload?.code === 'stockShortage' && Array.isArray(items) && items.length > 0) {
    const list = items
      .map((s) => t('server.stockShortageItem', { name: s.name, available: s.available, requested: s.requested }))
      .join('; ')
    return `${t('server.stockShortage')}: ${list}`
  }
  return serverMessage(err, 'checkout.unknownError')
}
const isStepValid = computed(() => {
  switch (currentStep.value) {
    case 1:
      return (
        orderForm.value.firstName?.trim() &&
        orderForm.value.lastName?.trim() &&
        orderForm.value.email?.trim() &&
        orderForm.value.phone?.trim()
      )
    case 2:
      if (orderForm.value.deliveryMethod === 'courier') {
        return orderForm.value.address?.trim() && orderForm.value.city?.trim()
      }
      if (orderForm.value.deliveryMethod === 'post') {
        return (
          orderForm.value.address?.trim() &&
          orderForm.value.city?.trim() &&
          /^\d{6}$/.test(orderForm.value.postalCode?.trim() || '')
        )
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

//- Навигация по шагам
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
      if (!orderForm.value.firstName?.trim()) errors.value.firstName = t('checkout.errFirstName')
      if (!orderForm.value.lastName?.trim()) errors.value.lastName = t('checkout.errLastName')
      if (!orderForm.value.email?.trim()) errors.value.email = t('checkout.errEmail')
      else if (!/\S+@\S+\.\S+/.test(orderForm.value.email)) errors.value.email = t('checkout.errEmailFormat')
      if (!orderForm.value.phone?.trim()) errors.value.phone = t('checkout.errPhone')
      break
    case 2:
      if (orderForm.value.deliveryMethod === 'courier') {
        if (!orderForm.value.address?.trim()) errors.value.address = t('checkout.errAddress')
        if (!orderForm.value.city?.trim()) errors.value.city = t('checkout.errCity')
      }
      if (orderForm.value.deliveryMethod === 'post') {
        if (!orderForm.value.address?.trim()) errors.value.address = t('checkout.errAddress')
        if (!orderForm.value.city?.trim()) errors.value.city = t('checkout.errCity')
        if (!/^\d{6}$/.test(orderForm.value.postalCode?.trim() || ''))
          errors.value.postalCode = t('checkout.errZip')
      }
      break
  }

  return Object.keys(errors.value).length === 0
}
//- Промокод
const applyPromo = async () => {
  if (!promoCode.value?.trim()) return

  try {
    await applyPromoCode(promoCode.value)
    $notify.success(t('cart.promoOk'))
    promoCode.value = ''
  } catch {
    $notify.error(t('cart.promoBad'))
  }
}

const removePromo = async () => {
  await removePromoCode()
  $notify.info(t('checkout.promoRemoved'))
}

//- ============================================
//- ОФОРМЛЕНИЕ ЗАКАЗА — реальная отправка на сервер.
//- Сервер сам пересчитывает суммы и проверяет склад:
//- клиент передаёт только id+количество и контакты.
//- ============================================
const placeOrder = async () => {
  isProcessing.value = true

  try {
    const payload = {
      items: cartItems.value.map((item) => ({ id: item.id, quantity: item.quantity })),
      deliveryMethod: orderForm.value.deliveryMethod,
      paymentMethod: orderForm.value.paymentMethod,
      promoCode: appliedPromo.value?.code || null,
      customer: {
        name: `${orderForm.value.firstName} ${orderForm.value.lastName}`.trim(),
        email: orderForm.value.email,
        phone: orderForm.value.phone,
        address: orderForm.value.address || undefined,
        city: orderForm.value.city || undefined,
        postalCode: orderForm.value.postalCode || undefined,
      },
      notify: { email: orderForm.value.email, pushSubscribed: false },
    }

    // Отправка; при 4xx сервер вернёт понятный текст
    // (склад, контакты, категории ошибок — см. orderHelpers)
    const order = await createOrder(payload)

    orderNumber.value = order.id
    orderTotal.value = order.total

    // История заказов пользователя (localStorage) — теперь из серверного
    // ответа, а не локальной выдумки; пригодится странице «Мои заказы»
    if (import.meta.client) {
      try {
        const saved = JSON.parse(localStorage.getItem('userOrders') || '[]')
        saved.unshift(order)
        localStorage.setItem('userOrders', JSON.stringify(saved))
      } catch (e) {
        console.warn('[checkout] Не удалось сохранить историю заказов:', e?.message)
      }
    }

    await clearCart()
    showSuccessModal.value = true
  } catch (err) {
    // Текст сервера (склад/валидация) или общий — в уведомление
    $notify.error(errorMessage(err))
  } finally {
    isProcessing.value = false
  }
}

//- Автозаполнение контактов из профиля авторизованного пользователя.
//- Заодно ревалидация сохранённого промокода: срок/лимит могли истечь
//- между сессиями — невалидный удаляется, чтобы не путать покупателя
//- показанной скидкой, которой при заказе не будет.
onMounted(async () => {
  //- Способ доставки: стартуем с выбора, сделанного в корзине (F3),
  //- дальше держим форму и состояние корзины в синхроне в обе стороны
  orderForm.value.deliveryMethod = deliveryMethod.value
  watch(
    () => orderForm.value.deliveryMethod,
    (methodId) => setDeliveryMethod(methodId),
  )

  try {
    const promoOk = await revalidatePromo()
    if (!promoOk) {
      $notify.error(t('checkout.promoInvalidRemoved'))
    }
  } catch (error) {
    console.error('[checkout] revalidatePromo:', error)
  }

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
/* ========== МОБИЛЬНЫЕ (до 1023px) ========== */
@media (max-width: 1023px) {
  .container {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }
}

/* ========== ПРИКРЕПЛЕНИЕ КНОПОК К НИЗУ ========== */
.checkout-form .card {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 5px;
}

.checkout-form .card-body {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-bottom: 1rem;
}

.checkout-form .step-content {
  flex: 1 1 auto;
  overflow-y: auto;
}

.checkout-form .sticky-navigation {
  flex-shrink: 0;
  margin-top: auto;
  /* Фикс просвечивания: старое oklch(var(--b1)) было невалидным,
     фон получался прозрачным и контент светился под кнопками */
  background-color: var(--color-base-100);
  padding-top: 1rem;
}

@media (max-width: 1023px) {
  .checkout-form .card {
    min-height: calc(10vh - 250px);
  }

  .checkout-form .card-body {
    padding-bottom: 0.75rem;
  }

  .checkout-form .sticky-navigation {
    padding-top: 0.75rem;
  }
}

@media (min-width: 1024px) {
  .container {
    max-width: 1400px;
    padding-left: 2rem;
    padding-right: 2rem;
  }

  .checkout-sticky-sidebar {
    height: auto;
    overflow-y: auto;
    padding-right: 0.5rem;
  }

  .checkout-form .card-body {
    min-height: 60px;
  }
}

/* Блок :global(.dark) удалён: проект темизируется через data-theme
   (daisyUI меняет переменные сам) — селектор .dark никогда не совпадал */
</style>