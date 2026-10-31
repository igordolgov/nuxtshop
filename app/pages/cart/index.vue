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
          | Корзина пуста
        p.text-sm.mb-8(class="text-base-content/50")
          | Начните покупки, чтобы добавить товары в&nbsp;корзину
        button.btn.btn-primary.rounded-xl(type="button" @click="goCatalog")
          span Перейти в каталог

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
                | Корзина
              .flex.items-center.gap-3
                span.text-sm(v-if="totalItems > 0" class="text-base-content/50")
                  | {{ totalItems }} {{ pluralizeItems(totalItems) }}
                button.btn.btn-ghost.btn-xs.rounded-lg(
                  v-if="cartItems && cartItems.length > 0"
                  class="hover:text-error text-base-content/50"
                  type="button"
                  @click="clearCart"
                )
                  span Очистить

            .cart-content.max-w-full
              //- Предупреждение о недостаточном количестве
              .alert-banner.mb-4(v-if="hasOutOfStockItems")
                svg.w-5.h-5.shrink-0(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                  path(stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z")
                span.text-sm
                  | Некоторые товары недоступны в запрошенном количестве

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
                              :alt="item.name"
                              width="80"
                              height="80"
                              loading="lazy"
                              decoding="async"
                              @error="handleImageError"
                            )
                          .price-info.mt-2
                            .text-base.font-semibold.text-base-content {{ formatPrice(item.currentPrice * item.quantity) }}
                            .text-xs(class="text-base-content/50") {{ formatPrice(item.currentPrice) }}/шт.
                        .flex-grow.min-w-0
                          h3.item-name.font-medium.text-sm.mb-1.transition-colors.cursor-pointer.line-clamp-2.pr-9(
                            class="hover:text-primary"
                            @click="goToProduct(item)"
                          ) {{ item.name }}
                          span.inline-block.px-2.py-1.rounded-full.text-xs.border.border-base-300.mb-2(class="text-base-content/50") {{ item.category }}
                          .flex.items-center.gap-1.mt-1
                            button.qty-btn(
                              type="button"
                              aria-label="Уменьшить количество"
                              :disabled="item.quantity <= 1"
                              @click="updateQuantity(item.id, item.quantity - 1)"
                            ) –
                            span.px-2.text-sm.font-semibold(
                              :class="{ 'text-warning': item.quantity > getMaxQuantity(item) }"
                            ) {{ item.quantity }}
                            button.qty-btn(
                              type="button"
                              aria-label="Увеличить количество"
                              :disabled="item.quantity >= getMaxQuantity(item)"
                              @click="updateQuantity(item.id, item.quantity + 1)"
                            ) +
                        button.remove-btn(
                          type="button"
                          title="Удалить из корзины"
                          aria-label="Удалить из корзины"
                          @click="removeFromCart(item.id)"
                        )
                          svg.w-4.h-4(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                            path(stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12")
                      .text-xs.mt-2(
                        v-if="getMaxQuantity(item) < 999"
                        :class="getMaxQuantity(item) <= 3 ? 'text-warning font-medium' : 'text-base-content/40'"
                      )
                        | Доступно: {{ getMaxQuantity(item) }} шт.
                        span.text-warning.ml-1(v-if="item.quantity > getMaxQuantity(item)") · превышено

              //- ДЕСКТОПНАЯ ВЕРСИЯ: таблица со внутренним скроллом
              .hidden(
                class="lg:block lg:pr-1 lg:max-h-[calc(100dvh-140px)] lg:overflow-y-auto"
              )
                .cart-list-header.grid.grid-cols-12.gap-4.px-4.py-2.rounded-xl.font-medium.text-xs.uppercase.tracking-wide(
                  class="bg-base-200 lg:mb-2 text-base-content/50"
                )
                  .col-span-5 Товар
                  .col-span-2.text-center Кол-во
                  .col-span-2.text-right Цена
                  .col-span-2.text-right Итого
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
                            :alt="item.name"
                            loading="lazy"
                            @error="handleImageError"
                          )
                      .flex-grow.min-w-0
                        .flex.flex-col
                          h3.item-name.font-medium.text-sm.transition-colors.cursor-pointer.truncate(
                            class="hover:text-primary"
                            @click="goToProduct(item)"
                          ) {{ item.name }}
                          span.inline-block.mt-1.px-2.py-1.rounded-full.text-xs.border.border-base-300.w-fit(class="text-base-content/50") {{ item.category }}
                          .text-xs.text-warning.mt-1(v-if="item.quantity > getMaxQuantity(item)")
                            | Превышено количество
                          .text-xs.mt-1(
                            v-if="getMaxQuantity(item) < 999"
                            class="text-base-content/40"
                            :class="getMaxQuantity(item) <= 3 ? 'text-warning font-medium' : ''"
                          ) Доступно: {{ getMaxQuantity(item) }} шт.
                    .col-span-2
                      .flex.justify-center
                        .flex.items-center.gap-1
                          button.qty-btn(
                            type="button"
                            aria-label="Уменьшить количество"
                            :disabled="item.quantity <= 1"
                            @click="updateQuantity(item.id, item.quantity - 1)"
                          ) –
                          span.px-2.text-sm.font-semibold(
                            :class="{ 'text-warning': item.quantity > getMaxQuantity(item) }"
                          ) {{ item.quantity }}
                          button.qty-btn(
                            type="button"
                            aria-label="Увеличить количество"
                            :disabled="item.quantity >= getMaxQuantity(item)"
                            @click="updateQuantity(item.id, item.quantity + 1)"
                          ) +
                    .col-span-2.text-right
                      .text-sm(class="text-base-content/50") {{ formatPrice(item.currentPrice) }}/шт.
                    .col-span-2.text-right
                      .text-sm.font-semibold.text-base-content {{ formatPrice(item.currentPrice * item.quantity) }}
                    .col-span-1.text-center
                      button.remove-btn-inline(
                        type="button"
                        title="Удалить из корзины"
                        aria-label="Удалить из корзины"
                        @click="removeFromCart(item.id)"
                      )
                        svg.w-4.h-4(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75")
                          path(stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12")

          //- ПРАВАЯ КОЛОНКА — ОФОРМЛЕНИЕ ЗАКАЗА (карточка на десктопе)
          .cart-right.col-span-2.max-w-full.min-w-0(v-if="totalItems" class="lg:mb-0")
            .checkout-card.w-full(class="lg:top-4 lg:sticky lg:h-[calc(100dvh-88px)]")
              .card.bg-base-100.border.border-base-300.rounded-2xl.h-full.flex.flex-col
                .card-body.px-4.py-4.flex.flex-col.flex-1.overflow-y-auto.gap-4
                  h2.text-lg.font-semibold.text-base-content(class="lg:text-xl")
                    | Оформление заказа

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
                      input.input.input-bordered.join-item.flex-grow.rounded-l-xl.text-base(
                        type="text"
                        placeholder="Промокод"
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
                        span(v-if="!isProcessing") Применить
                        span.loading.loading-spinner.loading-sm(v-else)

                  .form-control
                    label.label.p-0.mb-2
                      span.label-text.font-medium.text-sm Способ доставки
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

                  .form-control
                    label.label.p-0.mb-2
                      span.label-text.font-medium.text-sm Способ оплаты
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

                .card-actions.px-4.py-3.mt-auto.border-t.border-base-300(v-if="!isMobile")
                  button.btn.btn-primary.btn-lg.w-full.rounded-xl(
                    type="button"
                    :disabled="isProcessing || hasOutOfStockItems"
                    :class="{ 'btn-error': hasOutOfStockItems }"
                    @click="proceedToCheckout"
                  )
                    template(v-if="!isProcessing")
                      span {{ hasOutOfStockItems ? 'Есть проблемы с количеством' : 'Оформить заказ' }}
                    span.loading.loading-spinner(v-else)

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
          template(v-if="hasOutOfStockItems") Есть проблемы с количеством
          template(v-else) Оформить заказ · {{ formatPrice(total) }}
      span.loading.loading-spinner(v-else)

  //- Нижняя навигация (сам компонент ведает ориентацией и переходами)
  MobileNavFooter(v-if="isMobile")
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
  (grid-cols-1 в шаблоне — обязательно!)
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
import { ref, onMounted, onUnmounted } from 'vue'

const { $notify } = useNuxtApp()

//- Один вызов useCart. Header/MobileNavFooter автоимпортятся Nuxt
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
  hasOutOfStockItems,
  getProductUrl,
} = useCart()

//- ============================================
//- Состояние
//- ============================================
const isMounted = ref(false)
const isProcessing = ref(false)
const promoCode = ref('')
const selectedDelivery = ref('courier')
const selectedPayment = ref('card')
const isMobile = ref(false)

//- ============================================
//- Устройство.
//- Локальные isHorizontal/checkOrientation удалены: боковая навигация
//- в landscape больше не существует, нижнее меню постоянно.
//- Порог мобайла согласован с useMobileDetection (< 1024)
//- ============================================
const checkMobile = () => {
  if (!import.meta.client) return
  isMobile.value = window.innerWidth < 1024
}

const onResize = () => checkMobile()

//- ============================================
//- Форматирование и утилиты
//- ============================================
const formatPrice = (price) => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
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

const goCatalog = () => navigateTo('/')

//- ============================================
//- Действия
//- ============================================
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
  } catch {
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
  } catch {
    $notify.error('Ошибка при оформлении заказа')
  } finally {
    isProcessing.value = false
  }
}

const goToProduct = (product) => {
  navigateTo(getProductUrl(product))
}

//- ============================================
//- Lifecycle
//- ============================================
onMounted(() => {
  isMounted.value = true
  checkMobile()
  window.addEventListener('resize', onResize, { passive: true })
  window.scrollTo(0, 0)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})

useHead({ title: 'Корзина' })
</script>