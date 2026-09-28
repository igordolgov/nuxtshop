<!-- app\components\products\ProductList.vue -->
<template lang="pug">
.product-list
  .grid.grid-cols-1.gap-6(:class="viewMode === \'grid\' ? \'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4\' : \'space-y-4\'")
    LazyProductCard(v-for="product in safeDisplayedProducts", :key="product.id", :product="product", :viewmode="viewMode", :searchquery="safeSearchQuery", :highlightsearch="highlightSearch")
  .text-center.py-8(v-if="safeDisplayedProducts.length === 0")
    .text-4xl.mb-4 🔍
    h3.text-lg.font-semibold.text-base-content.mb-2 Товары не найдены
    p.mb-4.text-base-content/70 Попробуйте изменить параметры поиска или фильтрации
</template>

<script setup>
import ProductCard from './ProductCard.vue'

const props = defineProps({
  viewMode: {
    type: String,
    default: 'grid'
  },
  searchQuery: {
    type: String,
    default: ''
  },
  highlightSearch: {
    type: Boolean,
    default: false
  },
  products: {
    type: Array,
    default: () => []
  }
})

const appState = useAppState()

const safeDisplayedProducts = computed(() => {
  if (!props.products) return []
  return Array.isArray(props.products) ? props.products : []
})

const safeSearchQuery = computed(() => props.searchQuery || '')

const toggleFavoriteHandler = (productId) => {
  try {
    console.log('❤️ ProductList: Переключение избранного для ID:', productId)
    appState.favorites.toggleFavorite(productId)
  } catch (error) {
    console.error('❌ ProductList: Ошибка переключения избранного:', error)
    appState.addNotification('Ошибка при обновлении избранного', 'error')
  }
}

const addToCartHandler = (product) => {
  try {
    console.log('🛒 ProductList: Добавление в корзину:', product.name)
    appState.addToCart(product)
    appState.addNotification(`Товар "${product.name}" добавлен в корзину`, 'success')
  } catch (error) {
    console.error('❌ ProductList: Ошибка добавления в корзину:', error)
    appState.addNotification('Ошибка при добавлении в корзину', 'error')
  }
}
</script>

<style scoped>
.product-list {
  width: 100%;
}
</style>