<!-- app/components/admin/AdminProductsFilters.vue -->
<template lang="pug">
.flex.flex-col.gap-2(class="sm:flex-row sm:items-center sm:flex-wrap")
  //- Поиск
  .relative.w-full(class="sm:w-48")
    input.input.input-sm.input-bordered.w-full.pr-8(
      type="text"
      :placeholder="$t('admin.products.searchPlaceholder')"
      :value="searchQuery"
      @input="$emit('update:searchQuery', $event.target.value)"
    )
    button.absolute.right-1.top-1.btn.btn-xs.btn-ghost.p-0(
      v-if="searchQuery"
      @click="$emit('update:searchQuery', '')"
      type="button"
    )
      icon(name="heroicons:x-mark" class="w-4 h-4")

  //- Фильтры статуса: активный — заливка, неактивный — outline.
  //- text-white/opacity-70 сняты: белый на светлом btn-secondary
  //- проваливал контраст, полупрозрачность выглядела «выключенной»
  .flex.gap-1.flex-wrap
    button.btn.btn-xs(
      v-for="filter in statusFilters"
      :key="filter.value"
      :class="currentFilter === filter.value ? 'btn-primary' : 'btn-outline'"
      :aria-pressed="currentFilter === filter.value"
      @click="$emit('update:currentFilter', filter.value)"
      type="button"
    ) {{ filter.label }}

  //- Dropdowns
  slot(name="dropdowns")
</template>

<script setup>
defineProps({
  searchQuery: { type: String, default: '' },
  currentFilter: { type: String, default: 'all' },
  statusFilters: { type: Array, default: () => [] }
})

defineEmits(['update:searchQuery', 'update:currentFilter'])
</script>