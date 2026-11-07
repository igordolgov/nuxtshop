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
    span {{ $t('catalog.filters') }}
    span.pill-count(v-if="activeFiltersCount > 0") {{ activeFiltersCount }}

  //- Сортировка — компактный select
  label.sort-pill.flex.items-center.gap-1.cursor-pointer
    svg.w-4.h-4(
      xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"
      class="hidden sm:block text-base-content/50"
    )
      path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4 4m0 0l4-4m-4 4V9")
    select.select.select-sm.select-ghost.rounded-full.font-semibold(
      :value="sortValue"
      :aria-label="$t('catalog.sortAria')"
      @change="onSortChange"
    )
      option(value="createdAt:desc") {{ $t('catalog.sortNewest') }}
      option(value="price:asc") {{ $t('catalog.sortPriceAsc') }}
      option(value="price:desc") {{ $t('catalog.sortPriceDesc') }}
      option(value="name:asc") {{ $t('catalog.sortName') }}

  //- Чипы активных фильтров (кроме сортировки)
  .chips.flex.items-center.gap-1.flex-wrap(
    v-if="activeChips.length > 0"
  )
    button.chip-item.badge.badge-outline.gap-1.cursor-pointer(
      v-for="chip in activeChips"
      :key="chip.key"
      type="button"
      :title="$t('catalog.removeFilter', { label: chip.label })"
      @click="removeChip(chip)"
    )
      span {{ chip.label }}
      span(class="text-base-content/70") ✕

    button.chip-item.badge.gap-1.cursor-pointer(
      type="button"
      @click="$emit('reset-all')"
    ) {{ $t('catalog.resetAll') }}
</template>

<script setup>
import { countActiveSpecFilters } from '~/utils/specFacets'

const { t } = useI18n()
//- Пилюля фильтров+сортировки. События родителю:
//- toggle-filters, remove-filter, reset-all, update:sort
const props = defineProps({
  filters: { type: Object, default: () => ({}) },
  priceRange: { type: Object, default: () => ({ min: 0, max: 100000 }) },
  sort: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['toggle-filters', 'remove-filter', 'reset-all', 'update:sort'])

// Локализованные подписи категорийных чипов (значения фильтров — сырые)
const { categoryLabel } = useCategoryLabels()

// Локализованные подписи лейблов характеристик (фасетные чипы)
const { specLabel } = useSpecLabels()

// Цена с валютой — единый формат из useProductUtils/store.config
const { formatMoney } = useProductUtils()

//- Нормализация: поддерживаем и {field, order}, и legacy {sortBy, sortOrder}
const normalizedSort = computed(() => {
  const s = props.sort ?? {}
  const field = s.field ?? s.sortBy ?? 'createdAt'
  const order = s.order ?? s.sortOrder ?? 'desc'
  return { field, order }
})

//- Ключ должен СОВПАДАТЬ с одним из option, иначе select пустой
const SORT_OPTIONS = ['createdAt:desc', 'price:asc', 'price:desc', 'name:asc']

const sortValue = computed(() => {
  const key = `${normalizedSort.value.field}:${normalizedSort.value.order}`
  return SORT_OPTIONS.includes(key) ? key : 'createdAt:desc'
})

const onSortChange = (e) => {
  const [field, order] = e.target.value.split(':')
  emit('update:sort', { field, order })
}

//- Счётчик активных фильтров
const activeFiltersCount = computed(() => {
  const f = props.filters ?? {}
  let count = 0
  if (f.categories?.length > 0) count++
  if (f.onlyInStock) count++
  if (f.onlyFavorites) count++
  const min = f.priceRange?.min
  const max = f.priceRange?.max
  if ((min !== null && min !== undefined) || (max !== null && max !== undefined)) count++
  count += countActiveSpecFilters(f.specs)
  return count
})

//- Чипы
const activeChips = computed(() => {
  const chips = []
  const f = props.filters ?? {}

  for (const cat of f.categories ?? []) {
    // Подпись — локализованная (categoryLabel), ключ — сырое значение:
    // снятие фильтра в index.vue сравнивает с f.categories (сырое)
    chips.push({ key: `cat:${cat}`, label: categoryLabel(cat) })
  }

  const min = f.priceRange?.min
  const max = f.priceRange?.max
  if (min !== null && min !== undefined && max !== null && max !== undefined) {
    chips.push({ key: 'price', label: `${formatMoney(min)} – ${formatMoney(max)}` })
  } else if (min !== null && min !== undefined) {
    chips.push({ key: 'price', label: `${t('catalog.from')} ${formatMoney(min)}` })
  } else if (max !== null && max !== undefined) {
    chips.push({ key: 'price', label: `${t('catalog.to')} ${formatMoney(max)}` })
  }

  if (f.onlyInStock) chips.push({ key: 'onlyInStock', label: t('product.inStock') })
  if (f.onlyFavorites) chips.push({ key: 'onlyFavorites', label: t('nav.favorites') })

  //- Фасеты характеристик: один чип на лейбл, снятие убирает все его значения.
  //- Ключ чипа строковый (для :key), НО наружу уходит объект { kind, label }:
  //- лейбл/значение могут содержать «:», парсить строку нельзя
  if (f.specs && typeof f.specs === 'object') {
    for (const [label, values] of Object.entries(f.specs)) {
      if (!Array.isArray(values) || values.length === 0) continue
      chips.push({
        key: `spec:${label}`,
        specLabel: label,
        label: `${specLabel(label)}: ${values.join(', ')}`,
      })
    }
  }

  return chips
})

const removeChip = (chip) => {
  emit('remove-filter', chip.specLabel ? { kind: 'spec', label: chip.specLabel } : chip.key)
}
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

.sort-pill select {
  min-width: 9.5rem;      /* всегда влезает «Сначала новые» */
  height: 2.25rem;        /* ровно с пилюлей «Фильтры» */
  background: var(--color-base-200);
  border: 1px solid var(--color-base-300);
}

.sort-pill select:focus {
  outline: none;
  border-color: var(--color-primary);
}
</style>