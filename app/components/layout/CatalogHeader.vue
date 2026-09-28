<!-- components/layout/CatalogHeader.vue -->
<template lang="pug">
.catalog-header.z-30.bg-base-100.shadow-lg
  .px-4.py-3
    .flex.items-center.justify-between
      .flex.items-center.gap-3
        h1.text-xl.font-bold.text-base-content 
        .badge.badge-lg.badge-outline
          | {{ displayedProductsCount }} / {{ totalProductsCount }}
      
      .flex.items-center.gap-2
        //- Кнопка фильтров (только для десктопа)
        .relative(class="hidden lg:block")
          button.btn.btn-sm.btn-primary(
            @click="$emit('toggleFilters')"
            :disabled="isLoading"
          )
            svg.w-4.h-4.mr-1(
              :class="{ 'animate-spin': isLoading }",
              xmlns="http://www.w3.org/2000/svg", 
              fill="none", 
              viewBox="0 0 24 24", 
              stroke="currentColor"
            )
              path(stroke-linecap="round", stroke-linejoin="round", stroke-width="2", d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z")
            span.text-xs Фильтры
            .absolute.-top-2.-right-2.badge.badge-sm.badge-error(
              v-if="activeFiltersCount > 0"
            ) {{ activeFiltersCount }}

        //- Кнопка обновления
        button.btn.btn-sm.btn-ghost(
          @click="$emit('refreshProducts')",
          :disabled="isLoading"
          class="hidden lg:flex"
        )
          svg.w-4.h-4(
            :class="{ 'animate-spin': isLoading }",
            xmlns="http://www.w3.org/2000/svg",
            fill="none",
            viewBox="0 0 24 24",
            stroke="currentColor"
          )
            path(stroke-linecap="round", stroke-linejoin="round", stroke-width="2", d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15")
</template>

<script setup>
defineProps({
  activeFiltersCount: {
    type: Number,
    default: 0
  },
  displayedProductsCount: {
    type: Number,
    default: 0
  },
  totalProductsCount: {
    type: Number,
    default: 0
  },
  isLoading: {
    type: Boolean,
    default: false
  }
})

defineEmits(['toggleFilters', 'refreshProducts'])
</script>

<style scoped>
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>