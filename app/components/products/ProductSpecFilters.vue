<!-- app/components/products/ProductSpecFilters.vue — фасетные фильтры по
     характеристикам (паттерн WB/Ozon): сворачиваемые группы <details> с
     чипами значений и счётчиками; длинные списки ЗНАЧЕНИЙ внутри группы
     сворачиваются кнопкой с числом «Ещё {n}» — на тач-экранах иначе
     непонятно, есть ли ещё ниже. Сами ГРУППЫ лимита больше не имеют
     («первые 4 + Показать ещё» удалено): рендерятся все. На десктопе
     переполнение гасит внутренний скролл списка; на мобильном (flow)
     список растекается в единый плоский скролл панели — вложенные
     скролл-окна на таче «зависают». Скроллбар — рельса AppScrollArea:
     видна ВСЕГДА, пока список не помещается (нативная полоса на
     мобильных/новых Chrome исчезает при простое и наезжает на шевроны
     групп и кнопки «Ещё N»), и не перекрывает контент — зона под неё
     зарезервирована правым padding вьюпорта. Значения группы — лениво,
     только у открытой (группы с выбранными значениями открываются
     сами — isOpen): SSR/DOM заметно меньше при сотнях групп. Фасеты и
     счётчики считает useFilters (buildSpecFacets) по базовой выборке
     каталога: выбор внутри одной характеристики — ИЛИ, между
     характеристиками — И; выбор в одной группе не обнуляет счётчики
     других. Используется в ProductFilter (десктоп-сайдбар и мобильная
     панель фильтров). -->
<template lang="pug">
.product-spec-filters
  //- Шапка липнет к верху скролла (bg — чипы не просвечивают под ней):
  //- при длинном списке понятно, чья это группа. На десктопе секция и
  //- так не скроллится под шапкой — sticky там нейтрален
  .section-header.flex.items-center.justify-between.min-h-7.sticky.top-0.z-10.bg-base-100
    h4.section-title.text-sm.pb-0.min-h-6.text-base-content {{ $t('catalog.specFilters') }}
    button.btn.btn-ghost.btn-xs.gap-1.rounded-lg(
      v-if="selectedCount > 0"
      type="button"
      @click="clearAll"
    )
      svg.w-3.h-3(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor")
        path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12")
      | {{ $t('catalog.reset') }}

  //- Все группы сразу (авто-разворот по максимуму — лимит «первые 4 +
  //- Показать ещё» удалён): на десктопе переполнение гасит внутренний
  //- скролл списка с постоянной синей рельсой (AppScrollArea), на
  //- мобильном (flow) список растекается в плоский скролл панели.
  //- Значения — лениво, только у ОТКРЫТОЙ группы (группы с выбранными
  //- значениями открываются сами — isOpen)
  AppScrollArea.spec-groups(:flow="flow" v-if="groups.length > 0")
    details.spec-group(
      v-for="group in groups"
      :key="group.label"
      :open="isOpen(group)"
      @toggle="onToggle(group, $event)"
    )
      summary.spec-summary.flex.items-center.justify-between.cursor-pointer.text-sm.font-medium.text-base-content(
        class="py-2 select-none gap-2 md:py-1.5"
      )
        span.truncate.min-w-0 {{ specLabel(group.label) }}
        span.inline-flex.items-center.flex-shrink-0(class="gap-1.5")
          span.spec-total.badge.badge-sm.font-normal(
            class="bg-base-200 text-base-content/60 border-none"
          ) {{ group.productCount }}
          svg.spec-chevron.w-3.h-3.flex-shrink-0(
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            class="text-base-content/40"
          )
            path(stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7")

      .spec-values.flex.flex-wrap.gap-1(class="pb-2 pt-0.5" v-if="isOpen(group)")
        label.spec-chip.cursor-pointer.inline-flex.items-center.px-2.rounded-full.border.text-xs.font-medium.transition-colors(
          v-for="entry in visibleValues(group)"
          :key="entry.value"
          :class="isChecked(group.label, entry.value) ? 'bg-primary text-primary-content border-primary shadow-sm' : 'border-base-content/60'",
          class="py-0.5 hover:border-primary hover:text-primary"
        )
          input.hidden(
            type="checkbox"
            :checked="isChecked(group.label, entry.value)"
            @change="toggle(group.label, entry.value)"
          )
          span.whitespace-nowrap {{ entry.value }}
          span.spec-value-count(class="ml-1 opacity-55") {{ entry.count }}

        button.spec-more.btn.btn-xs.btn-ghost.rounded-full(
          v-if="group.values.length > VISIBLE_VALUES"
          type="button"
          @click="expanded[group.label] ? collapse(group.label) : expand(group.label)"
        ) {{ expanded[group.label] ? $t('catalog.collapse') : $t('catalog.specMore', { n: group.values.length - VISIBLE_VALUES }) }}

  .empty-state.py-3.text-center(v-else)
    .text-sm.opacity-70.text-base-content {{ $t('catalog.specEmpty') }}
</template>

<style scoped>
/* Нативный маркер <details> прячем — свой шеврон с поворотом */
.spec-group summary {
  list-style: none;
}
.spec-group summary::-webkit-details-marker {
  display: none;
}

/* Разделители групп: структура списка читается без коробок */
.spec-group + .spec-group {
  border-top: 1px solid var(--color-base-200);
}

/* Шеврон: поворот у открытой группы (transform — по правилам экономии) */
.spec-chevron {
  transition: transform 0.16s ease;
}
.spec-group[open] .spec-chevron {
  transform: rotate(180deg);
}

/* У выбранного значения счётчик подсвечен — галочка читается и без заливки */
.spec-chip:has(input:checked) .spec-value-count {
  opacity: 0.85;
}
</style>

<script setup>
//- Фасеты приходят готовыми (useFilters → buildSpecFacets); здесь только
//- UI-состояние: раскрытие групп, «ещё N» у длинных списков, выбор значений.
//- <details> нативные: без JS работают и на SSR, состояние раскрытия не
//- попадает в SSR-HTML (первый кадр = SSR, правило гидратации)
const props = defineProps({
  facets: { type: Array, default: () => [] },
  selected: { type: Object, default: () => ({}) },
  //- Flow-режим (мобильная панель): список групп без своего скролла —
  //- растекается в единый плоский скролл панели
  flow: { type: Boolean, default: false },
})

const emit = defineEmits(['update:selected'])

//- Лейблы характеристик: известные (пресеты/сиды) — словарь specLabels.*,
//- кастомные — как есть (контракт локализации товара, как в ProductInfo)
const { specLabel } = useSpecLabels()

const VISIBLE_VALUES = 8

const expanded = ref({})
//- Ручное раскрытие/сворачивание групп (нативный <details> + событие toggle):
//- перекрывает авто-правило «раскрыта группа с выбранными значениями»
const manualOpen = ref(new Map())

const safeSelected = computed(() =>
  props.selected && typeof props.selected === 'object' ? props.selected : {},
)

//- Все группы фасетов (лимита «первые N» больше нет)
const groups = computed(() => (Array.isArray(props.facets) ? props.facets : []))

const selectedCount = computed(() =>
  Object.values(safeSelected.value).filter(
    (values) => Array.isArray(values) && values.length > 0,
  ).length,
)

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

const collapse = (label) => {
  const next = { ...expanded.value }
  delete next[label]
  expanded.value = next
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
