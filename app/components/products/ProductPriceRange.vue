<!-- app/components/products/ProductPriceRange.vue -->
<template lang="pug">
.product-price-range(
  :class="{ compact, 'enhanced-thumbs': enhancedThumbs }",
  class="lg:mt-3 lg:pr-2"
)
  .price-range-header.flex.items-center.justify-between.mb-0
    .flex.items-center.gap-2
      h4.section-title.text-sm.py-1.text-base-content Цена:
      
      button.reset-btn.p-1.rounded-lg.transition-colors.cursor-pointer(
        @click.stop="resetPriceRange"
        v-if="isPriceFilterActive"
        title="Сбросить фильтр"
        :disabled="isResetting"
        class="hover:bg-base-300"
      )
        svg.w-4.h-4.text-warning(
          fill="none" 
          stroke="currentColor" 
          stroke-width="2"
          viewBox="0 0 24 24"
        )
          path(stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12")
    
    .mode-switcher.flex.gap-2.mb-2(v-if="!compact || !isMobile")
      button.chip.px-2.py-1.rounded-lg.text-xs.cursor-pointer(
        @click="useSlider = true"
        :class="useSlider ? 'bg-primary border border-primary text-white' : 'border border-base-content/40'",
        class="hover:border-primary"
        title="Режим слайдера"
      ) слайдер
      button.chip.px-2.py-1.rounded-lg.text-xs.cursor-pointer(
        @click="useSlider = false"
        :class="!useSlider ? 'bg-primary border border-primary text-white' : 'border border-base-content/40'",
        class="hover:border-primary"
        title="Режим ввода"
      ) вручную

  .price-inputs(v-if="!useSlider")
    .flex.gap-2.mt-1
      .input-group.flex-1.relative
        label.absolute.left-3(class="top-1/2 -translate-y-1/2 text-xs text-base-content/70") от
        input.input.input-bordered.input-sm.w-full.pl-4.rounded-lg(
          class="border-base-content/50 focus:border-primary",
          type="number"
          :min="minPrice"
          :max="maxPrice"
          :step="100"
          :value="inputMinValue"
          @input="handleInputMin"
          @blur="applyInputs"
          @keydown.enter.prevent="applyInputs"
          placeholder="мин."
          :class="{ 'border-primary!': inputMin !== minPrice }"
        )
      .input-group.flex-1.relative
        label.absolute.left-3(class="top-1/2 -translate-y-1/2 text-xs text-base-content/70") до
        input.input.input-bordered.input-sm.w-full.pl-4.rounded-lg(
          class="border-base-content/50 focus:border-primary",
          type="number"
          :min="minPrice"
          :max="maxPrice"
          :step="100"
          :value="inputMaxValue"
          @input="handleInputMax"
          @blur="applyInputs"
          @keydown.enter.prevent="applyInputs"
          placeholder="макс."
          :class="{ 'border-primary!': inputMax !== maxPrice }"
        )
    
    .text-sm.text-center.mt-3(class="text-base-content/60")
      | Диапазон:&nbsp;&nbsp;от {{ formatPrice(minPrice) }}&nbsp;&nbsp;до&nbsp;&nbsp;{{ formatPrice(maxPrice) }} ₽

  .price-slider.px-3(v-else)
    .slider-wrapper.relative.pt-4.pb-6.px-1(
      :style="{ width: sliderWidth }"
      @click="handleSliderClick"
    )
      .slider-track.absolute.inset-x-0.h-2.bg-base-300.rounded-full.transform(class="-translate-y-1/2 top-1/2")
      
      .slider-range.absolute.h-1.bg-primary.rounded-full.transform(
        class="-translate-y-1/2 top-1/2" 
        :style="sliderRangeStyle"
      )
      
      .slider-thumb.min-thumb.absolute.cursor-grab.z-20(
        :class="[compact ? 'w-5 h-5' : 'w-4 h-4', { 'active': activeThumb === 'min' }]",
        class="active:cursor-grabbing"
        :style="{ left: thumbLeftStyle }"
        @mousedown="startDrag('min', $event)"
        @touchstart="startDrag('min', $event)"
      )
        .thumb-indicator.absolute.inset-0.bg-primary.rounded-full
      
      .slider-thumb.max-thumb.absolute.cursor-grab.z-20(
        :class="[compact ? 'w-5 h-5' : 'w-4 h-4', { 'active': activeThumb === 'max' }]",
        class="active:cursor-grabbing"
        :style="{ left: thumbRightStyle }"
        @mousedown="startDrag('max', $event)"
        @touchstart="startDrag('max', $event)"
      )
        .thumb-indicator.absolute.inset-0.bg-primary.rounded-full
    
    .slider-values.flex.justify-between.text-sm.mt-1.mb-1
      .min-value.text-base-content
        span.mr-1(class="text-base-content/70") от:
        span {{ formatPrice(roundToHundredForDisplay(sliderMin)) }} ₽
      .max-value.text-base-content
        span.mr-1(class="text-base-content/70") до:
        span {{ formatPrice(roundToHundredForDisplay(sliderMax)) }} ₽
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  minPrice: { 
    type: Number,
    default: 0
  },
  maxPrice: { 
    type: Number,
    default: 100000
  },
  currentMin: { 
    type: Number,
    default: null
  },
  currentMax: { 
    type: Number,
    default: null
  },
  compact: { 
    type: Boolean,
    default: false
  },
  enhancedThumbs: {
    type: Boolean,
    default: false
  },
  sliderWidth: { 
    type: String,
    default: '100%'
  }
})

const emit = defineEmits(['update:priceRange'])

// Режим отображения
const useSlider = ref(true)

// Основные значения
const inputMin = ref(props.minPrice)
const inputMax = ref(props.maxPrice)

// Значения для отображения в инпутах (без авто-округляния)
const inputMinValue = ref('')
const inputMaxValue = ref('')

// Значения для слайдера
const sliderMin = ref(props.minPrice)
const sliderMax = ref(props.maxPrice)

// Состояние
const isDragging = ref(false)
const activeThumb = ref(null)
const sliderRect = ref(null)
const isResetting = ref(false)
const isMobile = ref(false)

// Проверка активности фильтра
const isPriceFilterActive = computed(() => {
  const currentMin = sliderMin.value
  const currentMax = sliderMax.value
  return currentMin > props.minPrice || currentMax < props.maxPrice
})

// Вычисляемые стили для слайдера
const sliderRangeStyle = computed(() => {
  const minVal = sliderMin.value
  const maxVal = sliderMax.value
  const left = ((minVal - props.minPrice) / (props.maxPrice - props.minPrice)) * 100
  const width = ((maxVal - minVal) / (props.maxPrice - props.minPrice)) * 100
  return {
    left: `${left}%`,
    width: `${width}%`
  }
})

const thumbLeftStyle = computed(() => {
  return `${((sliderMin.value - props.minPrice) / (props.maxPrice - props.minPrice)) * 100}%`
})

const thumbRightStyle = computed(() => {
  return `${((sliderMax.value - props.minPrice) / (props.maxPrice - props.minPrice)) * 100}%`
})

// Определение мобильного устройства
const detectMobile = () => {
  if (typeof window !== 'undefined') {
    isMobile.value = window.innerWidth < 768
  }
}

// Округление до 100 только для отображения
const roundToHundredForDisplay = (value) => {
  // Если значение равно minPrice или maxPrice, показываем как есть
  if (value === props.minPrice || value === props.maxPrice) {
    return value
  }
  return Math.round(value / 100) * 100
}

// Проверка близости к минимальному значению
const isNearMin = (value) => {
  const range = props.maxPrice - props.minPrice
  const threshold = range * 0.02 // 2% от диапазона
  return Math.abs(value - props.minPrice) <= threshold
}

// Проверка близости к максимальному значению
const isNearMax = (value) => {
  const range = props.maxPrice - props.minPrice
  const threshold = range * 0.02 // 2% от диапазона
  return Math.abs(value - props.maxPrice) <= threshold
}

// Начало перетаскивания с улучшенным UX
const startDrag = (thumb, event) => {
  event.preventDefault()
  event.stopPropagation()
  
  isDragging.value = true
  activeThumb.value = thumb
  
  const sliderWrapper = event.currentTarget.closest('.slider-wrapper')
  sliderRect.value = sliderWrapper.getBoundingClientRect()
  
  // Для сенсорных устройств
  if (event.type.includes('touch')) {
    document.addEventListener('touchmove', handleDrag, { passive: false })
    document.addEventListener('touchend', stopDrag, { passive: false })
  } else {
    document.addEventListener('mousemove', handleDrag)
    document.addEventListener('mouseup', stopDrag)
  }
}

// Обработка перетаскивания с защитой от ошибок
const handleDrag = (event) => {
  if (!isDragging.value || !sliderRect.value) return
  
  event.preventDefault()
  
  const clientX = event.type.includes('touch') 
    ? event.touches[0].clientX 
    : event.clientX
  
  const relativeX = Math.max(0, Math.min(sliderRect.value.width, clientX - sliderRect.value.left))
  const percentage = relativeX / sliderRect.value.width
  
  let newValue = props.minPrice + percentage * (props.maxPrice - props.minPrice)
  
  // Если близко к минимуму - устанавливаем точное минимальное значение
  if (isNearMin(newValue)) {
    newValue = props.minPrice
  }
  // Если близко к максимуму - устанавливаем точное максимальное значение
  else if (isNearMax(newValue)) {
    newValue = props.maxPrice
  }
  // Иначе используем точное значение (без округления)
  
  // Ограничиваем значения
  if (activeThumb.value === 'min') {
    // Минимальный ползунок не может превышать максимальный минус минимальный шаг
    sliderMin.value = Math.max(props.minPrice, Math.min(newValue, sliderMax.value - 100))
  } else {
    // Максимальный ползунок не может быть меньше минимального плюс минимальный шаг
    sliderMax.value = Math.min(props.maxPrice, Math.max(newValue, sliderMin.value + 100))
  }
  
  // Обновляем основные значения (для слайдера)
  inputMin.value = sliderMin.value
  inputMax.value = sliderMax.value
  
  // Обновляем значения в инпутах
  inputMinValue.value = inputMin.value === props.minPrice ? '' : inputMin.value.toString()
  inputMaxValue.value = inputMax.value === props.maxPrice ? '' : inputMax.value.toString()
  
  // Дебаунс для избежания частых обновлений
  clearTimeout(updateTimeout)
  updateTimeout = setTimeout(applyInputs, 50)
}

let updateTimeout = null

// Остановка перетаскивания
const stopDrag = () => {
  if (!isDragging.value) return
  
  isDragging.value = false
  activeThumb.value = null
  
  // Применяем изменения
  applyInputs()
  
  // Очищаем слушатели
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', handleDrag)
  document.removeEventListener('touchend', stopDrag)
}

// Клик по слайдеру для быстрой установки
const handleSliderClick = (event) => {
  if (isDragging.value || event.target.closest('.slider-thumb')) return
  
  const sliderWrapper = event.currentTarget
  const rect = sliderWrapper.getBoundingClientRect()
  const clientX = event.type.includes('touch') 
    ? event.touches[0].clientX 
    : event.clientX
  
  const relativeX = Math.max(0, Math.min(rect.width, clientX - rect.left))
  const percentage = relativeX / rect.width
  let newValue = props.minPrice + percentage * (props.maxPrice - props.minPrice)
  
  // Если близко к минимуму - устанавливаем точное минимальное значение
  if (isNearMin(newValue)) {
    newValue = props.minPrice
  }
  // Если близко к максимуму - устанавливаем точное максимальное значение
  else if (isNearMax(newValue)) {
    newValue = props.maxPrice
  }
  // Иначе используем точное значение (без округления)
  
  // Определяем ближайший ползунок
  const distanceToMin = Math.abs(newValue - sliderMin.value)
  const distanceToMax = Math.abs(newValue - sliderMax.value)
  
  if (distanceToMin < distanceToMax) {
    sliderMin.value = Math.max(props.minPrice, Math.min(newValue, sliderMax.value - 100))
  } else {
    sliderMax.value = Math.min(props.maxPrice, Math.max(newValue, sliderMin.value + 100))
  }
  
  applyInputs()
}

// Обработчики для инпутов
const handleInputMin = (e) => {
  // Сохраняем введенное значение без авто-округляния
  inputMinValue.value = e.target.value
}

const handleInputMax = (e) => {
  // Сохраняем введенное значение без авто-округляния
  inputMaxValue.value = e.target.value
}

// Форматирование цены
const formatPrice = (val) => {
  if (!Number.isFinite(val)) return '—'
  return new Intl.NumberFormat('ru-RU').format(val)
}

// Применение изменений из инпутов
const applyInputs = () => {
  // Получаем значения из инпутов
  let rawMin = inputMinValue.value === '' ? props.minPrice : Number(inputMinValue.value)
  let rawMax = inputMaxValue.value === '' ? props.maxPrice : Number(inputMaxValue.value)
  
  // Проверяем корректность значений
  if (isNaN(rawMin)) rawMin = props.minPrice
  if (isNaN(rawMax)) rawMax = props.maxPrice
  
  // Ограничиваем диапазон (без округления!)
  const finalMin = Math.max(props.minPrice, Math.min(rawMin, props.maxPrice))
  const finalMax = Math.max(props.minPrice, Math.min(rawMax, props.maxPrice))
  
  // Обновляем основные значения (без округления)
  inputMin.value = finalMin
  inputMax.value = finalMax
  
  // Для слайдера используем точные значения (без округления)
  sliderMin.value = finalMin
  sliderMax.value = finalMax
  
  // Обновляем отображаемые значения в инпутах (без округления)
  inputMinValue.value = finalMin === props.minPrice ? '' : finalMin.toString()
  inputMaxValue.value = finalMax === props.maxPrice ? '' : finalMax.toString()
  
  console.log('💰 Применяем диапазон цен:', { 
    min: finalMin, 
    max: finalMax,
    sliderMin: sliderMin.value,
    sliderMax: sliderMax.value
  })
  
  // Отправляем точные значения (без округления)
  emit('update:priceRange', {
    min: finalMin === props.minPrice ? null : finalMin,
    max: finalMax === props.maxPrice ? null : finalMax
  })
}

// Сброс диапазона
const resetPriceRange = async () => {
  if (isResetting.value) return
  
  isResetting.value = true
  console.log('💰 Сброс диапазона цен')
  
  // Сбрасываем значения
  inputMin.value = props.minPrice
  inputMax.value = props.maxPrice
  sliderMin.value = props.minPrice
  sliderMax.value = props.maxPrice
  inputMinValue.value = ''
  inputMaxValue.value = ''
  
  emit('update:priceRange', { min: null, max: null })
  
  // Задержка для предотвращения двойного клика
  await new Promise(resolve => setTimeout(resolve, 300))
  isResetting.value = false
}

// Инициализация
onMounted(() => {
  detectMobile()
  
  // Инициализируем значения
  if (props.currentMin !== null) {
    inputMin.value = props.currentMin
    sliderMin.value = props.currentMin
    inputMinValue.value = props.currentMin === props.minPrice ? '' : props.currentMin.toString()
  } else {
    inputMinValue.value = ''
  }
  
  if (props.currentMax !== null) {
    inputMax.value = props.currentMax
    sliderMax.value = props.currentMax
    inputMaxValue.value = props.currentMax === props.maxPrice ? '' : props.currentMax.toString()
  } else {
    inputMaxValue.value = ''
  }
  
  // Слушатель для ресайза
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', detectMobile)
  }
})

// Очистка
onUnmounted(() => {
  stopDrag()
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', detectMobile)
  }
  clearTimeout(updateTimeout)
})

// Следим за изменениями извне
watch(() => props.currentMin, (newVal) => {
  if (newVal !== null && newVal !== undefined) {
    inputMin.value = newVal
    sliderMin.value = newVal
    inputMinValue.value = newVal === props.minPrice ? '' : newVal.toString()
  }
}, { immediate: true })

watch(() => props.currentMax, (newVal) => {
  if (newVal !== null && newVal !== undefined) {
    inputMax.value = newVal
    sliderMax.value = newVal
    inputMaxValue.value = newVal === props.maxPrice ? '' : newVal.toString()
  }
}, { immediate: true })

// Экспорт методов
defineExpose({ resetPriceRange })
</script>

<style scoped>
.product-price-range {
  --thumb-size: 20px;
  --thumb-size-compact: 16px;
  --thumb-hover-size: 28px;
  --thumb-hover-size-compact: 24px;
}

.price-inputs input {
  text-align: center;
}

.price-inputs input:focus {
  outline: none;
  box-shadow: 0 0 0 2px hsl(var(--p) / 0.2);
}

/* Стили для слайдера */
.slider-thumb {
  touch-action: none;
  transform: translate(-50%, -50%);
  top: 50%;
}

.slider-thumb:hover,
.slider-thumb.active {
  transform: translate(-50%, -50%) scale(1.2);
}

.thumb-tooltip {
  pointer-events: none;
}

/* Улучшенные ползунки */
.product-price-range.enhanced-thumbs .slider-thumb {
  width: var(--thumb-size);
  height: var(--thumb-size);
}

.product-price-range.enhanced-thumbs.compact .slider-thumb {
  width: var(--thumb-size-compact);
  height: var(--thumb-size-compact);
}

.product-price-range.enhanced-thumbs .slider-thumb:hover,
.product-price-range.enhanced-thumbs .slider-thumb.active {
  width: var(--thumb-hover-size);
  height: var(--thumb-hover-size);
}

.product-price-range.enhanced-thumbs.compact .slider-thumb:hover,
.product-price-range.enhanced-thumbs.compact .slider-thumb.active {
  width: var(--thumb-hover-size-compact);
  height: var(--thumb-hover-size-compact);
}

/* Увеличиваем область клика */
.slider-thumb::after {
  content: '';
  position: absolute;
  top: -10px;
  left: -10px;
  right: -10px;
  bottom: -10px;
  z-index: 5;
  cursor: pointer;
}

/* Адаптивность */
@media (max-width: 768px) {
  .mode-switcher {
    display: none;
  }
}

@media (hover: none) and (pointer: coarse) {
  .slider-thumb {
    width: 24px !important;
    height: 24px !important;
  }
  
  .slider-thumb::after {
    top: -12px;
    left: -12px;
    right: -12px;
    bottom: -12px;
  }
}

/* Темная тема */
@media (prefers-color-scheme: dark) {
  .slider-track {
    background: var(--color-base-300);
  }
  
  .thumb-indicator {
    border-color: var(--color-base-100);
  }
}
</style>