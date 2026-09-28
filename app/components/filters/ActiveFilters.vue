<template lang="pug">
.active-filters
  .active-filter.badge.badge-primary.gap-2(v-if="priceFilterText") {{ priceFilterText }}
    button.btn.btn-xs.btn-circle.btn-ghost(@click="resetPriceFilter") ×
</template>

<script setup>
// Используем глобальное состояние для фильтров
const { 
  filters,
  resetFilters
} = useAppState()

const priceFilterText = computed(() => {
  const { min, max } = filters.priceRange || {}
  if (min !== null || max !== null) {
    const minText = min !== null ? formatPrice(min) : '0'
    const maxText = max !== null ? formatPrice(max) : '∞'
    return `Цена: ${minText}-${maxText}₽`
  }
  return ''
})

const formatPrice = (price) => {
  return new Intl.NumberFormat('ru-RU').format(price)
}

const resetPriceFilter = () => {
  filters.priceRange = { min: null, max: null }
}
</script>