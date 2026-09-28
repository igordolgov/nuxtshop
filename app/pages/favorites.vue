<!-- app/pages/favorites.vue -->
<!-- ============================================
  Страница: избранное
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
        h3.tex
        h1.text-2xl.font-semibold.text-base-content(class="lg:text-3xl") Избранное
        p.text-sm.mt-1(v-if="favoriteProducts.length > 0") {{ favoriteProducts.length }} {{ pluralize(favoriteProducts.length) }}
      button.btn.btn-ghost.btn-sm.rounded-xl.text-error(
        v-if="favoriteProducts.length > 0"
        @click="clearAllFavorites"
        class="text-base-content/50"
      ) Очистить всё

    //- Сетка товаров
    .products-grid(v-if="favoriteProducts.length > 0")
      ProductCardFavorite(
        v-for="product in favoriteProducts"
        :key="product.id"
        :product="product"
        :is-in-cart="isInCart(product.id)"
        @remove-favorite="removeFavorite"
        @add-to-cart="addToCartHandler"
      )

    //- Пустое состояние
    .empty-state(v-else)
      .empty-icon
        svg(width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5")
          path(d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z")
      h2.text-lg.font-semibold.text-base-content Список избранного пуст
      p.text-sm.mb-5.max-w-sm.mx-auto(class="text-base-content/50") Сохраняйте понравившиеся товары, чтобы быстро вернуться к ним позже
      NuxtLink.btn.btn-primary.rounded-xl(to="/") Перейти в каталог

  MobileNavFooter(v-if="isMobile")
</template>

<script setup>
import Header from '~/components/layout/Header.vue'
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'
import ProductCardFavorite from '~/components/products/ProductCardFavorite.vue'

const { isMobile, isHorizontal } = useMobileDetection()
const appState = useAppState()
const { addToCart, cartItems } = useCart()
const { $notify } = useNuxtApp()

// Берём избранное из правильного источника
const favoriteProducts = computed(() => {
  // Сначала пробуем взять из favorites.products
  if (appState.favorites?.products?.value?.length) {
    return appState.favorites.products.value
  }
  // Fallback - фильтруем из всех товаров
  const products = appState?.products?.value || []
  return products.filter(p => p?.isFavorite)
})

const pluralize = (count) => {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 14) return 'товаров'
  if (mod10 === 1) return 'товар'
  if (mod10 >= 2 && mod10 <= 4) return 'товара'
  return 'товаров'
}

const isInCart = (id) => {
  return cartItems.value?.some(item => item.id === id?.toString()) || false
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
  // product может быть объектом или просто id
  const productId = product?.id || product

  if (appState.favorites?.removeFromFavorites) {
    appState.favorites.removeFromFavorites(productId)
  } else if (appState.removeFromFavorites) {
    appState.removeFromFavorites(productId)
  }
  $notify.info('Удалено из избранного')
}

const clearAllFavorites = () => {
  if (appState.favorites?.clearAllFavorites) {
    appState.favorites.clearAllFavorites()
  } else if (appState.clearAllFavorites) {
    appState.clearAllFavorites()
  }
  $notify.success('Избранное очищено')
}

onMounted(() => window.scrollTo(0, 0))

useHead({ title: 'Избранное' })
</script>

<style scoped>
.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.75rem;
}

@media (min-width: 640px) {
  .products-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }
}

@media (min-width: 768px) {
  .products-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }
}

@media (min-width: 1280px) {
  .products-grid {
    grid-template-columns: repeat(6, 1fr);
  }
}

.empty-state {
  text-align: center;
  padding: 5rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
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
  margin-bottom: 1.25rem;
}
</style>