<!-- app\components\products\ProductSort.vue -->
<template lang="pug">
.product-sort
  .filter-section
    h4.filter-section-title.text-sm.mb-2 Сортировка:

    .flex.items-center.flex-wrap.gap-2.rounded-sm
      .span.px-2.py-1.text-xs.cursor-pointer(
        v-for="option in displaySortFields"
        :key="option.value"
        :class="sortField === option.value ? 'bg-primary text-white rounded-md' : 'border border-base-content/50  hover:border-primary rounded-md'"
        @click="toggleSort(option.value)"
      ) {{ option.label }}
        span.ml-1(v-if="sortField === option.value")
          | {{ sortOrder === 'asc' ? '↑' : '↓' }}
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'

// Используем единый useAppState
const app = useAppState()

const props = defineProps({
  sortBy: {
    type: String,
    default: 'id'
  },
  sortOrder: {
    type: String,
    default: 'desc'
  }
})

const emit = defineEmits(['sort-change'])

const sortFields = [
  { value: 'id', label: 'по дате' },
  { value: 'name', label: 'по алфавиту' },
  { value: 'price', label: 'по цене' }
]

// локальное состояние
const sortField = ref(props.sortBy)
const sortOrder = ref(props.sortOrder)

// Динамические названия для сортировки по дате и цене
const displaySortFields = computed(() => {
  return sortFields.map(option => {
    if (option.value === 'id') {
      // Если текущая сортировка по дате, показываем направление
      if (sortField.value === 'id') {
        return {
          ...option,
          label: sortOrder.value === 'desc' ? 'новые сверху' : 'новые снизу'
        }
      }
      // Если не активна, показываем общее название
      return {
        ...option,
        label: 'по новизне'
      }
    }
    
    if (option.value === 'price') {
      // Если текущая сортировка по цене, показываем направление
      if (sortField.value === 'price') {
        return {
          ...option,
          label: sortOrder.value === 'asc' ? 'с дешёвых' : 'с дорогих'
        }
      }
      // Если не активна, показываем общее название
      return {
        ...option,
        label: 'по цене'
      }
    }
    
    return option
  })
})

// Наблюдаем за изменениями props и синхронизируем локальное состояние
watch(() => props.sortBy, (newVal) => {
  if (newVal && newVal !== sortField.value) {
    console.log('🔄 Синхронизация sortField:', newVal)
    sortField.value = newVal
  }
})

watch(() => props.sortOrder, (newVal) => {
  if (newVal && newVal !== sortOrder.value) {
    console.log('🔄 Синхронизация sortOrder:', newVal)
    sortOrder.value = newVal
  }
})

const persistSort = () => {
  localStorage.setItem('sortField', sortField.value)
  localStorage.setItem('sortOrder', sortOrder.value)
}

const loadSort = () => {
  const savedField = localStorage.getItem('sortField')
  const savedOrder = localStorage.getItem('sortOrder')
  if (savedField && savedOrder) {
    sortField.value = savedField
    sortOrder.value = savedOrder
  }
  emitSortChange()
}

const toggleSort = (field) => {
  console.log('🔄 ТoggleSort вызван для поля:', field)
  
  if (sortField.value === field) {
    // Если кликаем на то же поле - меняем порядок
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    // Если кликаем на другое поле - устанавливаем его и сбрасываем порядок на asc
    sortField.value = field
    sortOrder.value = 'asc'
  }

  console.log('📤 Новые параметры сортировки:', {
    field: sortField.value,
    order: sortOrder.value
  })
  
  persistSort()
  emitSortChange()
}

const emitSortChange = () => {
  const sortData = { 
    field: sortField.value, 
    order: sortOrder.value 
  }
  console.log('📤 Emitting sort-change:', sortData)
  emit('sort-change', sortData)
}

const resetSort = () => {
  console.log('🔄 Сброс сортировки к значениям по умолчанию')
  sortField.value = 'id'
  sortOrder.value = 'desc'
  persistSort()
  emitSortChange()
}

// Экспортируем resetSort для родительского компонента
defineExpose({ resetSort })

// Инициализация при монтировании
onMounted(() => {
  console.log('🚀 ProductSort mounted')
  console.log('📥 Initial props:', { sortBy: props.sortBy, sortOrder: props.sortOrder })
  loadSort()
})

// Логируем изменения состояния
watch([sortField, sortOrder], ([newField, newOrder]) => {
  console.log('📊 Состояние сортировки изменено:', { field: newField, order: newOrder })
})
</script>

<style scoped>
/* Улучшаем внешний вид для мобильных */
@media (max-width: 768px) {
  .sort-options {
    gap: 0.5rem;
  }
  
  .btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8rem;
  }
}
</style>