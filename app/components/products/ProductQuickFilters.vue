<!-- app/components/products/ProductQuickFilters.vue — быстрый фильтр
     «Только в наличии». Вынесен из ProductFilter, чтобы десктопный
     сайдбар и мобильная панель закрепляли его ВНИЗУ (всегда виден,
     а списки выше скроллятся — паттерн маркетплейсов), не дублируя
     логику. Состояние живёт в родителе: изменение уходит наверх
     парой (ключ, значение).
     Чекбокс «Только избранное» убран из витринных фильтров (решение
     владельца: страница избранного и так в навигации); если фильтр
     активен (например, из сохранённого URL), снять его можно чипом
     над сеткой товаров. -->
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
</template>

<script setup>
const props = defineProps({
  filters: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['change'])

const safeFilters = computed(() => ({
  onlyInStock: Boolean(props.filters?.onlyInStock),
}))
</script>
