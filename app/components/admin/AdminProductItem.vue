<!-- app/components/admin/AdminProductItem.vue -->
<template lang="pug">
.card.bg-base-200.shadow-md
  //- Заголовок с ID и статусом
  .card-body.p-4
    .flex.justify-between.items-center.mb-4
      .flex.items-center.gap-2
        span.badge.badge-ghost ID: {{ localProduct.id }}
        span.badge(
          :class="localProduct.inStock ? 'badge-success' : 'badge-error'"
        ) {{ localProduct.inStock ? 'В наличии' : 'Нет в наличии' }}
      
      //- Быстрые действия
      .flex.gap-1
        button.btn.btn-ghost.btn-xs(
          @click="toggleStock"
          :class="localProduct.inStock ? 'text-success' : 'text-error'"
          :title="localProduct.inStock ? 'Скрыть из каталога' : 'Показать в каталоге'"
        )
          icon(:name="localProduct.inStock ? 'heroicons:eye' : 'heroicons:eye-slash'" class="w-4 h-4")
        
        button.btn.btn-ghost.btn-xs.text-error(
          @click="confirmDelete"
          title="Удалить товар"
        )
          icon(name="heroicons:trash" class="w-4 h-4")

    //- Основная информация
    .grid.grid-cols-1.md-grid-cols-2.gap-4
      //- Левая колонка
      .space-y-3
        //- Название
        .form-control
          label.label
            span.label-text.font-medium Название
          input.input.input-bordered.input-sm.w-full(
            v-model="localProduct.name"
            placeholder="Название товара"
            :class="{ 'input-error': errors.name }"
            @blur="validateField('name')"
          )
          label.label(v-if="errors.name")
            span.label-text-alt.text-error {{ errors.name }}

        //- Slug
        .form-control
          label.label
            span.label-text.font-medium Slug (URL)
            button.btn.btn-ghost.btn-xs(
              @click="regenerateSlug"
              title="Перегенерировать из названия"
            )
              icon(name="heroicons:arrow-path" class="w-3 h-3")
          input.input.input-bordered.input-sm.w-full(
            v-model="localProduct.slug"
            placeholder="url-tovara"
          )

        //- Цена
        .form-control
          label.label
            span.label-text.font-medium Цена (₽)
          input.input.input-bordered.input-sm.w-full(
            v-model.number="localProduct.price"
            type="number"
            min="0"
            step="0.01"
            :class="{ 'input-error': errors.price }"
            @blur="validateField('price')"
          )

        //- Количество на складе
        .form-control
          label.label
            span.label-text.font-medium Количество
          .join.w-full
            input.input.input-bordered.input-sm.join-item.flex-1(
              v-model.number="localProduct.stockQuantity"
              type="number"
              min="0"
            )
            button.btn.btn-sm.join-item(
              @click="localProduct.stockQuantity = Math.max(0, (localProduct.stockQuantity || 0) - 1)"
            ) -
            button.btn.btn-sm.join-item(
              @click="localProduct.stockQuantity = (localProduct.stockQuantity || 0) + 1"
            ) +

      //- Правая колонка
      .space-y-3
        //- Описание
        .form-control
          label.label
            span.label-text.font-medium Описание
          textarea.textarea.textarea-bordered.textarea-sm.w-full(
            v-model="localProduct.description"
            rows="3"
            placeholder="Описание товара"
          )

        //- Категории
        .form-control
          label.label
            span.label-text.font-medium Категории
          input.input.input-bordered.input-sm.w-full(
            v-model="categoryInput"
            placeholder="Категория 1, Категория 2"
            @blur="updateCategories"
          )
          .flex.flex-wrap.gap-1.mt-2
            span.badge.badge-primary.badge-sm(
              v-for="cat in localProduct.categories"
              :key="cat"
            ) {{ cat }}

        //- Изображение
        .form-control
          label.label
            span.label-text.font-medium Изображение
          .flex.gap-2
            input.input.input-bordered.input-sm.flex-1(
              v-model="localProduct.image"
              placeholder="URL изображения"
            )
            .w-12.h-12.border.rounded.overflow-hidden.bg-base-300(
              v-if="localProduct.image"
            )
              img.w-full.h-full.object-cover(
                :src="localProduct.image"
                @error="onImageError"
              )

    //- Кнопки действий
    .card-actions.justify-end.mt-4.pt-4.border-t.border-base-300
      button.btn.btn-ghost.btn-sm(
        @click="cancelChanges"
        :disabled="!hasChanges"
      )
        icon(name="heroicons:x-mark" class="w-4 h-4 mr-1")
        | Отменить
      
      button.btn.btn-primary.btn-sm(
        @click="saveChanges"
        :disabled="!hasChanges || !isValid || isSaving"
      )
        span.loading.loading-spinner.loading-xs.mr-1(v-if="isSaving")
        icon(v-else name="heroicons:check" class="w-4 h-4 mr-1")
        | Сохранить

    //- Индикатор изменений
    .text-xs.text-warning.mt-2(v-if="hasChanges")
      | ⚠️ Есть несохранённые изменения
</template>

<script setup>
const props = defineProps({
  product: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update', 'delete', 'toggle-stock'])

// Composables
const { updateProduct } = useProducts()
const notify = useNotifyQueue()

// State
const isSaving = ref(false)
const isDeleting = ref(false)
const originalProduct = ref(JSON.parse(JSON.stringify(props.product)))
const localProduct = ref(JSON.parse(JSON.stringify(props.product)))
const categoryInput = ref(props.product.categories?.join(', ') || '')

const errors = ref({
  name: '',
  price: ''
})

// Computed
const hasChanges = computed(() => {
  return JSON.stringify(localProduct.value) !== JSON.stringify(originalProduct.value)
})

const isValid = computed(() => {
  return localProduct.value.name?.trim() && 
         localProduct.value.price >= 0 &&
         !errors.value.name &&
         !errors.value.price
})

// Валидация поля
const validateField = (field) => {
  switch (field) {
    case 'name':
      errors.value.name = !localProduct.value.name?.trim() 
        ? 'Название обязательно' 
        : ''
      break
    case 'price':
      errors.value.price = localProduct.value.price < 0 
        ? 'Цена не может быть отрицательной' 
        : ''
      break
  }
}

// Переключение наличия
const toggleStock = () => {
  localProduct.value.inStock = !localProduct.value.inStock
}

// Перегенерация slug
const regenerateSlug = () => {
  if (localProduct.value.name) {
    // Простая транслитерация
    const slug = localProduct.value.name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
    
    localProduct.value.slug = slug || `product-${Date.now()}`
  }
}

// Обновление категорий
const updateCategories = () => {
  localProduct.value.categories = categoryInput.value
    .split(',')
    .map(cat => cat.trim())
    .filter(Boolean)
}

// Ошибка загрузки изображения
const onImageError = (event) => {
  event.target.style.display = 'none'
}

// Отмена изменений
const cancelChanges = () => {
  localProduct.value = JSON.parse(JSON.stringify(originalProduct.value))
  categoryInput.value = localProduct.value.categories?.join(', ') || ''
  errors.value = { name: '', price: '' }
  notify.info('Изменения отменены')
}

// Сохранение изменений
const saveChanges = async () => {
  if (!isValid.value || isSaving.value) return
  
  isSaving.value = true
  
  try {
    // Автоматически определяем наличие на складе
    localProduct.value.inStock = (localProduct.value.stockQuantity || 0) > 0
    localProduct.value.updatedAt = new Date().toISOString()
    
    const updated = await updateProduct(localProduct.value.id, localProduct.value)
    
    // Обновляем оригинал
    originalProduct.value = JSON.parse(JSON.stringify(updated))
    localProduct.value = JSON.parse(JSON.stringify(updated))
    
    emit('update', updated)
    notify.success(`Товар "${updated.name}" сохранён`)
    
  } catch (error) {
    console.error('Ошибка сохранения:', error)
    notify.error(error.message || 'Ошибка сохранения товара')
  } finally {
    isSaving.value = false
  }
}

// Подтверждение удаления
const confirmDelete = () => {
  emit('delete', props.product)
}

// Watch для синхронизации при внешних изменениях
watch(() => props.product, (newProduct) => {
  if (!hasChanges.value) {
    originalProduct.value = JSON.parse(JSON.stringify(newProduct))
    localProduct.value = JSON.parse(JSON.stringify(newProduct))
    categoryInput.value = newProduct.categories?.join(', ') || ''
  }
}, { deep: true })
</script>