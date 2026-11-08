<!-- app/components/cart/CheckoutOrderSummary.vue — сводка заказа для
     оформления (разбивка checkout.vue, этап 6). Раньше этот блок был
        продублирован: десктоп-сайдбар и мобильная карточка отличались
     только размерами. Здесь один шаблон: compact=true — мобильная версия.
     Данные берёт сама из useCart/useAppState (общий стейт корзины). -->
<template lang="pug">
.card.bg-base-100.shadow-lg
  .card-body.p-3
    h2.card-title(:class="compact ? 'text-sm mb-2' : 'text-md mb-2 lg:text-2xl'")
      | {{ $t(compact ? 'checkout.itemsInOrderShort' : 'checkout.itemsInOrder') }}
    .overflow-y-auto(v-if="cartItems?.length" :class="compact ? 'max-h-48' : 'max-h-80'")
      .space-y-2
        .flex.items-center.gap-2.p-2.rounded-lg.bg-base-200(
          v-for="item in cartItems"
          :key="item.id"
        )
          .avatar.flex-shrink-0
            .w-10.h-10.rounded
              NuxtImg(
                :src="getSafeImage(item?.image)"
                :alt="displayName(item)"
                class="object-cover"
                fetchpriority="high"
              )
          .flex-1.min-w-0
            .font-medium.truncate(:class="compact ? 'text-xs' : 'text-sm lg:text-md'") {{ displayName(item) }}
            .text-xs.truncate(class="text-base-content/60" v-if="!compact && item?.variantName") {{ item.variantName }}
            .flex.items-center.justify-between.mt-1
              span.text-base-content(class="opacity-70 text-[0.65rem]") {{ formatMoney(item?.currentPrice) }} × {{ item?.quantity }}
              .font-bold.text-xs {{ formatMoney(item?.currentPrice * item?.quantity) }}
    .text-xs.text-center.py-4(v-else class="text-base-content/70") {{ $t('cart.empty') }}

    .mt-2.pt-2.border-t.border-base-300
      .space-y-1
        .flex.justify-between.text-xs
          span {{ $t('cart.items', { n: totalItems || 0 }) }}
          span.font-medium {{ formatMoney(subtotal || 0) }}
        .flex.justify-between.text-xs(v-if="discount > 0")
          span {{ $t('cart.discount') }}
          span.text-error.font-medium -{{ formatMoney(discount) }}
        .flex.justify-between.text-xs
          span {{ $t('cart.delivery') }}
          span.font-medium {{ deliveryPrice === 0 ? $t('cart.free') : formatMoney(deliveryPrice) }}
        .divider.my-1
        .flex.justify-between.font-bold.text-primary(:class="compact ? 'text-sm' : 'text-base'")
          span {{ $t('cart.total') }}
          span {{ formatMoney(finalTotal) }}
        //- Эквивалент итога в песо по курсу elTOQUE (кубинская копия; RU скрыт)
        .cup-equiv.text-right.text-xs(v-if="cupTotalLine" class="text-base-content/55")
          span {{ cupTotalLine }} ·
          a.link.link-hover(class="ml-0.5"
            :href="CUP_RATE_SOURCE_URL"
            target="_blank"
            rel="noopener"
            :title="cupUpdatedAt || undefined"
          ) {{ $t('product.cupRateSource') }}
</template>

<script setup>
// CUP_RATE_SOURCE_URL — страница курса elTOQUE (shared, тесты импортируют ту же константу)
import { CUP_RATE_SOURCE_URL } from '#shared/cupRates'
// compact — мобильная версия (мельче заголовок, ниже список, без варианта)
defineProps({
  compact: { type: Boolean, default: false },
})

import { parseCartLineId } from '@/utils/productVariants'

// useCart/useAppState/useProductUtils/useLocalizedProduct — автоимпорт Nuxt;
// состояние корзины общее со страницей, поэтому сводка живёт сама
const { cartItems, subtotal, discount, totalItems, deliveryPrice } = useCart()
const { formatMoney, getSafeImage, formatPrice } = useProductUtils()

// Локализация названий в оформлении заказа: показываем актуальное имя
// из каталога в текущей локали (снапшот корзины хранит имя на языке
// момента добавления; фолбэк — снапшот)
const appState = useAppState()
const { loc } = useLocalizedProduct()
const displayName = (item) => {
  // Вариантная позиция — составной id «productId::variantId»: ищем свежий
  // товар по голому productId (см. parseCartLineId)
  const { productId } = parseCartLineId(item?.id)
  const fresh = appState.products.value?.find(
    (p) => String(p.id) === String(productId),
  )
  return fresh ? loc(fresh).name : (item?.name ?? '')
}

// Предпросмотр итога. Финальную сумму считает сервер — при изменении
// цен в KV возможна небольшая разница с реальным заказом
const finalTotal = computed(() => {
  const sub = subtotal.value || 0
  const disc = discount.value || 0
  return sub - disc + deliveryPrice.value
})

// Эквивалент итога в CUP по курсу elTOQUE (кубинская копия)
const { cupFor, rateUpdatedAt: cupUpdatedAt } = useCupRate()
const cupTotalLine = computed(() => cupFor(finalTotal.value))
</script>
