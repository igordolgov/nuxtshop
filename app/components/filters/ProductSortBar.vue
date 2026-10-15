<!-- components/filters/ProductSortBar.vue — строка-пилюля над сеткой:
    [Фильтры (N)] [Сортировка ▾] [чипы активных…]. Паттерн WB/Ozon.
    Сортировка больше не внутри панели фильтров. -->
<template lang="pug">
.sort-bar.flex.items-center.gap-2.flex-wrap(
  class="py-1"
)
  //- Кнопка «Фильтры» — на мобильных открывает панель
  button.filter-pill.btn.btn-sm.rounded-full(
    type="button"
    :class="{ 'pill-active': activeFiltersCount > 0 }"
    @click="$emit('toggle-filters')"
  )
    svg.w-4.h-4(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
      path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z")
    span Фильтры
    span.pill-count(v-if="activeFiltersCount > 0") {{ activeFiltersCount }}

  //- Сортировка — компактный select
  label.sort-pill.flex.items-center.gap-1.cursor-pointer
    svg.w-4.h-4(
      xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"
      class="hidden sm:block text-base-content/50"
    )
      path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4 4m0 0l4-4m-4 4V9")
    select.select.select-sm.select-ghost.rounded-full.font-medium(
      :value="sortValue"
      aria-label="Сортировка"
      @change="onSortChange"
    )
      option(value="createdAt:desc") Сначала новые
      option(value="price:asc") Дешевле
      option(value="price:desc") Дороже
      option(value="name:asc") По названию (А–Я)

  //- Чипы активных фильтров (кроме сортировки)
  .chips.flex.items-center.gap-1.flex-wrap(
    v-if="activeChips.length > 0"
  )
    button.chip-item.badge.badge-outline.gap-1.cursor-pointer(
      v-for="chip in activeChips"
      :key="chip.key"
      type="button"
      :title="`Снять фильтр: ${chip.label}`"
      @click="$emit('remove-filter', chip.key)"
    )
      span {{ chip.label }}
      span(class="text-base-content/50") ✕

    button.chip-item.badge.gap-1.cursor-pointer(
      type="button"
      @click="$emit('reset-all')"
    ) Сбросить всё
</template>

<script setup>
//- Пилюля фильтров+сортировки. События родителю (index.vue):
//- toggle-filters, remove-filter (ключ чипа), reset-all, update:sort
const props = defineProps({
  filters: { type: Object, default: () => ({}) },
  priceRange: { type: Object, default: () => ({ min: 0, max: 100000 }) },
  sort: { type: Object, default: () => ({ field: 'createdAt', order: 'desc' }) },
})

const emit = defineEmits(['toggle-filters', 'remove-filter', 'reset-all', 'update:sort'])

const formatRub = (n) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n ?? 0)

//- Значение select из стейта: "field:order"
const sortValue = computed(
  () => `${props.sort?.field ?? 'createdAt'}:${props.sort?.order ?? 'desc'}`,
)

const onSortChange = (e) => {
  const [field, order] = e.target.value.split(':')
  emit('update:sort', { field, order })
}

//- Счётчик активных фильтров (та же логика, что в index.vue)
const activeFiltersCount = computed(() => {
  const f = props.filters ?? {}
  let count = 0
  if (f.categories?.length > 0) count++
  if (f.onlyInStock) count++
  if (f.onlyFavorites) count++
  const min = f.priceRange?.min
  const max = f.priceRange?.max
  if ((min !== null && min !== undefined) || (max !== null && max !== undefined)) count++
  return count
})

//- Чипы активных фильтров с ключами для снятия
const activeChips = computed(() => {
  const chips = []
  const f = props.filters ?? {}

  for (const cat of f.categories ?? []) {
    chips.push({ key: `cat:${cat}`, label: cat })
  }

  const min = f.priceRange?.min
  const max = f.priceRange?.max
  if (min !== null && min !== undefined && max !== null && max !== undefined) {
    chips.push({ key: 'price', label: `${formatRub(min)} – ${formatRub(max)} ₽` })
  } else if (min !== null && min !== undefined) {
    chips.push({ key: 'price', label: `от ${formatRub(min)} ₽` })
  } else if (max !== null && max !== undefined) {
    chips.push({ key: 'price', label: `до ${formatRub(max)} ₽` })
  }

  if (f.onlyInStock) chips.push({ key: 'onlyInStock', label: 'В наличии' })
  if (f.onlyFavorites) chips.push({ key: 'onlyFavorites', label: 'Избранное' })

  return chips
})
</script>

<style scoped>
.filter-pill.pill-active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: color-mix(in oklab, var(--color-primary) 10%, transparent);
}

.pill-count {
  background: var(--color-primary);
  color: white;
  border-radius: 9999px;
  font-size: 0.7rem;
  min-width: 1.15rem;
  height: 1.15rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.chip-item:hover {
  border-color: var(--color-error);
  color: var(--color-error);
}

.chip-item:last-child:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.sort-pill select:focus {
  outline: none;
}
</style>