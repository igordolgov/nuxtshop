<!-- app\components\products\ProductSearch.vue -->
<template lang="pug">
.product-search
  .form-control.relative
    .input-group
      input.input.input-bordered.input-sm(
        type="text", 
        :placeholder="placeholder", 
        :value="modelValue"
        @input="handleInput"
        :class="inputClass"
        :disabled="disabled"
      )
      button.btn.btn-ghost.btn-sm.absolute.right-0.top-0.h-full(
        @click="clearSearch"
        v-if="modelValue && showClearButton"
        style="border: none;"
        :disabled="disabled"
      )
        svg.w-4.h-4.text-gray-500(
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        )
          path(
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M6 18L18 6M6 6l12 12"
          )

  //- Отладочная информация (можно убрать в продакшене)
  .debug-info.text-xs.text-gray-500.mt-1(v-if="debug")
    | Поиск: "{{ modelValue }}" | Задержка: {{ delay }}ms
</template>

<script setup lang="ts">
// Пропсы
interface Props {
  modelValue: string
  placeholder?: string
  delay?: number
  disabled?: boolean
  showClearButton?: boolean
  debug?: boolean
  inputClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Поиск товаров...',
  delay: 300,
  disabled: false,
  showClearButton: true,
  debug: false,
  inputClass: 'w-64 pr-8'
})

// Эмиты
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'search': [value: string]
  'clear': []
}>()

// Локальные переменные
const searchTimeout = ref<NodeJS.Timeout | null>(null)

// Функция debounce
const debounce = (fn: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout
  return (...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

// Обработчик ввода
const handleInput = debounce((event: Event) => {
  const target = event.target as HTMLInputElement
  const value = target.value
  emit('update:modelValue', value)
  emit('search', value)
}, props.delay)

// Очистка поиска
const clearSearch = () => {
  emit('update:modelValue', '')
  emit('clear')
  emit('search', '')
  
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value)
    searchTimeout.value = null
  }
}

// Автофокус при монтировании (опционально)
const inputRef = ref<HTMLInputElement>()

defineExpose({
  focus: () => inputRef.value?.focus(),
  clear: clearSearch
})
</script>

<style scoped>
.product-search {
  min-width: 200px;
}

/* Анимация при фокусе */
.input:focus {
  border-color: hsl(var(--p));
  box-shadow: 0 0 0 2px hsl(var(--p) / 0.2);
}

/* Состояние disabled */
.input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>