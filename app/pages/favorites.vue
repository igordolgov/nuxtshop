<!-- app/pages/favorites.vue -->
<!-- ============================================
  Страница: избранное
  Источник данных — useFavorites (единственный источник правды).
  Сетка — утилиты Tailwind вместо кастомного CSS-класса.
  Список рендерится только на клиенте (ClientOnly): на SSR localStorage
  недоступен, иначе — мигание «пусто → список» и hydration mismatch.
============================================ -->
<template lang="pug">
.favorites-page.min-h-screen.bg-base-100.flex.flex-col(
  :class="{ 'ml-16': isHorizontal }"
)
  Header

  main.flex-1.flex.flex-col.max-w-7xl.w-full.mx-auto.px-3.py-4(class="lg:px-6 lg:py-8")
    //- Заголовок
    .flex.items-center.justify-between.mb-4(class="lg:mb-6")
      div
        h1.text-2xl.font-semibold.text-base-content(class="lg:text-3xl") Избранное

      ClientOnly
        .flex.items-center.gap-4(v-if="favoriteProducts.length > 0")
          p.text-sm {{ favoriteProducts.length }} {{ pluralize(favoriteProducts.length) }}
          button.btn.btn-ghost.btn-sm.rounded-xl.text-error(
            @click="clearAllFavorites"
            class="text-base-content/50"
          ) Очистить всё

    //- Сетка / пустое состояние / скелетон — только клиент
    ClientOnly
      .grid.grid-cols-2.gap-3(
        v-if="favoriteProducts.length > 0"
        class="lg:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      )
        ProductCardFavorite(
          v-for="product in favoriteProducts"
          :key="product.id"
          :product="product"
          :is-in-cart="isInCart(product.id)"
          @remove-favorite="removeFavorite"
          @add-to-cart="addToCartHandler"
        )

      //- Пустое состояние
      .text-center.py-20.flex.flex-col.items-center(v-else)
        .size-18.rounded-full.flex.items-center.justify-center.mb-5(
          class="bg-base-200 text-base-content/30"
        )
          svg(width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5")
            path(d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z")
        h2.text-lg.font-semibold.text-base-content Список избранного пуст
        p.text-sm.mb-5.max-w-sm.mx-auto(class="text-base-content/50") Сохраняйте понравившиеся товары, чтобы быстро вернуться к ним позже
        NuxtLink.btn.btn-primary.rounded-xl(to="/") Перейти в каталог

      //- Скелетоны на время гидрации
      template(#fallback)
        .grid.grid-cols-2.gap-3(class="sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6")
          .skeleton.h-64.rounded-xl(v-for="i in 8" :key="i")

  MobileNavFooter(v-if="isMobile")
</template>

<script setup>
import Header from '~/components/layout/Header.vue'
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'
import ProductCardFavorite from '~/components/products/ProductCardFavorite.vue'

const { isMobile, isHorizontal } = useMobileDetection()
const { addToCart, cartItems } = useCart()
const { $notify } = useNuxtApp()

// Единственный источник правды по избранному
const favorites = useFavorites()
const favoriteProducts = favorites.favoriteProducts

const pluralize = (count) => {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 14) return 'товаров'
  if (mod10 === 1) return 'товар'
  if (mod10 >= 2 && mod10 <= 4) return 'товара'
  return 'товаров'
}

const isInCart = (id) => {
  return cartItems.value?.some((item) => item.id === id?.toString()) || false
}

const addToCartHandler = async (product) => {
  if (isInCart(product.id)) return
  try {
    await addToCart(product)
    $notify.success('Добавлено в корзину')
  } catch {
    $notify.error('Ошибка')
  }
}

const removeFavorite = (product) => {
  // product — объект товара из события карточки
  const removed = favorites.removeFromFavorites(product?.id ?? product)
  if (removed) $notify.info('Удалено из избранного')
}

const clearAllFavorites = () => {
  favorites.clearAllFavorites()
  $notify.success('Избранное очищено')
}

onMounted(() => window.scrollTo(0, 0))

useHead({ title: 'Избранное' })
</script>