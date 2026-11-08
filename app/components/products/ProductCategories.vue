<!-- app/components/products/ProductCategories.vue — фильтр по категориям:
    чипы с подсветкой поиска. Список разворачивается ПО МАКСИМУМУ
    (без жёсткого лимита «первые 10 + Ещё N»: у сайдбара/панели есть
    свободная высота — чипы занимают её сами). Если развёрнутый список
    не помещается — на десктопе секция сжимается и список скроллится
    внутри (постоянную синюю рельсу задаёт AppScrollArea); на мобильном
    (flow) список растекается в единый плоский скролл панели. -->
<template lang="pug">
.product-categories.pb-2(class="lg:mr-3")
  .section-header.flex.items-center.justify-between.mb-1.bg-base-100.sticky.top-0.h-8.z-10
    h4.section-title.text-sm.pb-0.min-h-6.text-base-content {{ $t('catalog.categories') }}
    .flex.items-center.gap-2
      button.btn.btn-xs.btn-primary(
        @click="selectAllCategories"
        v-if="localSelectedCategories.length > 0"
      ) {{ $t('catalog.selected', { n: localSelectedCategories.length }) }}
      button.btn.btn-xs.btn-secondary(
        @click="clearCategories"
        v-if="localSelectedCategories.length > 0"
      ) {{ $t('catalog.showAll') }}

  //- Все категории сразу (разворот по максимуму — жёсткий лимит
  //- «первые 10 + Ещё N» удалён): переполнение гасит внутренний
  //- скролл списка с постоянной синей рельсой (AppScrollArea),
  //- а не кнопка «Ещё N»
  AppScrollArea.categories-scroll(:flow="flow" contentClass="flex flex-wrap gap-1 p-0")
    template(v-if="availableCategories.length > 0")
      label.category-item.cursor-pointer.inline-flex.items-center.transition-all.duration-200.px-2.rounded-full.border.text-xs.font-medium(
        v-for="category in availableCategories"
        :key="category"
        :class="isSelected(category) ? 'bg-primary text-primary-content border-primary shadow-sm' : 'border-base-content/60'",
        class="py-0.5 hover:bg-primary/20 hover:text-primary"
      )
        input.hidden(
          type="checkbox"
          :value="category"
          v-model="localSelectedCategories"
        )
        span.whitespace-nowrap {{ categoryLabel(category) }}

    //- Пустое состояние внутри того же контейнера
    .empty-state.py-6.w-full.text-center(v-else)
      .text-4xl.mb-2.opacity-60 📂
      .text-sm.opacity-70.text-base-content {{ $t('catalog.categoriesEmpty') }}
</template>

<script setup>
const props = defineProps({
  searchQuery: { type: String, default: '' },
  categories: { type: Array, default: () => [] },
  selectedCategories: { type: Array, default: () => [] },
  //- Flow-режим (мобильная панель): список без своего скролла —
  //- растекается в единый плоский скролл панели
  flow: { type: Boolean, default: false },
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

// Подписи чипов — локализованные (значения фильтров остаются сырыми);
// сортировка остаётся по сырым значениям — порядок стабилен между локалями
const { categoryLabel } = useCategoryLabels()

const availableCategories = computed(() => sortedCategories.value)

const isSelected = (category) => {
  return localSelectedCategories.value.includes(category)
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
@media (max-width: 768px) {
  .category-item {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
  }
}
</style>

<style>
</style>
