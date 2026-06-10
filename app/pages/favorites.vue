<!-- app/pages/favorites.vue -->
<!-- ============================================
  Страница: избранное
============================================ -->
<template lang="pug">
.favorites-page.min-h-screen.bg-base-100.flex.flex-col(
  :class="{ 'ml-16': isHorizontal }"
)
  Header
  
  main.flex-1.flex.flex-col.p-2(class="lg:p-4")
    //- Заголовок
    .flex.items-center.justify-between.mb-2
      h1.text-xl.font-bold(class="lg:text-2xl") Избранное
      .flex.items-center.gap-2
        span.text-sm.opacity-70 {{ favoriteProducts.length }} товаров
        button.btn.btn-outline.btn-xs.btn-error.rounded-md(
          v-if="favoriteProducts.length > 0"
          @click="clearAllFavorites"
        )
          | Очистить

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
      h2 Список пуст
      p Добавьте товары в избранное
      NuxtLink.btn.btn-primary(to="/") Перейти в каталог

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

// ✅ Исправлено: передаём весь объект или используем removeFromFavorites
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
  gap: 0.5rem;
}

@media (min-width: 640px) {
  .products-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }
}

@media (min-width: 768px) {
  .products-grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.75rem;
  }
}

@media (min-width: 1024px) {
  .products-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
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
  padding: 4rem 1rem;
}

.empty-state h2 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.empty-state p {
  opacity: 0.7;
  margin-bottom: 1rem;
}
</style>