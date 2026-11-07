<!-- app/components/products/ProductCategories.vue -->
<template lang="pug">
.product-categories.pb-2(class="lg:mr-3")
  .section-header.flex.items-center.justify-between.mb-1.bg-base-100.sticky.-top-2.h-8.z-10
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

  //- Без вложенного скролла (на тач-экранах скроллбар невидим и обрезанный
  //- ряд чипов выглядит концом списка — жалоба пользователей): длинный
  //- список сворачивается кнопкой «Ещё {n}» — паттерн маркетплейсов.
  //- Выбранные категории за пределами первых N видны всегда — отмеченное
  //- не прячется в свёрнутую часть списка.
  .categories-list.flex.flex-wrap.gap-1.p-0
    template(v-if="availableCategories.length > 0")
      label.category-item.cursor-pointer.inline-flex.items-center.transition-all.duration-200.px-2.rounded-full.border.text-xs.font-medium(
        v-for="category in visibleCategories"
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

      button.category-more.btn.btn-ghost.btn-xs.rounded-full(
        v-if="hiddenCount > 0 || expanded"
        type="button"
        @click="expanded = !expanded"
      ) {{ expanded ? $t('catalog.collapse') : $t('catalog.categoriesMore', { n: hiddenCount }) }}

    //- Пустое состояние внутри того же контейнера
    .empty-state.py-6.w-full.text-center(v-else)
      .text-4xl.mb-2.opacity-60 📂
      .text-sm.opacity-70.text-base-content {{ $t('catalog.categoriesEmpty') }}
</template>

<script setup>
const props = defineProps({
  searchQuery: { type: String, default: '' },
  categories: { type: Array, default: () => [] },
  selectedCategories: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:selectedCategories'])

//- Сколько категорий видно до кнопки «Ещё {n}»
const VISIBLE_CATEGORIES = 10

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

//- Раскрытие списка (кнопка «Ещё {n}» / «Свернуть»)
const expanded = ref(false)

const visibleCategories = computed(() => {
  const all = availableCategories.value
  if (expanded.value) return all
  const list = all.slice(0, VISIBLE_CATEGORIES)
  //- Выбранные за пределами первых N показываем всегда:
  //- иначе отмеченное остаётся невидимым в свёрнутой части списка
  const missing = localSelectedCategories.value.filter(
    (category) => !list.includes(category)
  )
  return [...list, ...missing]
})

//- Сколько категорий скрыто сворачиванием (число в кнопке «Ещё {n}»):
//- выбранные «хвостовые» уже видимы, поэтому считаем от фактического списка
const hiddenCount = computed(() => {
  if (expanded.value) return 0
  return Math.max(0, availableCategories.value.length - visibleCategories.value.length)
})

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
