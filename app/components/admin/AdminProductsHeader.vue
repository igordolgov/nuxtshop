<!-- app/components/admin/AdminProductsHeader.vue -->
<template lang="pug">
.bg-base-100.border-b.border-base-300.shadow-sm
  .px-2.py-2(class="sm:px-4")
    .flex.items-center.justify-between.gap-2
      //- Левая часть
      .flex.items-center.gap-2
        h1.text-base.font-bold(class="sm:text-lg") Товары
        .text-base-content.pt-1 (всего: {{ stats.total }})

      //- Правая часть
      .flex.items-center.gap-3
        button.btn-sm.btn-square.cursor-pointer(
          @click="$emit('refresh')"
          title="Обновить"
          type="button"
        )
          icon(name="heroicons:arrow-path" size="20")
        button.btn.btn-sm.btn-primary.btn-square(
          @click="$emit('add')"
          title="Добавить"
          type="button"
          class="sm:btn-auto"
        )
          icon(name="heroicons:plus" size="20")
          span.hidden.sm-inline.ml-1 Добавить

    //- Фильтры строкой ниже
    .mt-2
      slot(name="filters")
</template>

<script setup>
defineProps({
  stats: {
    type: Object,
    default: () => ({ total: 0 })
  }
})

defineEmits(['add', 'refresh', 'export'])
</script>