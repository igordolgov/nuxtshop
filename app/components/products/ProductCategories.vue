<!-- app/components/products/ProductCategories.vue -->
<template lang="pug">
.product-categories.pb-2(class="lg:mr-3")
  .section-header.flex.items-center.justify-between.mb-1.bg-base-100.sticky.-top-2.h-8.z-10
    h4.section-title.text-sm.pb-0.min-h-6.text-base-content Категории:
    .flex.items-center.gap-2
      button.btn.btn-xs.btn-primary(
        @click="selectAllCategories"
        v-if="localSelectedCategories.length > 0"
      ) Выбраны: {{ localSelectedCategories.length }}
      button.btn.btn-xs.btn-secondary(
        @click="clearCategories" 
        v-if="localSelectedCategories.length > 0"
      ) Показать все

  .categories-container.max-h-100.overflow-y-auto
    //- Всегда один контейнер с gap-1
    .flex.flex-wrap.gap-1.p-0
      template(v-if="availableCategories.length > 0")
        label.category-item.cursor-pointer.inline-flex.items-center.transition-all.duration-200.px-2.py-1.rounded-full.border.text-xs(
          v-for="category in sortedCategories"
          :key="category"
          :class="isSelected(category) ? 'bg-primary text-primary-content border-primary shadow-sm' : 'border-base-content/40'",
          class="hover:bg-primary/50 hover:text-white"
        )
          input.hidden(
            type="checkbox"
            :value="category"
            v-model="localSelectedCategories"
          )
          span.whitespace-nowrap(v-html="highlightSearchText(category)")
      
      //- Пустое состояние внутри того же контейнера
      .empty-state.py-6.w-full.text-center(v-else)
        .text-4xl.mb-2.opacity-60 📂
        .text-sm.opacity-70.text-base-content Категории не найдены
</template>

<script setup>
const props = defineProps({
  searchQuery: { type: String, default: '' },
  categories: { type: Array, default: () => [] },
  selectedCategories: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:selectedCategories'])

const localSelectedCategories = computed({
  get: () => props.selectedCategories || [],
  set: (value) => {
    emit('update:selectedCategories', value)
  }
})

const sortedCategories = computed(() => {
  const categories = [...(props.categories || [])]
  return categories.sort((a, b) => {
    if (a.length !== b.length) {
      return a.length - b.length
    }
    return a.localeCompare(b)
  })
})

const availableCategories = computed(() => sortedCategories.value)

const isSelected = (category) => {
  return localSelectedCategories.value.includes(category)
}

const highlightSearchText = (text) => {
  if (!props.searchQuery || !text) return text
  
  const searchRegex = new RegExp(`(${escapeRegex(props.searchQuery)})`, 'gi')
  return text.replace(searchRegex, '<mark class="search-highlight">$1</mark>')
}

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const selectAllCategories = () => {
  localSelectedCategories.value = [...sortedCategories.value]
}

const clearCategories = () => {
  localSelectedCategories.value = []
}

const resetCategories = () => {
  clearCategories()
}

defineExpose({
  resetCategories,
  selectAllCategories,
  clearCategories
})
</script>

<style scoped>
.categories-container {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--bc) / 0.3) transparent;
}

.categories-container::-webkit-scrollbar {
  width: 4px;
}

.categories-container::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 2px;
}

.categories-container::-webkit-scrollbar-thumb {
  background-color: hsl(var(--bc) / 0.3);
  border-radius: 2px;
}

.categories-container::-webkit-scrollbar-thumb:hover {
  background-color: hsl(var(--bc) / 0.5);
}

@media (max-width: 768px) {
  .categories-container {
    max-height: 280px;
  }
  
  .category-item {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
  }
}
</style>

<style>
.search-highlight {
  background: linear-gradient(120deg, #ffd05a, #ffe572) !important;
  color: #1f2937 !important;
  border-radius: 3px !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1) !important;
}
</style>