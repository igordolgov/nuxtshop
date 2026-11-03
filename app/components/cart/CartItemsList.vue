<!-- app/components/cart/CartItemsList.vue — позиции корзины:
     лента карточек на мобильных и таблица на десктопе (разбивка
     cart/index.vue, этап 6). Корень — фрагмент из двух вариантов;
     видимость управляется утилитами md:hidden / hidden lg:block. -->
<template lang="pug">
//- МОБИЛЬНАЯ ВЕРСИЯ: горизонтальная лента карточек.
//- overflow и snap — в scoped-CSS класса (единая точка правды);
//- -mx-3 px-3 — лента выходит к краям экрана (peek)
.cart-items-scroll-wrapper(class="md:hidden -mx-3 mb-1 px-3 pb-2")
  .cart-items.flex.flex-nowrap.gap-3.pb-1
    .cart-item-card.bg-base-100.flex-shrink-0.border.rounded-2xl(
      v-for="item in cartItems"
      :key="item.id"
      :class="item.quantity > getMaxQuantity(item) ? 'border-warning' : 'border-base-300'"
    )
      .p-3.relative
        .flex.items-start.gap-3
          .flex-shrink-0
            .item-image.w-20.h-20.rounded-xl.bg-base-200.flex.items-center.justify-center.overflow-hidden
              //- width/height = 80px (w-20 h-20): резерв места до загрузки
              NuxtImg.w-full.h-full.object-cover(
                :src="item.image || '/images/placeholder.jpg'"
                :alt="displayName(item)"
                width="80"
                height="80"
                loading="lazy"
                decoding="async"
                @error="handleImageError"
              )
            .price-info.mt-2
              .text-base.font-semibold.text-base-content {{ formatPrice(item.currentPrice * item.quantity) }} ₽
              .text-xs(class="text-base-content/65") {{ formatPrice(item.currentPrice) }} ₽{{ $t('cart.perUnit') }}
          .flex-grow.min-w-0
            h3.item-name.font-medium.text-sm.mb-1.transition-colors.cursor-pointer.line-clamp-2.pr-9(
              class="hover:text-primary"
              @click="goToProduct(item)"
            ) {{ displayName(item) }}
            .variant-chip.text-xs.mb-2(class="text-base-content/70" v-if="item.variantName")
              | {{ item.variantName }}
            span.inline-block.px-2.py-1.rounded-full.text-xs.border.border-base-300.mb-2(class="text-base-content/65") {{ item.category }}
            .flex.items-center.gap-1.mt-1
              button.qty-btn(
                type="button"
                :aria-label="$t('cart.decrease')"
                :disabled="item.quantity <= 1"
                @click="updateQuantity(item.id, item.quantity - 1)"
              ) –
              span.px-2.text-sm.font-semibold(
                :class="{ 'text-warning': item.quantity > getMaxQuantity(item) }"
              ) {{ item.quantity }}
              button.qty-btn(
                type="button"
                :aria-label="$t('cart.increase')"
                :disabled="item.quantity >= getMaxQuantity(item)"
                @click="updateQuantity(item.id, item.quantity + 1)"
              ) +
          button.remove-btn(
            type="button"
            :title="$t('cart.remove')"
            :aria-label="$t('cart.remove')"
            @click="removeFromCart(item.id)"
          )
            svg.w-4.h-4(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
              path(stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12")
        .text-xs.mt-2(
          v-if="getMaxQuantity(item) < 999"
          :class="getMaxQuantity(item) <= 3 ? 'text-warning font-medium' : 'text-base-content/75'"
        )
          | {{ $t('cart.available', { n: getMaxQuantity(item) }) }}
          span.text-warning.ml-1(v-if="item.quantity > getMaxQuantity(item)") {{ $t('cart.qtyExceeded') }}

//- ДЕСКТОПНАЯ ВЕРСИЯ: таблица со внутренним скроллом
.hidden(
  class="lg:block lg:pr-1 lg:max-h-[calc(100dvh-140px)] lg:overflow-y-auto"
)
  .cart-list-header.grid.grid-cols-12.gap-4.px-4.py-2.rounded-xl.font-medium.text-xs.uppercase.tracking-wide(
    class="bg-base-200 lg:mb-2 text-base-content/65"
  )
    .col-span-5 {{ $t('cart.product') }}
    .col-span-2.text-center {{ $t('cart.qty') }}
    .col-span-2.text-right {{ $t('cart.price') }}
    .col-span-2.text-right {{ $t('cart.total') }}
    .col-span-1
  .cart-items-list.space-y-2
    .cart-item-row.grid.grid-cols-12.gap-4.px-4.py-3.bg-base-100.border.rounded-xl.items-center(
      v-for="item in cartItems"
      :key="item.id"
      :class="item.quantity > getMaxQuantity(item) ? 'border-warning' : 'border-base-300'"
    )
      .col-span-5.flex.items-center.gap-3
        .flex-shrink-0
          .item-image.w-12.h-12.rounded-lg.bg-base-200.flex.items-center.justify-center.overflow-hidden
            NuxtImg.w-full.h-full.object-cover(
              :src="item.image || '/images/placeholder.jpg'"
              :alt="displayName(item)"
              loading="lazy"
              @error="handleImageError"
            )
        .flex-grow.min-w-0
          .flex.flex-col
            h3.item-name.font-medium.text-sm.transition-colors.cursor-pointer.truncate(
              class="hover:text-primary"
              @click="goToProduct(item)"
            ) {{ displayName(item) }}
            .variant-chip.text-xs(class="mt-0.5 text-base-content/70" v-if="item.variantName")
              | {{ item.variantName }}
            span.inline-block.mt-1.px-2.py-1.rounded-full.text-xs.border.border-base-300.w-fit(class="text-base-content/65") {{ item.category }}
            .text-xs.text-warning.mt-1(v-if="item.quantity > getMaxQuantity(item)")
              | {{ $t('cart.qtyExceededFull') }}
            .text-xs.mt-1(
              v-if="getMaxQuantity(item) < 999"
              class="text-base-content/60"
              :class="getMaxQuantity(item) <= 3 ? 'text-warning font-medium' : ''"
            ) {{ $t('cart.available', { n: getMaxQuantity(item) }) }}
      .col-span-2
        .flex.justify-center
          .flex.items-center.gap-1
            button.qty-btn(
              type="button"
              :aria-label="$t('cart.decrease')"
              :disabled="item.quantity <= 1"
              @click="updateQuantity(item.id, item.quantity - 1)"
            ) –
            span.px-2.text-sm.font-semibold(
              :class="{ 'text-warning': item.quantity > getMaxQuantity(item) }"
            ) {{ item.quantity }}
            button.qty-btn(
              type="button"
              :aria-label="$t('cart.increase')"
              :disabled="item.quantity >= getMaxQuantity(item)"
              @click="updateQuantity(item.id, item.quantity + 1)"
            ) +
      .col-span-2.text-right
        .text-sm(class="text-base-content/65") {{ formatPrice(item.currentPrice) }} ₽{{ $t('cart.perUnit') }}
      .col-span-2.text-right
        .text-sm.font-semibold.text-base-content {{ formatPrice(item.currentPrice * item.quantity) }} ₽
      .col-span-1.text-center
        button.remove-btn-inline(
          type="button"
          :title="$t('cart.remove')"
          :aria-label="$t('cart.remove')"
          @click="removeFromCart(item.id)"
        )
          svg.w-4.h-4(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
            path(stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12")
</template>

<script setup>
// CartItemsList.vue — позиции корзины: лента карточек (мобильные) и
// таблица (десктоп). Разбивка cart/index.vue (этап 6): данные и действия
// берёт сама из useCart/useAppState — без пропсов; локализацию имён,
// переход к товару и лимиты количества инкапсулирует здесь.
import { parseCartLineId } from '@/utils/productVariants'

const { t } = useI18n()
const { $notify } = useNuxtApp()

// Локализация названий: снапшот в localStorage хранит имя на языке
// МОМЕНТА добавления; показываем актуальное имя из каталога (фолбэк — снапшот)
const appState = useAppState()
const { loc } = useLocalizedProduct()
const displayName = (item) => {
  // Позиция варианта лежит в корзине под составным id «productId::variantId» —
  // свежий товар ищем по голому productId (parseCartLineId режет суффикс)
  const { productId } = parseCartLineId(item?.id)
  const fresh = appState.products.value?.find(
    (p) => String(p.id) === String(productId),
  )
  return fresh ? loc(fresh).name : (item?.name ?? '')
}

const {
  cartItems,
  updateItemQuantity,
  removeFromCart,
  getMaxQuantity,
  getProductUrl,
} = useCart()
const { formatPrice } = useProductUtils()

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

const goToProduct = (product) => {
  // У вариантной позиции item.id — «productId::variantId», а getProductUrl
  // ждёт товар; URL строим по productId, чтобы ссылка вела на карточку
  const { productId } = parseCartLineId(product?.id)
  navigateTo(getProductUrl({ ...product, id: productId }))
}
</script>

<style scoped>
/* ============================================
  КНОПКИ КОЛИЧЕСТВА / УДАЛЕНИЯ
  36px — ближе к гайдлайну тач-таргета 44px
============================================ */
.qty-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid var(--color-base-300);
  background: transparent;
  font-size: 1.125rem;
  font-weight: 600;
  color: color-mix(in oklab, var(--color-base-content) 60%, transparent);
  transition:
    background var(--transition-fast, 0.15s),
    border-color var(--transition-fast, 0.15s);
}

.qty-btn:hover:not(:disabled) {
  border-color: color-mix(in oklab, var(--color-primary) 40%, transparent);
  color: var(--color-primary);
}

.qty-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.remove-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: color-mix(in oklab, var(--color-base-content) 30%, transparent);
  transition:
    color var(--transition-fast, 0.15s),
    background var(--transition-fast, 0.15s);
}

.remove-btn:hover {
  color: var(--color-error);
  background: color-mix(in oklab, var(--color-error) 8%, transparent);
}

.remove-btn-inline {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: color-mix(in oklab, var(--color-base-content) 30%, transparent);
  transition:
    color var(--transition-fast, 0.15s),
    background var(--transition-fast, 0.15s);
}

.remove-btn-inline:hover {
  color: var(--color-error);
  background: color-mix(in oklab, var(--color-error) 8%, transparent);
}

/* ============================================
  ЛЕНТА КАРТОЧЕК (МОБИЛЬНЫЕ)
  overflow и snap — здесь, в одном месте; скролл-контейнер
  переполняется только если grid-колонка снаружи зажата
  (grid-cols-1 в шаблоне страницы — обязательно!)
============================================ */
.cart-items-scroll-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;
  /* Старт снапа = внутренний паддинг ленты (px-3 = 12px) */
  scroll-padding-left: 0.75rem;
}

.cart-items {
  width: max-content;
}

.cart-item-card {
  width: 300px;
  scroll-snap-align: start;
}

@media (min-width: 769px) {
  .cart-item-card {
    width: 340px;
  }
}

@media (max-width: 740px) and (orientation: landscape) {
  .cart-item-card {
    width: 280px;
  }
}

/* ============================================
  УТИЛИТЫ
============================================ */
.item-image {
  min-width: 80px;
}

@media (max-width: 768px) {
  .item-image {
    min-width: 64px;
  }
}
</style>
