<!-- app/components/admin/AdminCategoryPicker.vue -->
<template lang="pug">
//- Мультвыбор категорий: чипы + ввод с КАСТОМНЫМ выпадающим списком.
//- Раньше подсказки были на нативном datalist — на телефонах внутри
//- модалок он часто не раскрывается (iOS Safari не показывает список
//- при программном фокусе, у ряда Android-браузеров он пуст или
//- прячется за клавиатурой). Своя панель — обычный DOM: открывается
//- по тапу на любом устройстве, не зависит от нативных попапов.
//- Enter / запятая / Tab — добавить; Backspace на пустом поле — убрать
//- последний чип; вставка «A, B, C» добавляет все три; клик по строке
//- списка — добавить; клик по «＋ Добавить …» — ввести новое значение;
//- клик по ✕ — убрать. Стрелки ↑↓ — навигация, Esc — закрыть список.
.cat-picker.relative.w-full(ref="pickerEl" @focusout="onFocusout")
  .cat-box.flex.flex-wrap.items-center.gap-1.w-full.min-h-9.p-1.border.rounded-lg.cursor-text(
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
        :aria-label="$t('admin.categoryPicker.removeAria', { name: cat })"
        :disabled="disabled"
        @click.stop="remove(cat)"
      ) ✕

    input.cat-input.flex-1.min-w-20.h-7.bg-transparent.border-0.outline-none(
      ref="inputEl"
      v-model="draft"
      :placeholder="model.length === 0 ? placeholder || $t('admin.categoryPicker.placeholder') : ''"
      :disabled="disabled"
      :aria-label="placeholder || $t('admin.categoryPicker.ariaLabel')"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="panelVisible"
      autocomplete="off"
      class="text-base sm:text-sm"
      @focus="openList"
      @click="openList"
      @keydown="onKeydown"
    )

  //- Выпадающая панель: подсказки + строка «добавить новое».
  //- Абсолютно позиционирована относительно пикера; если снизу мало
  //- места (поле у нижнего края экрана) — раскрывается вверх.
  .cat-list.absolute.left-0.right-0.z-50.mt-1.border.border-base-300.rounded-lg.shadow-lg.bg-base-100.overflow-y-auto(
    v-if="panelVisible"
    :class="dropUp ? 'bottom-full mb-1' : 'top-full'"
    role="listbox"
  )
    button.cat-option.w-full.text-left.px-3.py-2.text-sm(
      v-for="(cat, i) in visibleSuggestions"
      :key="cat"
      type="button"
      role="option"
      :aria-selected="false"
      class="min-h-10 flex items-center gap-2"
      :class="i === highlightIndex ? ['bg-primary/10', 'cat-option--active'] : 'hover:bg-base-200'"
      @mousemove="highlightIndex = i"
      @mousedown.prevent
      @click="pick(cat)"
    ) {{ cat }}

    button.cat-option.w-full.text-left.px-3.py-2.text-sm.border-t.border-base-300(
      v-if="canAddDraft"
      type="button"
      class="min-h-10 flex items-start gap-2 text-primary"
      :class="highlightIndex === visibleSuggestions.length ? ['bg-primary/10', 'cat-option--active'] : 'hover:bg-base-200'"
      @mousemove="highlightIndex = visibleSuggestions.length"
      @mousedown.prevent
      @click="addDraft"
    )
      span.font-bold +
      span.truncate {{ $t('admin.categoryPicker.addNew', { name: draftTrimmed }) }}
</template>

<script setup>
// ============================================
// Компонент: AdminCategoryPicker
// Мультвыбор категорий для модалок добавления/редактирования товара
// и массового редактирования (AdminBulkEditModal).
// Подсказки — собственная выпадающая панель вместо нативного datalist:
// datalist на телефонах внутри модалок не раскрывался (iOS Safari не
// показывает его при программном фокусе через клик по обёртке, часть
// Android-браузеров даёт пустой список) — см. баг «на телефоне не
// выпадает список с категориями». Панель — обычный DOM-элемент внутри
// модалки: не зависит от нативных попапов, z-index и клавиатуры.
// Формат значения — string[]; дедупликация точная, как на сервере
// (normalizeCategories в productHelpers).
// ============================================

const props = defineProps({
  /** Справочник известных категорий для подсказок (уже выбранные скрываются) */
  allCategories: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  /** Подсветка ошибки валидации (пустое обязательное поле) */
  error: { type: Boolean, default: false },
})

const model = defineModel({ type: Array, required: true })

const MAX_SUGGESTIONS = 50 // показываем не больше, остальное — поиском
const FLIP_MARGIN = 260 // ниже этой высоты список раскрывается вверх

const draft = ref('')
const inputEl = ref(null)
const pickerEl = ref(null)
const isOpen = ref(false)
const dropUp = ref(false)
const highlightIndex = ref(-1)
let blurTimer = null

const draftTrimmed = computed(() => draft.value.trim())

/** Подсказки: известные категории минус выбранные, отфильтрованные по вводу */
const visibleSuggestions = computed(() => {
  const q = draftTrimmed.value.toLowerCase()
  const pool = props.allCategories.filter((c) => !model.value.includes(c))
  const filtered = q ? pool.filter((c) => c.toLowerCase().includes(q)) : pool
  return filtered.slice(0, MAX_SUGGESTIONS)
})

/** Драфт разбивается на части: «A, B; C» → [A, B, C] */
const draftParts = computed(() =>
  draft.value.split(/[,;]/).map((s) => s.trim()).filter(Boolean),
)

/** Есть ли в драфте новое значение (не выбрано и не из справочника) */
const canAddDraft = computed(() =>
  draftParts.value.some(
    (p) => !model.value.includes(p) && !props.allCategories.includes(p),
  ),
)

/** Панель видима, когда открыта и есть что показать */
const panelVisible = computed(
  () => isOpen.value && (visibleSuggestions.value.length > 0 || canAddDraft.value),
)

const openList = () => {
  if (props.disabled) return
  clearTimeout(blurTimer)
  isOpen.value = true
  updateDirection()
}

const closeList = () => {
  isOpen.value = false
  highlightIndex.value = -1
}

/** Если снизу мало места — панель раскрывается вверх (поле у края экрана) */
const updateDirection = () => {
  const el = pickerEl.value
  if (!el || typeof window === 'undefined') return
  const rect = el.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  dropUp.value = spaceBelow < FLIP_MARGIN && rect.top > spaceBelow
}

const focusInput = () => {
  // openList() вызываем ДО focus(): на iOS программный фокус может не
  // сработать (клавиатура не откроется), но панель — обычный DOM и
  // откроется в любом случае, тап по строке добавит категорию.
  openList()
  inputEl.value?.focus()
}

/** Драфт → массив: «A, B; C» → добавить все три, дубликаты молча игнорируются */
const commitDraft = () => {
  if (draftParts.value.length === 0) return
  const next = [...model.value]
  for (const part of draftParts.value) {
    if (!next.includes(part)) next.push(part)
  }
  model.value = next
  draft.value = ''
}

/** Добавить выбранную подсказку; список остаётся открытым для добора */
const pick = (cat) => {
  clearTimeout(blurTimer)
  if (!model.value.includes(cat)) model.value = [...model.value, cat]
  draft.value = ''
  highlightIndex.value = -1
  isOpen.value = true
  inputEl.value?.focus()
}

/** Строка «＋ Добавить …» — зафиксировать драфт как новое значение */
const addDraft = () => {
  clearTimeout(blurTimer)
  commitDraft()
  highlightIndex.value = -1
  inputEl.value?.focus()
}

const remove = (cat) => {
  model.value = model.value.filter((c) => c !== cat)
}

const onKeydown = (e) => {
  if (e.key === 'Enter') {
    // Enter не должен засабмитить форму модалки
    e.preventDefault()
    if (panelVisible.value && highlightIndex.value >= 0) {
      if (highlightIndex.value < visibleSuggestions.value.length) {
        pick(visibleSuggestions.value[highlightIndex.value])
      } else {
        addDraft()
      }
    } else {
      commitDraft()
    }
  } else if (e.key === ',' || e.key === ';') {
    e.preventDefault()
    commitDraft()
  } else if (e.key === 'Tab') {
    if (draft.value.trim()) {
      // Tab с непустым вводом — зафиксировать и остаться в поле
      e.preventDefault()
      commitDraft()
    }
    closeList()
  } else if (e.key === 'Escape') {
    if (panelVisible.value) {
      e.preventDefault()
      closeList()
    }
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!panelVisible.value) return
    e.preventDefault()
    const max = visibleSuggestions.value.length - 1 + (canAddDraft.value ? 1 : 0)
    const step = e.key === 'ArrowDown' ? 1 : -1
    highlightIndex.value = Math.min(max, Math.max(-1, highlightIndex.value + step))
    nextTick(() => {
      pickerEl.value
        ?.querySelector('.cat-option--active')
        ?.scrollIntoView({ block: 'nearest' })
    })
  } else if (e.key === 'Backspace' && !draft.value) {
    const last = model.value.at(-1)
    if (last !== undefined) remove(last)
  }
}

/**
 * Фокус ушёл из пикера: закрыть список и зафиксировать недобитый драфт.
 * Таймер 140 мс — на iOS тап по строке не всегда успевает до blur
 * (кнопки на iOS не получают фокус, relatedTarget = null).
 */
const onFocusout = (e) => {
  const next = e.relatedTarget
  if (next && pickerEl.value?.contains(next)) return
  clearTimeout(blurTimer)
  blurTimer = setTimeout(() => {
    commitDraft()
    closeList()
  }, 140)
}

watch(draft, () => {
  highlightIndex.value = -1
})

onBeforeUnmount(() => {
  clearTimeout(blurTimer)
})
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

/* Панель подсказок: компактная на десктопе, высокая на телефоне */
.cat-list {
  max-height: 15rem; /* 240px */
}

@media (max-width: 640px) {
  .cat-list {
    max-height: 16rem; /* 256px */
  }
}
</style>
