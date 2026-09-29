<!-- app/components/admin/AdminAddProductModal.vue -->
<template lang="pug">
.modal(v-if="isOpen" class="modal-open")
  .modal-box.max-w-2xl.relative.w-full.max-h-screen.p-3(class="sm:p-6 sm:w-auto")
    //- Кнопка закрытия
    button.btn.btn-xs.btn-circle.btn-error.absolute.right-2.top-2(
      @click="handleCancel"
      :disabled="isSubmitting"
      aria-label="Закрыть"
    ) ✕

    h3.text-base.font-bold.mb-2(class="sm:text-xl") Добавить товар

    form(@submit.prevent="handleSubmit")
      //- Основная информация - 2 колонки на мобильных
      .grid.gap-2.mb-2(class="grid-cols-2 sm:grid-cols-6")
        //- Название товара
        .form-control(class="sm:col-span-2")
          label.label.py-1
            span.label-text.text-xs Название *
          input.input.input-bordered.input-sm.w-full(
            type="text"
            v-model="form.name"
            required
            placeholder="Название"
            :disabled="isSubmitting"
            :class="{ 'input-error': errors.name }"
            @blur="validateField('name')"
          )

        //- Категории
        .form-control(class="sm:col-span-2")
          label.label.py-1
            span.label-text.text-xs Категории
          select.select.select-bordered.select-sm.w-full(
            v-model="form.categorySelect"
            :disabled="isSubmitting"
            @change="onCategorySelect"
          )
            option(value="") -- Выбрать --
            option(v-for="cat in props.allCategories" :key="cat" :value="cat") {{ cat }}
          input.input.input-bordered.input-sm.w-full.mt-1(
            type="text"
            v-model="form.categoriesInput"
            placeholder="или ввести"
            :disabled="isSubmitting"
          )

        //- Цена
        .form-control(class="sm:col-span-1")
          label.label.py-1
            span.label-text.text-xs Цена *
          input.input.input-bordered.input-sm.w-full(
            type="number"
            v-model.number="form.price"
            required
            placeholder="0"
            min="0"
            step="0.01"
            :disabled="isSubmitting"
            :class="{ 'input-error': errors.price }"
          )

        //- Количество
        .form-control(class="sm:col-span-1")
          label.label.py-1
            span.label-text.text-xs Кол-во
          input.input.input-bordered.input-sm.w-full(
            type="number"
            v-model.number="form.stockQuantity"
            min="0"
            placeholder="0"
            :disabled="isSubmitting"
          )

      //- Описание
      .form-control.mb-2
        label.label.py-1
          span.label-text.text-xs Описание
        textarea.textarea.textarea-bordered.textarea-sm.w-full(
          v-model="form.description"
          placeholder="Описание товара"
          rows="2"
          :disabled="isSubmitting"
        )

      //- Изображения
      .grid.gap-2.mb-2(class="grid-cols-2 sm:grid-cols-4")
        //- Основное изображение
        .form-control(class="sm:col-span-3")
          label.label.py-1
            span.label-text.text-xs Изображение
          .flex.flex-col.gap-1
            input.input.input-bordered.input-sm.w-full(
              type="text"
              v-model="form.image"
              placeholder="URL изображения"
              :disabled="isSubmitting"
            )
            .flex.gap-1.items-center
              input.file-input.file-input-bordered.flex-1.file-input-xs(
                type="file"
                ref="mainImageInput"
                accept="image/jpeg,image/png,image/webp"
                @change="handleMainImageUpload"
                :disabled="isSubmitting"
              )
              button.btn.btn-ghost.btn-xs.btn-square(
                type="button"
                @click="clearMainImage"
                v-if="form.image"
                :disabled="isSubmitting"
              ) ✕

        //- Превью
        .form-control.flex.items-end
          .w-full
            .text-xs.text-gray-500.mb-1 Превью
            .w-full.h-16.border.rounded.overflow-hidden.flex.items-center.justify-center.bg-base-200(
              class="sm:h-20"
            )
              template(v-if="form.image && isValidImage(form.image)")
                img(
                  :src="form.image"
                  alt="Preview"
                  class="w-full h-full object-cover"
                  @error="handleImageError"
                )
              template(v-else)
                .text-xs.text-gray-400 Нет

      //- Галерея
      .form-control.mb-1
        label.label.py-1
          span.label-text.text-xs Галерея ({{ form.gallery.length }}/{{ MAX_GALLERY_IMAGES }})
        .flex.gap-1.items-center
          input.file-input.file-input-bordered.flex-1.file-input-xs(
            type="file"
            ref="galleryInput"
            accept="image/jpeg,image/png,image/webp"
            multiple
            @change="handleGalleryUpload"
            :disabled="isSubmitting || form.gallery.length >= MAX_GALLERY_IMAGES"
          )
          button.btn.btn-outline.btn-xs(
            type="button"
            @click="triggerGalleryUpload"
            :disabled="isSubmitting || form.gallery.length >= MAX_GALLERY_IMAGES"
          ) +

        //- Превью галереи
        .flex.flex-wrap.gap-1.mt-1(v-if="form.gallery.length > 0")
          .relative(
            v-for="(image, index) in form.gallery"
            :key="index"
          )
            .w-12.h-12.border.rounded.overflow-hidden(class="sm:w-14 sm:h-14")
              img(
                :src="image"
                :alt="`Изображение ${index + 1}`"
                class="w-full h-full object-cover"
                @error="handleGalleryImageError(index)"
              )
            button.btn.btn-xs.btn-circle.btn-error.absolute.-top-1.-right-1.p-0(
              @click="removeGalleryImage(index)"
              :disabled="isSubmitting"
              type="button"
            ) ✕

      //- Прогресс-бар
      .mt-2(v-if="uploadProgress > 0 && uploadProgress < 100")
        .w-full.bg-gray-200.rounded-full.h-1
          .bg-primary.h-1.rounded-full.transition-all(:style="{ width: uploadProgress + '%' }")

      //- Ошибка
      .alert.alert-error.mt-2.p-2.text-xs(v-if="formError")
        | {{ formError }}

      //- Кнопки
      .modal-action.mt-3
        button.btn.btn-ghost.btn-sm(
          type="button"
          @click="handleCancel"
          :disabled="isSubmitting"
        ) Отмена
        button.btn.btn-primary.btn-sm(
          type="submit"
          :disabled="isSubmitting || !isFormValid"
        )
          span.loading.loading-spinner.loading-xs.mr-1(v-if="isSubmitting")
          span(v-if="isSubmitting") Сохранение...
          span(v-else) Добавить
</template>

<script setup>
// ============================================
// Компонент: AdminAddProductModal
// Модалка добавления товара.
// Изображения ресайзятся на клиенте в WebP (useImageResize) —
// в JSON уходит ~50–150 КБ вместо мегабайт base64.
// ============================================
const { createProduct, loadProducts } = useProducts()
const { resizeToWebp } = useImageResize()
const notify = useNotifyQueue()

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  allCategories: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:isOpen', 'productAdded'])

const MAX_GALLERY_IMAGES = 5

const isSubmitting = ref(false)
const uploadProgress = ref(0)
const mainImageInput = ref(null)
const galleryInput = ref(null)
const formError = ref('')

const errors = ref({ name: '', price: '' })

const form = ref({
  name: '',
  description: '',
  price: null,
  categorySelect: '',
  categoriesInput: '',
  image: '',
  gallery: [],
  inStock: true,
  stockQuantity: 0,
})

const isFormValid = computed(() => {
  const hasName = form.value.name?.trim().length > 0
  const hasValidPrice = form.value.price !== null && form.value.price !== undefined && form.value.price >= 0
  const noErrors = !errors.value.name && !errors.value.price
  return hasName && hasValidPrice && noErrors
})

const hasTooManyGalleryImages = computed(() => {
  return form.value.gallery.length > MAX_GALLERY_IMAGES
})

const validateField = (field) => {
  switch (field) {
    case 'name':
      if (!form.value.name?.trim()) errors.value.name = 'Обязательно'
      else if (form.value.name.length < 2) errors.value.name = 'Мин. 2 символа'
      else if (form.value.name.length > 100) errors.value.name = 'Макс. 100 символов'
      else errors.value.name = ''
      break
    case 'price':
      if (form.value.price === null || form.value.price === undefined) errors.value.price = 'Обязательно'
      else if (form.value.price < 0) errors.value.price = 'Не может быть отрицательной'
      else errors.value.price = ''
      break
  }
}

const isValidImage = (imageUrl) => {
  if (!imageUrl) return false
  return imageUrl.startsWith('data:image/') || imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('/')
}

const handleImageError = () => {
  formError.value = 'Не удалось загрузить изображение'
  form.value.image = ''
}

const handleGalleryImageError = (index) => {
  form.value.gallery.splice(index, 1)
}

const handleMainImageUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  const validation = validateImageFile(file)
  if (!validation.valid) {
    formError.value = validation.error
    return
  }

  uploadProgress.value = 10

  try {
    // Основное изображение: до 1200px, webp q=0.85
    form.value.image = await resizeToWebp(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.85 })
    uploadProgress.value = 30
    formError.value = ''
    notify.success('Загружено')
  } catch (err) {
    console.error('Ошибка обработки изображения:', err)
    formError.value = 'Ошибка загрузки'
  } finally {
    uploadProgress.value = 0
    if (mainImageInput.value) mainImageInput.value.value = ''
  }
}

const handleGalleryUpload = async (event) => {
  const files = Array.from(event.target.files)
  if (files.length === 0) return

  const availableSlots = MAX_GALLERY_IMAGES - form.value.gallery.length
  if (availableSlots <= 0) {
    formError.value = `Максимум ${MAX_GALLERY_IMAGES} изображений`
    return
  }

  const filesToProcess = files.slice(0, availableSlots)
  let loadedCount = 0

  uploadProgress.value = 10

  // Последовательно: сохраняем порядок файлов и честный прогресс
  for (const file of filesToProcess) {
    const validation = validateImageFile(file)
    if (!validation.valid) {
      formError.value = validation.error
      continue
    }
    try {
      // Галерея: до 800px, webp q=0.75
      const webp = await resizeToWebp(file, { maxWidth: 800, maxHeight: 800, quality: 0.75 })
      form.value.gallery.push(webp)
      loadedCount++
      uploadProgress.value = 10 + Math.floor((loadedCount / filesToProcess.length) * 80)
    } catch (err) {
      console.error('Ошибка обработки изображения:', err)
    }
  }

  uploadProgress.value = 0
  if (loadedCount > 0) notify.success(`Загружено ${loadedCount}`)
  if (galleryInput.value) galleryInput.value.value = ''
}

const triggerGalleryUpload = () => {
  galleryInput.value?.click()
}

const onCategorySelect = () => {
  if (form.value.categorySelect) {
    const current = form.value.categoriesInput.split(',').map((c) => c.trim()).filter(Boolean)
    if (!current.includes(form.value.categorySelect)) {
      current.push(form.value.categorySelect)
      form.value.categoriesInput = current.join(', ')
    }
    form.value.categorySelect = ''
  }
}

const clearMainImage = () => {
  form.value.image = ''
  if (mainImageInput.value) mainImageInput.value.value = ''
  formError.value = ''
}

const removeGalleryImage = (index) => {
  form.value.gallery.splice(index, 1)
}

const handleCancel = () => {
  if (!isSubmitting.value) {
    resetForm()
    emit('update:isOpen', false)
  }
}

const handleSubmit = async () => {
  validateField('name')
  validateField('price')

  if (!isFormValid.value) return
  if (hasTooManyGalleryImages.value) {
    formError.value = `Максимум ${MAX_GALLERY_IMAGES} изображений`
    return
  }

  isSubmitting.value = true
  uploadProgress.value = 10
  formError.value = ''

  try {
    const categories = form.value.categoriesInput.split(',').map((cat) => cat.trim()).filter(Boolean)
    if (categories.length === 0) categories.push('Другое')

    const newProduct = {
      name: form.value.name.trim(),
      description: form.value.description?.trim() || '',
      price: Number(form.value.price),
      categories,
      image: form.value.image || '',
      gallery: form.value.gallery,
      inStock: Boolean(form.value.inStock),
      stockQuantity: Math.max(0, Number(form.value.stockQuantity) || 0),
    }

    uploadProgress.value = 40
    const product = await createProduct(newProduct)
    uploadProgress.value = 80

    await loadProducts(true)

    notify.success(`"${product.name}" добавлен`)
    emit('productAdded', product)

    uploadProgress.value = 100
    setTimeout(() => {
      resetForm()
      emit('update:isOpen', false)
    }, 300)
  } catch (error) {
    formError.value = error.message || 'Ошибка'
  } finally {
    isSubmitting.value = false
    uploadProgress.value = 0
  }
}

const resetForm = () => {
  form.value = {
    name: '',
    description: '',
    price: null,
    categorySelect: '',
    categoriesInput: '',
    image: '',
    gallery: [],
    inStock: true,
    stockQuantity: 0,
  }
  errors.value = { name: '', price: '' }
  if (mainImageInput.value) mainImageInput.value.value = ''
  if (galleryInput.value) galleryInput.value.value = ''
  uploadProgress.value = 0
  formError.value = ''
}

watch(() => props.isOpen, (isOpen) => {
  if (!isOpen) resetForm()
})
</script>