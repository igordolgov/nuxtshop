<!-- app/components/admin/AdminCharacteristicsEditor.vue -->
<!-- Редактор характеристик товара (spec-лист карточки).
     v-model — массив пар [{ label, value }] (сериализуется на сервере
     в Record через sanitizeCharacteristics).
     Чипы-пресеты: специфичные для выбранных категорий + универсальные
     (characteristicPresets); клик добавляет строку с готовым названием.
     Пустые пары на сервер отбрасываются — можно оставлять черновики. -->
<template lang="pug">
.characteristics-editor
  //- Чипы-пресеты: клик — добавить строку с этим названием
  .flex.flex-wrap.gap-1.mb-2
    button.chip.px-2.py-1.rounded-full.text-xs.border.transition-colors(
      v-for="label in presetChips"
      :key="label"
      type="button"
      :disabled="disabled || isLabelUsed(label)"
      :class="isLabelUsed(label) ? 'opacity-40 cursor-default border-base-300' : 'border-base-300 hover:border-primary hover:text-primary'"
      @click="addPreset(label)"
    ) {{ label }}

  //- Строки «название — значение»
  .flex.flex-col.gap-1
    .flex.gap-1.items-center(v-for="(pair, index) in modelValue" :key="index")
      input.input.input-bordered.input-sm.flex-1.min-w-0(
        type="text"
        :value="pair.label"
        maxlength="60"
        :placeholder="$t('admin.characteristics.labelPlaceholder')"
        :aria-label="$t('admin.characteristics.labelAria', { n: index + 1 })"
        :disabled="disabled"
        @input="updatePair(index, 'label', $event.target.value)"
      )
      input.input.input-bordered.input-sm.flex-1.min-w-0(
        type="text"
        :value="pair.value"
        maxlength="300"
        :placeholder="$t('admin.characteristics.valuePlaceholder')"
        :aria-label="$t('admin.characteristics.valueAria', { n: index + 1 })"
        :disabled="disabled"
        @input="updatePair(index, 'value', $event.target.value)"
      )
      button.btn.btn-ghost.btn-xs.btn-square.shrink-0(
        type="button"
        :disabled="disabled"
        :aria-label="$t('admin.characteristics.removeAria')"
        @click="removePair(index)"
      ) ✕

  .text-xs.mt-1(v-if="modelValue.length === 0" class="text-base-content/50")
    | {{ $t('admin.characteristics.emptyHint') }}

  .flex.items-center.gap-2.mt-2
    button.btn.btn-outline.btn-xs(type="button" :disabled="disabled || modelValue.length >= MAX_PAIRS" @click="addCustom")
      | + {{ $t('admin.characteristics.addBtn') }}
    span.text-xs(v-if="modelValue.length >= MAX_PAIRS" class="text-warning")
      | {{ $t('admin.characteristics.maxReached', { n: MAX_PAIRS }) }}
</template>

<script setup>
// ============================================
// Компонент: AdminCharacteristicsEditor
// Чипы-подсказки берутся из выбранных категорий товара
// (presetLabelsForCategories) — «Экран» для смартфонов, «Материал»
// для одежды; использованные названия чипы дизейблятся.
// ============================================
import { presetLabelsForCategories } from '~/utils/characteristicPresets'

const props = defineProps({
  // [{ label: 'Цвет', value: 'Чёрный' }, ...]
  modelValue: { type: Array, default: () => [] },
  // Выбранные категории товара — источник чипов-пресетов
  categories: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

// Лимит пар согласован с CHARACTERISTICS_MAX_PAIRS в server/lib/productHelpers
const MAX_PAIRS = 40

const presetChips = computed(() => presetLabelsForCategories(props.categories))

const isLabelUsed = (label) => props.modelValue.some((pair) => pair?.label === label)

const emitPairs = (pairs) => emit('update:modelValue', pairs)

const addPair = (label = '') => {
  if (props.modelValue.length >= MAX_PAIRS) return
  emitPairs([...props.modelValue, { label, value: '' }])
}

const addPreset = (label) => {
  if (isLabelUsed(label)) return
  addPair(label)
}

const addCustom = () => addPair('')

const updatePair = (index, field, value) => {
  const pairs = props.modelValue.map((pair, i) =>
    i === index ? { ...pair, [field]: value } : pair,
  )
  emitPairs(pairs)
}

const removePair = (index) => {
  emitPairs(props.modelValue.filter((_, i) => i !== index))
}
</script>
