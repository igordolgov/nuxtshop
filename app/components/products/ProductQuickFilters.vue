<!-- app/components/products/ProductQuickFilters.vue — быстрые фильтры
     «Только в наличии» и «Только избранное». Вынесены из ProductFilter,
     чтобы мобильная панель могла закрепить их НАД кнопкой «Показать N»
     (всегда видны, а характеристики скроллятся под ними — паттерн
     маркетплейсов), не дублируя логику. Состояние живёт в родителе:
     изменение уходит наверх парой (ключ, значение). -->
<template lang="pug">
label.quick-filter.flex.items-center.cursor-pointer.select-none(
  class="py-1 gap-2.5"
)
  input.checkbox.checkbox-sm.checkbox-primary(
    type="checkbox"
    :checked="safeFilters.onlyInStock"
    @change="emit('change', 'onlyInStock', $event.target.checked)"
  )
  span.text-sm.text-base-content {{ $t('catalog.inStockOnly') }}

label.quick-filter.flex.items-center.cursor-pointer.select-none(
  class="py-1 gap-2.5"
)
  input.checkbox.checkbox-sm.checkbox-error(
    type="checkbox"
    :checked="safeFilters.onlyFavorites"
    @change="emit('change', 'onlyFavorites', $event.target.checked)"
  )
  span.text-sm.text-base-content {{ $t('catalog.favoritesOnly') }}
</template>

<script setup>
const props = defineProps({
  filters: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['change'])

const safeFilters = computed(() => ({
  onlyInStock: Boolean(props.filters?.onlyInStock),
  onlyFavorites: Boolean(props.filters?.onlyFavorites),
}))
</script>
