<!-- app/components/products/ProductSpecFilters.vue — фасетные фильтры по
     характеристикам (паттерн WB/Ozon): сворачиваемые группы <details> с
     чекбокс-чипами значений и счётчиками. Фасеты и счётчики считает
     useFilters (buildSpecFacets) по базовой выборке каталога: выбор внутри
     одной характеристики — ИЛИ, между характеристиками — И; выбор в одной
     группе не обнуляет счётчики других. Используется в ProductFilter
     (десктоп-сайдбар и мобильная панель фильтров). -->
<template lang="pug">
.product-spec-filters.pb-2(class="lg:mr-3")
  .section-header.flex.items-center.justify-between.mb-1
    h4.section-title.text-sm.pb-0.min-h-6.text-base-content {{ $t('catalog.specFilters') }}
    button.btn.btn-xs.btn-secondary(
      v-if="selectedCount > 0"
      type="button"
      @click="clearAll"
    ) {{ $t('catalog.reset') }}

  .spec-groups(v-if="facets.length > 0")
    details.spec-group(
      v-for="group in visibleGroups"
      :key="group.label"
      :open="isOpen(group)"
      @toggle="onToggle(group, $event)"
    )
      summary.spec-summary.flex.items-center.justify-between.cursor-pointer.text-sm.font-medium.text-base-content(
        class="py-1 select-none"
      )
        span.inline-flex.items-center.gap-1.min-w-0
          span.truncate {{ specLabel(group.label) }}
          span.spec-count.text-xs.flex-shrink-0(class="text-base-content/50") {{ group.productCount }}
        svg.w-3.h-3.flex-shrink-0.transition-transform(
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          class="text-base-content/40"
        )
          path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7")

      .spec-values.flex.flex-wrap.gap-1(class="pb-2 pt-1")
        label.spec-chip.cursor-pointer.inline-flex.items-center.px-2.rounded-full.border.text-xs.font-medium(
          v-for="entry in visibleValues(group)"
          :key="entry.value"
          :class="isChecked(group.label, entry.value) ? 'bg-primary text-primary-content border-primary shadow-sm' : 'border-base-content/60'",
          class="py-0.5 hover:bg-primary/20 hover:text-primary"
        )
          input.hidden(
            type="checkbox"
            :checked="isChecked(group.label, entry.value)"
            @change="toggle(group.label, entry.value)"
          )
          span.whitespace-nowrap {{ entry.value }}
          span.spec-value-count(class="ml-1 opacity-60") {{ entry.count }}

        button.spec-more.btn.btn-xs.btn-ghost(
          v-if="group.values.length > VISIBLE_VALUES && !expanded[group.label]"
          type="button"
          @click="expand(group.label)"
        ) {{ $t('catalog.specMore', { n: group.values.length - VISIBLE_VALUES }) }}

    button.spec-show-all.btn.btn-xs.btn-outline.w-full.mt-1(
      v-if="hiddenGroupsCount > 0"
      type="button"
      @click="showAllGroups = true"
    ) {{ $t('catalog.specShowAll') }}

  .empty-state.py-4.text-center(v-else)
    .text-sm.opacity-70.text-base-content {{ $t('catalog.specEmpty') }}
</template>

<script setup>
//- Фасеты приходят готовыми (useFilters → buildSpecFacets); здесь только
//- UI-состояние: раскрытие групп, «ещё N» у длинных списков, выбор значений.
//- <details> нативные: без JS работают и на SSR, состояние раскрытия не
//- попадает в SSR-HTML (первый кадр = SSR, правило гидратации).
const props = defineProps({
  facets: { type: Array, default: () => [] },
  selected: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:selected'])

//- Лейблы характеристик: известные (пресеты/сиды) — словарь specLabels.*,
//- кастомные — как есть (контракт локализации товара, как в ProductInfo)
const { specLabel } = useSpecLabels()

const VISIBLE_VALUES = 8
const MAX_GROUPS = 10

const expanded = ref({})
const showAllGroups = ref(false)
//- Ручное раскрытие/сворачивание групп (нативный <details> + событие toggle):
//- перекрывает авто-правило «раскрыта группа с выбранными значениями»
const manualOpen = ref(new Map())

const safeSelected = computed(() =>
  props.selected && typeof props.selected === 'object' ? props.selected : {},
)

const selectedCount = computed(() =>
  Object.values(safeSelected.value).filter(
    (values) => Array.isArray(values) && values.length > 0,
  ).length,
)

const visibleGroups = computed(() => {
  const list = Array.isArray(props.facets) ? props.facets : []
  return showAllGroups.value ? list : list.slice(0, MAX_GROUPS)
})

const hiddenGroupsCount = computed(() => {
  const total = Array.isArray(props.facets) ? props.facets.length : 0
  return Math.max(0, total - visibleGroups.value.length)
})

const isChecked = (label, value) => (safeSelected.value[label] ?? []).includes(value)

const toggle = (label, value) => {
  const next = { ...safeSelected.value }
  const values = [...(next[label] ?? [])]
  const index = values.indexOf(value)
  if (index >= 0) values.splice(index, 1)
  else values.push(value)
  if (values.length > 0) next[label] = values
  else delete next[label]
  emit('update:selected', next)
}

const clearAll = () => emit('update:selected', {})

const visibleValues = (group) => {
  const list = expanded.value[group.label]
    ? group.values
    : group.values.slice(0, VISIBLE_VALUES)
  //- Выбранные значения за пределами первых N показываем всегда:
  //- иначе отмеченное остаётся невидимым в свёрнутой части списка
  const selectedValues = safeSelected.value[group.label] ?? []
  const missing = selectedValues
    .filter((value) => !list.some((entry) => entry.value === value))
    .map((value) => ({ value, count: 0 }))
  return [...list, ...missing]
}

const expand = (label) => {
  expanded.value = { ...expanded.value, [label]: true }
}

const isOpen = (group) => {
  const manual = manualOpen.value.get(group.label)
  if (manual !== undefined) return manual
  return (safeSelected.value[group.label] ?? []).length > 0
}

const onToggle = (group, event) => {
  manualOpen.value = new Map(manualOpen.value).set(group.label, Boolean(event?.target?.open))
}
</script>
