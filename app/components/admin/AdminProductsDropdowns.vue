<!-- app/components/admin/AdminProductsDropdowns.vue -->
<template lang="pug">
.flex.items-center.gap-2.flex-wrap
  //- Категории
  .dropdown.dropdown-bottom(:class="{'dropdown-open': showCategories}")
    label.btn.btn-xs.bg-primary.gap-0(@click="showCategories = !showCategories" type="button")
      | {{ $t('admin.products.categoriesLabel') }}
      span.badge.badge-sm.-pl-0.badge-primary(v-if="selectedCount") {{ $t('admin.products.categoriesSelected', { n: selectedCount }) }}
      span.badge.badge-sm.-pl-0.badge-primary(v-else) {{ $t('admin.products.categoriesAll') }}
      icon(name="heroicons:chevron-down" class="w-3 h-3")
    .dropdown-content.menu.p-2.shadow-lg.bg-base-100.rounded-box.w-52.z-50.mt-1(v-if="showCategories" @click.stop)
      .max-h-60.overflow-y-auto
        label.label.cursor-pointer.justify-start.gap-2.py-1.px-2(class="hover:bg-base-200" rounded
          v-for="cat in categories"
          :key="cat"
        )
          input.checkbox.checkbox-sm(
            type="checkbox"
            :checked="selectedCategories.includes(cat)"
            @change="$emit('toggle', cat)"
          )
          //- Подпись — в текущей локали (categoryLabels); значение фильтра
          //- остаётся сырым, поэтому фильтрация по категориям не меняется
          span.label-text {{ categoryLabels?.get(cat) ?? cat }}
      .divider.my-1(v-if="selectedCount")
      button.btn.btn-xs.btn-ghost.w-full(v-if="selectedCount" @click="clearAndClose" type="button") {{ $t('admin.products.resetFilter') }}

  //- Сортировка - кнопки (скрываются на мобильных, показывается dropdown)
  .hidden(class="sm:flex sm:items-center sm:gap-1")
    span.text-xs.opacity-60 {{ $t('admin.products.sortLabel') }}
    button.btn.btn-xs.gap-1(
      v-for="opt in sortOptions"
      :key="opt.field"
      :class="sortField === opt.field ? 'btn-primary' : 'btn-secondary'"
      @click="$emit('sort', opt.field)"
      type="button"
    )
      span {{ opt.label }}
      icon(
        v-if="sortField === opt.field"
        :name="sortDirection === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'"
        class="w-3 h-3"
      )

  //- Сортировка - dropdown для мобильных
  .dropdown.dropdown-bottom(class="sm:hidden" :class="{'dropdown-open': showSort}")
    label.btn.btn-xs.btn-outline.gap-1(@click="showSort = !showSort" type="button")
      | {{ $t('admin.products.sort') }}
      icon(name="heroicons:chevron-down" class="w-3 h-3")
    .dropdown-content.menu.p-2.shadow-lg.bg-base-100.rounded-box.w-40.z-50.mt-1(v-if="showSort" @click.stop)
      .px-2.py-1.cursor-pointer(class="hover:bg-base-200" rounded
        v-for="opt in sortOptions"
        :key="opt.field"
        @click="selectSort(opt.field)"
      )
        .flex.justify-between.items-center.w-full.text-sm
          span {{ opt.label }}
          span.ml-2(v-if="sortField === opt.field")
            | {{ sortDirection === 'asc' ? '↑' : '↓' }}
</template>

<script setup>
const props = defineProps({
  categories: { type: Array, default: () => [] },
  // Map «сырая категория → подпись в текущей локали» (необязателен:
  // без него и на ru — сырые значения)
  categoryLabels: { type: Map, default: null },
  selectedCategories: { type: Array, default: () => [] },
  sortOptions: { type: Array, default: () => [] },
  sortField: { type: String, default: 'createdAt' },
  sortDirection: { type: String, default: 'desc' }
})

const emit = defineEmits(['toggle', 'selectAll', 'clear', 'sort'])

const showCategories = ref(false)
const showSort = ref(false)

const selectedCount = computed(() => props.selectedCategories.length)

const clearAndClose = () => {
  emit('clear')
  showCategories.value = false
}

const selectSort = (field) => {
  emit('sort', field)
  showSort.value = false
}

onMounted(() => {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
      showCategories.value = false
      showSort.value = false
    }
  })
})
</script>

<style scoped>
.dropdown-content {
  max-height: 300px;
}
</style>