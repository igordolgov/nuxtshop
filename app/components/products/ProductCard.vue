<!-- app\components\products\ProductCard.vue -->
<template lang="pug">
component(
  :is="cardComponent",
  :product="product",
  :searchQuery="searchQuery",
  @toggle-favorite="$emit('toggle-favorite', $event)",
  @add-to-cart="$emit('add-to-cart', $event)"
)
</template>

<script setup>
import ProductCardGrid from './ProductCardGrid.vue'
import ProductCardList from './ProductCardList.vue'

const props = defineProps({
  product: {
    type: Object,
    required: true
  },
  viewMode: {
    type: String,
    default: 'grid',
    validator: (value) => ['grid', 'list', 'horizontal'].includes(value)
  },
  searchQuery: {
    type: String,
    default: ''
  }
})

defineEmits(['toggle-favorite', 'add-to-cart'])

// Выбираем компонент в зависимости от режима просмотра
const cardComponent = computed(() => {
  switch (props.viewMode) {
    case 'grid':
      return ProductCardGrid
    case 'list':
      // return ProductCardList
      return ProductCardGrid
    default:
      return ProductCardGrid
  }
})
</script>