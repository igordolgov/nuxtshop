<!-- app\components\admin\ProductForm.vue -->
<template lang="pug">
.modal.modal-open
  .modal-box.max-w-2xl
    h3.font-bold.text-lg.mb-4 {{ editingProduct ? 'Редактировать товар' : 'Добавить новый товар' }}
    form(@submit.prevent="handleSubmit")
      .grid.grid-cols-1.gap-4(class="md:grid-cols-2")
        //-  Название 
        .form-control.col-span-2
          label.label
            span.label-text Название товара
          input.input.input-bordered(v-model="form.name", type="text", required, placeholder="Введите название товара")
        //-  Описание 
        .form-control.col-span-2
          label.label
            span.label-text Описание
          textarea.textarea.textarea-bordered.h-24(v-model="form.description", placeholder="Введите описание товара", required)
        //-  Цена 
        .form-control
          label.label
            span.label-text Цена (₽)
          input.input.input-bordered(v-model="form.price", type="number", required, min="0", placeholder="0")
        //-  Количество на складе 
        .form-control
          label.label
            span.label-text Количество на складе
          input.input.input-bordered(v-model="form.stockQuantity", type="number", required, min="0", placeholder="0")
        //-  Категории 
        .form-control.col-span-2
          label.label
            span.label-text Категории (через запятую)
          input.input.input-bordered(v-model="form.categoriesString", type="text", placeholder="Электроника, Смартфоны, Техника")
        //-  URL изображения 
        .form-control.col-span-2
          label.label
            span.label-text URL изображения
          input.input.input-bordered(v-model="form.image", type="url", placeholder="https://example.com/image.jpg")
        //-  В наличии 
        .form-control
          label.label.cursor-pointer
            span.label-text В наличии
            input.checkbox(v-model="form.inStock", type="checkbox")
      //-  Предпросмотр изображения 
      .mt-4(v-if="form.image")
        label.label
          span.label-text Предпросмотр изображения
        .w-32.h-32.border.rounded-lg.overflow-hidden
          NuxtImg.w-full.h-full.object-cover(:src="form.image", alt="Preview", @error="handleImageError").
      //-  Сообщения об ошибках 
      .alert.alert-error.mt-4(v-if="error")
        span {{ error }}
      //-  Кнопки 
      .modal-action
        button.btn.btn-ghost(type="button", @click="$emit(\'close\')") Отмена
        button.btn.btn-primary(type="submit", :disabled="loading")
          span.loading.loading-spinner(v-if="loading") {{ editingProduct ? 'Обновить' : 'Добавить' }}
</template>

<script setup>
const props = defineProps({
  product: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['save', 'close'])

const { addProduct, updateProduct } = useAppState()

const form = ref({
  name: '',
  description: '',
  price: 0,
  stockQuantity: 0,
  categoriesString: '',
  image: '',
  inStock: true
})

const loading = ref(false)
const error = ref('')

const editingProduct = computed(() => props.product)

// Заполняем форму при редактировании
watch(editingProduct, (newProduct) => {
  if (newProduct) {
    form.value = {
      name: newProduct.name || '',
      description: newProduct.description || '',
      price: newProduct.price || 0,
      stockQuantity: newProduct.stockQuantity || 0,
      categoriesString: Array.isArray(newProduct.categories) ? newProduct.categories.join(', ') : '',
      image: newProduct.image || '',
      inStock: newProduct.inStock !== undefined ? newProduct.inStock : true
    }
  }
}, { immediate: true })

const handleImageError = (event) => {
  event.target.src = 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=500&h=400&fit=crop'
}

const handleSubmit = async () => {
  if (!form.value.name || !form.value.description) {
    error.value = 'Заполните обязательные поля'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const productData = {
      ...form.value,
      categories: form.value.categoriesString
        .split(',')
        .map(cat => cat.trim())
        .filter(cat => cat.length > 0)
    }

    let result
    if (editingProduct.value) {
      result = updateProduct(editingProduct.value.id, productData)
    } else {
      result = addProduct(productData)
    }

    if (result) {
      emit('save', result)
      emit('close')
    }
  } catch (err) {
    error.value = 'Произошла ошибка при сохранении товара'
    console.error('Ошибка сохранения товара:', err)
  } finally {
    loading.value = false
  }
}
</script>