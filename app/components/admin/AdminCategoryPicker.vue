<!-- app/components/admin/AdminCategoryPicker.vue -->
<template lang="pug">
//- Мультвыбор категорий: чипы + ввод с автодополнением (нативный datalist).
//- Enter / запятая / Tab — добавить; Backspace на пустом поле — убрать последний чип;
//- вставка из буфера «A, B, C» добавляет все три; клик по ✕ — убрать.
.cat-picker.flex.flex-wrap.items-center.gap-1.w-full.min-h-9.p-1.border.rounded-lg.cursor-text(
  class="bg-base-100 border-base-300 focus-within:border-primary"
  :class="{ 'cat-picker--error': error }"
  @click="focusInput"
)
  span.badge.badge-primary.badge-sm.max-w-full(
    class="gap-0.5"
    v-for="cat in model"
    :key="cat"
  )
    span.truncate {{ cat }}
    button.cat-remove.shrink-0.font-bold(
      class="ml-0.5 opacity-70 hover:opacity-100"
      type="button"
      :aria-label="`Убрать категорию ${cat}`"
      :disabled="disabled"
      @click.stop="remove(cat)"
    ) ✕

  input.cat-input.flex-1.min-w-20.h-7.bg-transparent.border-0.outline-none.text-sm(
    ref="inputEl"
    v-model="draft"
    :list="listId"
    :placeholder="model.length === 0 ? placeholder : ''"
    :disabled="disabled"
    :aria-label="placeholder || 'Категории'"
    autocomplete="off"
    @keydown="onKeydown"
    @blur="commitDraft"
  )

  datalist(:id="listId")
    option(v-for="cat in suggestions" :key="cat" :value="cat")
</template>

<script setup>
// ============================================
// Компонент: AdminCategoryPicker
// Мультвыбор категорий для модалок добавления/редактирования товара.
// Заменяет прежние варианты: одиночный select + ручной CSV-инпут
// (добавление) и голое текстовое поле без подсказок (редактирование).
// Подсказки — нативный datalist: работает внутри модалок без борьбы
// с z-index/click-outside, на мобильных тоже.
// Формат значения — string[]; дедупликация точная, как на сервере
// (normalizeCategories в productHelpers).
// ============================================

const props = defineProps({
  /** Справочник известных категорий для подсказок (уже выбранные скрываются) */
  allCategories: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Начните вводить или вставьте через запятую' },
  disabled: { type: Boolean, default: false },
  /** Подсветка ошибки валидации (пустое обязательное поле) */
  error: { type: Boolean, default: false },
})

const model = defineModel({ type: Array, required: true })

const draft = ref('')
const inputEl = ref(null)
const listId = useId()

const suggestions = computed(() =>
  props.allCategories.filter((c) => !model.value.includes(c)),
)

const focusInput = () => {
  inputEl.value?.focus()
}

/** Драфт → массив: «A, B; C» → добавить все три, дубликаты молча игнорируются */
const commitDraft = () => {
  const parts = draft.value.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) return
  const next = [...model.value]
  for (const part of parts) {
    if (!next.includes(part)) next.push(part)
  }
  model.value = next
  draft.value = ''
}

const remove = (cat) => {
  model.value = model.value.filter((c) => c !== cat)
}

const onKeydown = (e) => {
  if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
    // Enter не должен засабмитить форму модалки
    e.preventDefault()
    commitDraft()
  } else if (e.key === 'Tab' && draft.value.trim()) {
    // Tab с непустым вводом — зафиксировать и остаться в поле
    e.preventDefault()
    commitDraft()
  } else if (e.key === 'Backspace' && !draft.value) {
    const last = model.value.at(-1)
    if (last !== undefined) remove(last)
  }
}
</script>

<style scoped>
.cat-picker--error {
  border-color: var(--color-error);
}

.cat-picker--error:focus-within {
  border-color: var(--color-error);
}

.cat-remove {
  cursor: pointer;
}
</style>
