<template lang="pug">
.active-filters
  .active-filter.badge.badge-primary.gap-2(v-if="priceFilterText") {{ priceFilterText }}
    button.btn.btn-xs.btn-circle.btn-ghost.p-0(class="hover:bg-base-100" @click="resetPriceFilter")
      svg.h-3.w-3(xmlns="http://www.w3.org/2000/svg", fill="none", viewBox="0 0 24 24", stroke="currentColor")
        path(stroke-linecap="round", stroke-linejoin="round", stroke-width="2", d="M6 18L18 6M6 6l12 12")
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