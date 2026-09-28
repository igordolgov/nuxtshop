<!-- app/pages/cart/index.vue -->
<!-- ============================================
  Страница: корзина
============================================ -->
<template lang="pug">
.cart-page.bg-base-100.flex.flex-col
  //- ОСНОВНОЙ ХЕДЕР САЙТА
  ClientOnly
    Header

  //- ГЛАВНЫЙ КОНТЕЙНЕР
  .content-wrapper.flex-1.flex.overflow-hidden
    //- ПУСТАЯ КОРЗИНА - ПОЛНОЭКРАННЫЙ ЦЕНТР НА ДЕСКТОПЕ
    .empty-cart-desktop(
      v-if="!cartItems || cartItems.length === 0"
      class="hidden lg:flex justify-center items-center w-full h-full"
    )
      .empty-cart-content.text-center.max-w-md.mx-auto.p-8
        .empty-icon.mx-auto.mb-6
          svg(width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5")
            path(d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z")
        h2.text-2xl.font-semibold.text-base-content.mb-2
          | Корзина пуста
        p.text-sm.mb-8(class="text-base-content/50")
          | Начните покупки, чтобы добавить товары в&nbsp;корзину
        button.btn.btn-primary.rounded-xl(@click="$router.push('/')")
          span Перейти в каталог

    //- ПУСТАЯ КОРЗИНА - ТОЛЬКО НА МОБИЛЬНЫХ
    .empty-cart-mobile(
      v-if="(!cartItems || cartItems.length === 0) && isMobile"
      class="lg:hidden flex justify-center items-center w-full h-full"
    )
      .empty-cart-content.text-center.max-w-md.mx-auto.p-4
        .empty-icon.mx-auto.mb-5
          svg(width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5")
            path(d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z")
        h2.text-xl.font-semibold.text-base-content.mb-2
          | Корзина пуста
        p.text-sm.mb-6(class="text-base-content/50")
          | Начните покупки, чтобы добавить товары в&nbsp;корзину
        button.btn.btn-primary.rounded-xl(@click="$router.push('/')")
          span Перейти в каталог

    //- КОРЗИНА С ТОВАРАМИ
    .main-content.bg-base-100.flex-1.flex.flex-col.max-w-full(
      v-if="cartItems && cartItems.length > 0"
      :class="{ 'horizontal-orientation': isHorizontal }"
      class="sm:pl-2 lg:pl-0"
    )
      .container.mx-auto.p-0.pr-2.flex-1.max-w-full(class="lg:px-6 py-0 lg:pt-4")
        //- ОСНОВНОЙ GRID: 2 КОЛОНКИ НА ДЕСКТОПЕ
        .cart-grid.grid.gap-4(class="lg:gap-6 lg:grid-cols-4")
          //- ЛЕВАЯ КОЛОНКА - ТОВАРЫ
          .cart-left.col-span-2.max-w-full(class="lg:max-w-full")
            //- ЗАГОЛОВОК
            .cart-header(
              class=[
                'flex items-center justify-between',
                'mb-3 px-3 py-2 bg-base-100 w-full',
                'sm:px-0 sm:w-[calc(100dvw-180px)]',
                'fixed z-40',
                'lg:static lg:bg-transparent lg:z-auto lg:w-auto lg:mb-4 lg:px-0',
              ]
            )
              h1.text-xl.font-semibold.text-base-content(class="lg:text-2xl")
                | Корзина
              .flex.items-center.gap-4
                span(v-if="totalItems > 0").text-sm(class="text-base-content/50")
                  | {{ totalItems }} {{ pluralizeItems(totalItems) }}
                button.btn.btn-ghost.btn-xs.rounded-lg(
                  class="hover:text-error text-base-content/50"
                  @click="clearCart"
                  v-if="cartItems && cartItems.length > 0"
                )
                  span Очистить

            //- КОНТЕНТ С ТОВАРАМИ
            .cart-content.max-w-full.mt-16(
              v-if="cartItems && cartItems.length > 0"
              class="sm:mt-12 lg:mt-0"
            )
              //- ПРЕДУПРЕЖДЕНИЕ О НЕДОСТАТОЧНОМ КОЛИЧЕСТВЕ
              .alert-banner.mb-4.mx-3(
                class="sm:mx-0 lg:mx-0"
                v-if="hasOutOfStockItems"
                )
                svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                  path(stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z")
                span.text-sm Некоторые товары недоступны в запрошенном количестве

              //- СПИСОК ТОВАРОВ
              .cart-items-container(
                v-if="cartItems.length > 0"
                class="lg:max-h-[calc(100dvh-140px)] lg:overflow-y-auto"
              )
                //- ЗАГОЛОВКИ ТАБЛИЦЫ ДЛЯ ДЕСКТОПА
                .hidden(class="lg:block lg:mb-2")
                  .cart-list-header.grid.grid-cols-12.gap-4.px-4.py-2.rounded-xl.font-medium.text-xs.uppercase.tracking-wide(
                    class="bg-base-200 text-base-content/50"
                  )
                    .col-span-5 Товар
                    .col-span-2.text-center Кол-во
                    .col-span-2.text-right Цена
                    .col-span-2.text-right Итого
                    .col-span-1

                //- МОБИЛЬНАЯ ВЕРСИЯ (ГОРИЗОНТАЛЬНАЯ ПРОКРУТКА)
                .cart-items-scroll-wrapper.overflow-x-auto.pl-3.pb-2.mb-1(
                  class="lg:hidden sm:mb-0 sm:pb-1"
                )
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
                              NuxtImg.w-full.h-full.object-cover(
                                :src="item.image || '/images/placeholder.jpg'"
                                :alt="item.name"
                                @error="handleImageError"
                              )
                            .price-info.mt-2
                              .text-base.font-semibold.text-base-content {{ formatPrice(item.currentPrice * item.quantity) }}
                              .text-xs(class="text-base-content/50") {{ formatPrice(item.currentPrice) }}/шт.
                          .flex-grow.min-w-0
                            h3.item-name.font-medium.text-sm.mb-1.transition-colors.cursor-pointer.line-clamp-2(
                              class="hover:text-primary"
                              @click="goToProduct(item)"
                            ) {{ item.name }}
                            span.inline-block.px-2.py-1.rounded-full.text-xs.border.border-base-300.mb-2(class="text-base-content/50") {{ item.category }}
                            .flex.items-center.gap-1.mt-1
                              button.qty-btn(
                                @click="updateQuantity(item.id, item.quantity - 1)"
                                :disabled="item.quantity <= 1"
                              ) –
                              span.px-2.text-sm.font-semibold(
                                :class="{ 'text-warning': item.quantity > getMaxQuantity(item) }"
                              ) {{ item.quantity }}
                              button.qty-btn(
                                @click="updateQuantity(item.id, item.quantity + 1)"
                                :disabled="item.quantity >= getMaxQuantity(item)"
                              ) +
                          button.remove-btn(
                            @click="removeFromCart(item.id)"
                            title="Удалить из корзины"
                          )
                            svg.w-4.h-4(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                              path(stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12")
                        .text-xs.mt-2(
                          v-if="getMaxQuantity(item) < 999"
                          :class="getMaxQuantity(item) <= 3 ? 'text-warning font-medium' : 'text-base-content/40'"
                        )
                          | Доступно: {{ getMaxQuantity(item) }} шт.
                          span.text-warning.ml-1(v-if="item.quantity > getMaxQuantity(item)") · превышено

                //- ДЕСКТОПНАЯ ВЕРСИЯ (GRID СПИСОК)
                .hidden(class="lg:block")
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
                              :alt="item.name"
                              @error="handleImageError"
                            )
                        .flex-grow.min-w-0
                          .flex.flex-col
                            h3.item-name.font-medium.text-sm.transition-colors.cursor-pointer.truncate(
                              class="hover:text-primary"
                              @click="goToProduct(item)"
                            ) {{ item.name }}
                            span.inline-block.mt-1.px-2.py-1.rounded-full.text-xs.border.border-base-300.w-fit(class="text-base-content/50") {{ item.category }}
                            .text-xs.text-warning.mt-1(v-if="item.quantity > getMaxQuantity(item)") Превышено количество
                            .text-xs.mt-1(
                              v-if="getMaxQuantity(item) < 999"
                              class="text-base-content/40"
                              :class="getMaxQuantity(item) <= 3 ? 'text-warning font-medium' : ''"
                            ) Доступно: {{ getMaxQuantity(item) }} шт.

                      .col-span-2
                        .flex.justify-center
                          .flex.items-center.gap-1
                            button.qty-btn(
                              @click="updateQuantity(item.id, item.quantity - 1)"
                              :disabled="item.quantity <= 1"
                            ) –
                            span.px-2.text-sm.font-semibold(
                              :class="{ 'text-warning': item.quantity > getMaxQuantity(item) }"
                            ) {{ item.quantity }}
                            button.qty-btn(
                              @click="updateQuantity(item.id, item.quantity + 1)"
                              :disabled="item.quantity >= getMaxQuantity(item)"
                            ) +

                      .col-span-2.text-right
                        .text-sm(class="text-base-content/50") {{ formatPrice(item.currentPrice) }}/шт.

                      .col-span-2.text-right
                        .text-sm.font-semibold.text-base-content {{ formatPrice(item.currentPrice * item.quantity) }}
                        .col-span-1.text-center
                        button.remove-btn-inline(
                          @click="removeFromCart(item.id)"
                          title="Удалить из корзины"
                        )
                          svg.w-4.h-4(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                            path(stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12")

          //- ПРАВАЯ КОЛОНКА - ОФОРМЛЕНИЕ ЗАКАЗА
          .cart-right.col-span-2.max-w-full.mb-20(
            class="lg:mt-0 lg:mb-0"
            v-if="totalItems"
          )
            .checkout-card.w-full(class="lg:top-4 lg:sticky lg:h-[calc(100dvh-80px)]")
              .card.bg-base-100.border.border-base-300.rounded-2xl.h-full.flex.flex-col
                .card-body.px-4.py-4.flex.flex-col.flex-1.overflow-y-auto.gap-4
                  h2.text-lg.font-semibold.text-base-content(class="lg:text-xl") Оформление заказа

                  .space-y-2
                    .flex.justify-between.text-sm
                      span(class="text-base-content/50") Товары ({{ totalItems }})
                      span.font-medium {{ formatPrice(subtotal) }}

                    .flex.justify-between.text-sm
                      span(class="text-base-content/50") Доставка
                      span.font-medium {{ deliveryPrice === 0 ? 'Бесплатно' : formatPrice(deliveryPrice) }}

                    .flex.justify-between.text-sm(v-if="discount > 0")
                      span(class="text-base-content/50") Скидка
                      span.font-medium.text-error -{{ formatPrice(discount) }}

                    .flex.justify-between.items-baseline.pt-3.border-t.border-base-300
                      span.text-base.font-semibold Итого
                      span.text-2xl.font-bold.text-base-content {{ formatPrice(total) }}

                  .form-control
                    .join.w-full
                      input.input.input-bordered.join-item.flex-grow.rounded-l-xl(
                        type="text"
                        placeholder="Промокод"
                        v-model="promoCode"
                        @keyup.enter="applyPromo"
                      )
                      button.btn.btn-primary.join-item.rounded-r-xl(
                        @click="applyPromo"
                        :disabled="!promoCode.trim() || isProcessing"
                        class="px-4"
                      )
                        span(v-if="!isProcessing") Применить
                        span.loading.loading-spinner.loading-sm(v-else)

                  .form-control
                    label.label.p-0.mb-2
                      span.label-text.font-medium.text-sm Способ доставки
                    .grid.grid-cols-1.gap-2(class="sm:grid-cols-2")
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
                          .font-medium.text-sm Курьером
                          .text-xs(class="text-base-content/50") 1–3 дня · {{ deliveryPrice === 0 ? 'бесплатно' : formatPrice(deliveryPrice) }}

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
                          .font-medium.text-sm Самовывоз
                          .text-xs(class="text-base-content/50") Сегодня · бесплатно
                          .form-control.mb-6
                    label.label.p-0.mb-2
                      span.label-text.font-medium.text-sm Способ оплаты
                    .grid.grid-cols-1.gap-2(class="sm:grid-cols-2")
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
                          .font-medium.text-sm Банковская карта
                          .text-xs(class="text-base-content/50") Онлайн-оплата

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
                          .font-medium.text-sm Наличными
                          .text-xs(class="text-base-content/50") При получении

                .card-actions.p-1.mt-auto.border-t.aura.aura-gold(v-if="!isMobile")
                  button.btn.btn-primary.btn-lg.w-full.rounded-xl(
                    @click="proceedToCheckout"
                    :disabled="isProcessing || hasOutOfStockItems"
                    :class="{ 'btn-error': hasOutOfStockItems }"
                  )
                    template(v-if="!isProcessing")
                      span
                        template(v-if="hasOutOfStockItems") Есть проблемы с количеством
                        template(v-else) Оформить заказ
                    span.loading.loading-spinner(v-else)

      //- ПРИКРЕПЛЕННАЯ КНОПКА ОФОРМЛЕНИЯ ЗАКАЗА ДЛЯ МОБИЛЬНЫХ
      .mobile-checkout-button.fixed.left-0.right-0.bg-base-100.px-3.pt-2.border-t.border-base-300.z-50(
        v-if="cartItems && cartItems.length > 0"
        class="lg:hidden bottom-14"
        :class="{ 'with-horizontal-offset': isHorizontal && isMobile }"
      )
        button.btn.btn-primary.btn-lg.w-full.rounded-xl.mb-2(
          @click="proceedToCheckout"
          :disabled="isProcessing || hasOutOfStockItems"
          :class="{ 'btn-error': hasOutOfStockItems }"
        )
          template(v-if="!isProcessing")
            span.text-base
              template(v-if="hasOutOfStockItems") Есть проблемы с количеством
              template(v-else) Оформить заказ · {{ formatPrice(total) }}
          span.loading.loading-spinner(v-else)

  //- ФУТЕР
  MobileNavFooter(v-if="isMobile")
</template>

<style scoped>
/* ============================================
  ПУСТАЯ КОРЗИНА
============================================ */
.empty-cart-desktop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgb(var(--color-base-100));
  z-index: 40;
  display: none;
}

@media (min-width: 1024px) {
  .empty-cart-desktop {
    display: flex;
  }
}

.empty-cart-mobile {
  position: fixed;
  top: 20px;
  left: 0;
  right: 0;
  background: rgb(var(--color-base-100));
  z-index: 30;
  display: none;
}

@media (max-width: 1023px) {
  .empty-cart-mobile {
    display: flex;
  }
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
  background: rgb(var(--color-base-200));
  color: rgb(var(--color-base-content) / 0.3);
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
  ОСНОВНОЙ КОНТЕЙНЕР
============================================ */
.content-wrapper {
  height: calc(100dvh - 64px);
}

.cart-grid {
  height: 100%;
  max-height: 100%;
}

.main-content.horizontal-orientation {
  margin-left: 64px;
}

/* ============================================
  ПРЕДУПРЕЖДЕНИЕ
============================================ */
.alert-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  background: rgb(var(--color-warning) / 0.1);
  color: rgb(var(--color-warning));
  border: 1px solid rgb(var(--color-warning) / 0.25);
}

/* ============================================
  КОЛИЧЕСТВО — КНОПКИ
============================================ */
.qty-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid rgb(var(--color-base-300));
  background: transparent;
  font-size: 1rem;
  font-weight: 600;
  color: rgb(var(--color-base-content) / 0.6);
  transition: background var(--transition-fast, 0.15s), border-color var(--transition-fast, 0.15s);
}

.qty-btn:hover:not(:disabled) {
  border-color: rgb(var(--color-primary) / 0.4);
  color: rgb(var(--color-primary));
}

.qty-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* ============================================
  УДАЛЕНИЕ
============================================ */
.remove-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: rgb(var(--color-base-content) / 0.3);
  transition: color var(--transition-fast, 0.15s), background var(--transition-fast, 0.15s);
}

.remove-btn:hover {
  color: rgb(var(--color-error));
  background: rgb(var(--color-error) / 0.08);
}

.remove-btn-inline {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: rgb(var(--color-base-content) / 0.3);
  transition: color var(--transition-fast, 0.15s), background var(--transition-fast, 0.15s);
}

.remove-btn-inline:hover {
  color: rgb(var(--color-error));
  background: rgb(var(--color-error) / 0.08);
}

/* ============================================
  ВАРИАНТЫ ДОСТАВКИ/ОПЛАТЫ
============================================ */
.option-tile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  border-radius: 0.75rem;
  border: 1px solid rgb(var(--color-base-300));
  cursor: pointer;
  transition: border-color var(--transition-fast, 0.15s), background var(--transition-fast, 0.15s);
}

.option-tile:hover {
  border-color: rgb(var(--color-primary) / 0.3);
}

.option-tile-active {
  border-color: rgb(var(--color-primary));
  background: rgb(var(--color-primary) / 0.06);
}

/* ============================================
  КАРТОЧКИ ТОВАРОВ В КОРЗИНЕ (МОБИЛЬНАЯ ВЕРСИЯ)
============================================ */
.cart-items-scroll-wrapper {
  -webkit-overflow-scrolling: touch;
  max-width: 100dvw;
  box-sizing: border-box;
}

.cart-items {
  width: max-content;
}

.cart-item-card {
  width: 300px;
}

@media (min-width: 769px) {
  .cart-item-card {
    width: 340px;
  }
}

@media (max-width: 768px) and (orientation: landscape) {
  .cart-item-card {
    width: 280px;
  }
}

/* ============================================
  ДЕСКТОПНАЯ ВЕРСИЯ
============================================ */
@media (min-width: 1024px) {
  .checkout-card .card {
    position: sticky;
    top: 1rem;
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
  }
}

/* ============================================
  МОБИЛЬНАЯ КНОПКА ОФОРМЛЕНИЯ
============================================ */
.mobile-checkout-button {
  z-index: 50;
}

.mobile-checkout-button.with-horizontal-offset {
  left: 70px;
  bottom: 0;
}

/* ============================================
ГОРИЗОНТАЛЬНАЯ ОРИЕНТАЦИЯ (ЛАНДШАФТ)
============================================ */
@media (max-width: 926px) and (orientation: landscape) {
  .main-content.horizontal-orientation {
    margin-left: 60px;
    width: calc(100vw - 60px);
    max-width: calc(100vw - 60px);
  }

  .cart-items-scroll-wrapper {
    max-width: calc(100vw - 76px);
  }

  .cart-item-card {
    width: 300px;
    max-width: calc(50vw - 70px);
  }

  .mobile-checkout-button.with-horizontal-offset {
    left: 60px;
    width: calc(100vw - 60px);
  }
}

@media (max-width: 740px) and (orientation: landscape) {
  .cart-item-card {
    width: 280px;
    max-width: calc(50vw - 65px);
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

<script setup>
import Header from '~/components/layout/Header.vue'
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'
import { ref, onMounted, onUnmounted } from 'vue'

const { $notify } = useNuxtApp()
const { getProductUrl } = useCart()

// Определяем горизонтальную ориентацию
const isHorizontal = ref(false)

const checkOrientation = () => {
  if (process.client) {
    const isLandscape = window.innerWidth > window.innerHeight
    const isSmallWidth = window.innerWidth <= 926
    isHorizontal.value = isLandscape && isSmallWidth
  }
}

// Определяем мобильное устройство
const isMobile = ref(false)

const checkMobile = () => {
  if (process.client) {
    isMobile.value = window.innerWidth < 1024
  }
}

// Используем композабл корзины
const {
  cartItems,
  subtotal,
  discount,
  total,
  totalItems,
  deliveryPrice,
  updateItemQuantity,
  removeFromCart,
  clearCart,
  applyPromoCode,
  proceedToCheckout: cartCheckout,
  getMaxQuantity,
  hasOutOfStockItems
} = useCart()

const isProcessing = ref(false)
const promoCode = ref('')
const selectedDelivery = ref('courier')
const selectedPayment = ref('card')

const formatPrice = (price) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0
  }).format(price)
}

const pluralizeItems = (count) => {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 14) return 'товаров'
  if (mod10 === 1) return 'товар'
  if (mod10 >= 2 && mod10 <= 4) return 'товара'
  return 'товаров'
}

const handleImageError = (event) => {
  event.target.src = '/images/placeholder.jpg'
}

const updateQuantity = async (itemId, newQuantity) => {
  if (newQuantity < 1) return

  try {
    await updateItemQuantity(itemId, newQuantity)
  } catch (error) {
    $notify.error(error.message || 'Ошибка при обновлении количества')
  }
}

const applyPromo = async () => {
  if (!promoCode.value.trim()) return

  try {
    isProcessing.value = true
    await applyPromoCode(promoCode.value)
    $notify.success('Промокод применен')
    promoCode.value = ''
  } catch (error) {
    $notify.error('Неверный промокод')
  } finally {
    isProcessing.value = false
  }
}

const proceedToCheckout = async () => {
  try {
    isProcessing.value = true
    await cartCheckout()
    await navigateTo('/cart/checkout')
  } catch (error) {
    $notify.error('Ошибка при оформлении заказа')
  } finally {
    isProcessing.value = false
  }
}

// Переход к товару
const goToProduct = (product) => {
  const url = getProductUrl(product)
  navigateTo(url)
}

// Инициализация
onMounted(() => {
  if (process.client) {
    checkOrientation()
    checkMobile()
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('resize', checkMobile)
    window.addEventListener('orientationchange', checkOrientation)
    window.scrollTo(0, 0)
  }
})

onUnmounted(() => {
  if (process.client) {
    window.removeEventListener('resize', checkOrientation)
    window.removeEventListener('resize', checkMobile)
    window.removeEventListener('orientationchange', checkOrientation)
  }
})

useHead({ title: 'Корзина' })
</script>