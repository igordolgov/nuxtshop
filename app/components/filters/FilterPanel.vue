<!-- FilterPanel.vue -->
<template lang="pug">
.filter-panel(
  class="h-full sticky top-16 border-r border-base-300 transition-all duration-300 z-30"
  :class="panelClasses"
)
  .filter-content.h-full.overflow-y-auto(:class="isMobile ? 'w-full' : 'w-80'")
    ProductFilter(
      :total-count="totalProducts"
      :filtered-count="filteredProducts"
      :show-product-count="true"
      :filters="filters"
      :categories="categories"
      :sort="sort"
      :priceRange="priceRange"
      :searchQuery="searchQuery"
      @update:filters="$emit('update:filters', $event)"
      @update:sort="$emit('update:sort', $event)"
      @update:searchQuery="$emit('update:searchQuery', $event)"
      @reset-filters="$emit('reset-filters')"
    )
    
    //- Кнопка закрытия на мобильных
    button.btn.btn-sm.btn-ghost.absolute.top-4.right-4(
      @click="$emit('close-mobile-filters')"
      class="lg:hidden"
    )
      svg.w-5.h-5(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
        path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12")
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  isMobile: Boolean,
  mobileFilterOpen: Boolean,
  filters: Object,
  categories: Array,
  sort: Object,
  priceRange: Object,
  searchQuery: String,
  // Новые пропсы для количества товаров
  productCount: {
    type: Object,
    default: () => null
  },
  filteredCount: {
    type: Number,
    default: 0
  },
  totalCount: {
    type: Number,
    default: 0
  }
})

defineEmits([
  'update:filters',
  'update:sort',
  'update:searchQuery', 
  'reset-filters',
  'close-mobile-filters'
])

const panelClasses = computed(() => {
  if (!props.isMobile) {
    return 'w-80 flex-shrink-0'
  } else {
    return props.mobileFilterOpen 
      ? 'fixed inset-0 bg-base-100 transform translate-x-0' 
      : 'fixed inset-0 bg-base-100 transform -translate-x-full'
  }
})
</script>