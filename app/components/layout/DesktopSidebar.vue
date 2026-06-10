<!-- components/layout/DesktopSidebar.vue -->
<template lang="pug">
aside.desktop-sidebar.bg-base-100.rounded-box.shadow-sm(
  :class="sidebarClasses"
)
  ProductFilter(
    :total-count="totalCount"
    :filtered-count="filteredCount"
    :show-product-count="true"
    :searchQuery="searchQuery"
    :categories="categories"
    :filters="filters"
    :sort="sort"
    :priceRange="priceRange"
    :isHorizontal="isMobile"
    @update:filters="handleFiltersUpdate"
    @update:sort="handleSortUpdate"
    @update:searchQuery="handleSearchQueryUpdate"
    @reset-filters="handleResetFilters"
    @scroll-to-top="handleScrollToTop"
  )
</template>

<style scoped>
.desktop-sidebar {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.desktop-sidebar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.desktop-sidebar::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 3px;
}

.desktop-sidebar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.desktop-sidebar::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* На мобильных делаем горизонтальную прокрутку */
@media (max-width: 1023px) {
  .desktop-sidebar {
    max-height: 300px;
    margin-bottom: 1rem;
  }
}
</style>

<script setup>
import ProductFilter from '~/components/products/ProductFilter.vue'
import { useMobileDetection } from '@/composables/useMobileDetection'

const { isMobile } = useMobileDetection()

// Адаптивные классы для сайдбара
const sidebarClasses = computed(() => {
  const base = ['sticky', 'top-0']
  
  if (isMobile.value) {
    // На мобильных: горизонтальный скролл, другая высота
    return [...base, 'h-auto', 'overflow-x-auto', 'pb-4']
  } else {
    // На десктопе: вертикальный скролл, фиксированная высота
    return [...base, 'h-[calc(100dvh-5rem)]', 'overflow-y-auto']
  }
})

// Обработчик обновления фильтров (сохраняем сортировку)
const handleFiltersUpdate = (filters) => {
  emit('update:filters', filters)
}

// Обработчик обновления сортировки
const handleSortUpdate = (sort) => {
  console.log('📱 DesktopSidebar: обновление сортировки', sort)
  emit('update:sort', sort)
}

// Обработчик обновления поискового запроса
const handleSearchQueryUpdate = (query) => {
  emit('update:searchQuery', query)
}

// Обработчик сброса фильтров (БЕЗ сброса сортировки)
const handleResetFilters = () => {
  console.log('🔄 DesktopSidebar: сброс фильтров (без сортировки)')
  emit('reset-filters')
}

// Обработчик прокрутки к началу
const handleScrollToTop = () => {
  emit('scroll-to-top')
}

// ДОБАВЬТЕ эти пропсы
defineProps({
  searchQuery: {
    type: String,
    default: ''
  },
  categories: {
    type: Array,
    default: () => []
  },
  filters: {
    type: Object,
    default: () => ({})
  },
  sort: {
    type: Object,
    default: () => ({})
  },
  priceRange: {
    type: Object,
    default: () => ({})
  },
  // ДОБАВЬТЕ эти пропсы для количества товаров
  totalCount: {
    type: Number,
    default: 0
  },
  filteredCount: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits([
  'update:filters',
  'update:sort',
  'update:searchQuery',
  'reset-filters',
  'scroll-to-top'
])
</script>