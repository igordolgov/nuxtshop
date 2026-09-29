<!-- app/components/admin/AdminEditProductModal.vue -->
<template lang="pug">
.modal(v-if="isOpen" class="modal-open")
  .modal-box.max-w-2xl.relative.w-full.max-h-screen.p-3(class="sm:p-6 sm:w-auto")
    //- Кнопка закрытия
    button.btn.btn-xs.btn-circle.btn-error.absolute.right-2.top-2(
      @click="handleCancel"
      :disabled="isSubmitting"
    ) ✕

    h3.text-base.font-bold.mb-2(class="sm:text-xl") Редактировать товар
    form(@submit.prevent="handleSubmit" v-if="form")
      //- Основная информация - 2 колонки на мобильных, 6 на десктопе
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
          )

        //- Категории
        .form-control(class="sm:col-span-1")
          label.label.py-1
            span.label-text.text-xs Категории
          input.input.input-bordered.input-sm.w-full(
            type="text"
            v-model="form.categoriesInput"
            placeholder="Категории"
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
          )

        //- Количество на складе
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

        //- Статус наличия
        .form-control.flex.items-center.justify-end(
          class="sm:justify-center sm:items-end sm:col-span-1 sm:pb-1"
        )
          label.cursor-pointer.label.gap-1
            input.checkbox.checkbox-primary.checkbox-sm(
              type="checkbox"
              v-model="form.inStock"
              :disabled="isSubmitting"
            )
            span.label-text.text-xs В наличии

      //- Описание товара
      .form-control.mb-2
        label.label.py-1
          span.label-text.text-xs Описание
        textarea.textarea.textarea-bordered.textarea-sm.w-full(
          v-model="form.description"
          placeholder="Описание товара"
          rows="2"
          :disabled="isSubmitting"
        )

      //- Основное изображение
      .grid.gap-2.mb-2(class="grid-cols-2 sm:grid-cols-4")
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
                NuxtImg(
                  :src="form.image"
                  alt="Preview"
                  class="w-full h-full object-cover"
                  @error="handleImageError"
                )
              template(v-else)
                .text-xs.text-gray-400 Нет

      //- Галерея изображений
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
            :disabled="isSubmitting"
          )
          button.btn.btn-outline.btn-xs(
            type="button"
            @click="triggerGalleryUpload"
            :disabled="isSubmitting || form.gallery.length >= MAX_GALLERY_IMAGES"
          ) +

        //- Список галереи
        .flex.flex-wrap.gap-1.mt-1(v-if="form.gallery.length > 0")
          .relative(
            v-for="(image, index) in form.gallery"
            :key="index"
          )
            .w-12.h-12.border.rounded.overflow-hidden(class="sm:w-14 sm:h-14")
              NuxtImg(
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
          :disabled="isSubmitting || !isFormValid || hasTooManyGalleryImages"
        )
          span.loading.loading-spinner.loading-xs.mr-1(v-if="isSubmitting")
          span(v-if="uploadProgress > 0 && uploadProgress < 100") {{ uploadProgress }}%
          span(v-else-if="isSubmitting") Сохранение...
          span(v-else) Сохранить
</template>

<script setup>
// ============================================
// Компонент: AdminEditProductModal
// Модалка редактирования товара.
// Изображения ресайзятся на клиенте в WebP (useImageResize).
// ============================================
const { updateProduct } = useProducts()
const { resizeToWebp } = useImageResize()
const notify = useNotifyQueue()

const props = defineProps({
  isOpen: Boolean,
  product: Object,
  allCategories: Array,
})

const emit = defineEmits(['update:isOpen', 'productUpdated'])

const MAX_GALLERY_IMAGES = 5

const isSubmitting = ref(false)
const uploadProgress = ref(0)
const mainImageInput = ref(null)
const galleryInput = ref(null)
const form = ref(null)
const formError = ref('')

const isFormValid = computed(() => {
  if (!form.value) return false
  const hasName = form.value.name && form.value.name.trim().length > 0
  const hasValidPrice = form.value.price !== null && form.value.price !== undefined && form.value.price >= 0
  return hasName && hasValidPrice
})

const hasTooManyGalleryImages = computed(() => {
  return form.value && form.value.gallery.length > MAX_GALLERY_IMAGES
})

const isValidImage = (imageUrl) => {
  if (!imageUrl) return false
  return imageUrl.startsWith('data:') || imageUrl.startsWith('http') || imageUrl.startsWith('/') || imageUrl.startsWith('./')
}

const handleImageError = () => {
  formError.value = 'Не удалось загрузить изображение'
  notify.error('Не удалось загрузить изображение')
  form.value.image = ''
}

const handleGalleryImageError = (index) => {
  form.value.gallery.splice(index, 1)
}

const handleMainImageUpload = async (event) => {
  const file = event.target.files[0]
  if (!file || !form.value) return

  const validation = validateImageFile(file)
  if (!validation.valid) {
    formError.value = validation.error
    return
  }

  uploadProgress.value = 10
  try {
    form.value.image = await resizeToWebp(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.85 })
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
  if (files.length === 0 || !form.value) return

  const availableSlots = MAX_GALLERY_IMAGES - form.value.gallery.length
  if (availableSlots <= 0) {
    formError.value = `Максимум ${MAX_GALLERY_IMAGES} изображений`
    return
  }

  const filesToProcess = files.slice(0, availableSlots)
  let loadedCount = 0

  uploadProgress.value = 10

  for (const file of filesToProcess) {
    const validation = validateImageFile(file)
    if (!validation.valid) {
      formError.value = validation.error
      continue
    }
    try {
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

const handleCancel = () => {
  if (!isSubmitting.value) {
    formError.value = ''
    emit('update:isOpen', false)
  }
}

const handleSubmit = async () => {
  if (!form.value || !isFormValid.value) return

  if (hasTooManyGalleryImages.value) {
    formError.value = `Максимум ${MAX_GALLERY_IMAGES} изображений`
    return
  }

  isSubmitting.value = true
  uploadProgress.value = 10
  formError.value = ''

  try {
    const categories = form.value.categoriesInput
      .split(',')
      .map((cat) => cat.trim())
      .filter((cat) => cat.length > 0)

    const updatedProduct = {
      name: form.value.name.trim(),
      description: form.value.description?.trim() || '',
      price: Number(form.value.price),
      categories,
      image: form.value.image || '',
      gallery: form.value.gallery || [],
      inStock: Boolean(form.value.inStock),
      stockQuantity: Number(form.value.stockQuantity) || 0,
    }

    if (updatedProduct.name.length === 0) throw new Error('Название обязательно')
    if (updatedProduct.price < 0) throw new Error('Цена не может быть отрицательной')

    uploadProgress.value = 60
    const product = await updateProduct(props.product.id, updatedProduct)
    uploadProgress.value = 90

    notify.success('Товар обновлен')
    emit('productUpdated', product)

    uploadProgress.value = 100
    setTimeout(() => {
      isSubmitting.value = false
      uploadProgress.value = 0
      emit('update:isOpen', false)
    }, 300)
  } catch (error) {
    formError.value = error.message || 'Ошибка'
    uploadProgress.value = 0
    isSubmitting.value = false
  }
}

const clearMainImage = () => {
  if (form.value) form.value.image = ''
  if (mainImageInput.value) mainImageInput.value.value = ''
  formError.value = ''
}

const triggerGalleryUpload = () => {
  galleryInput.value?.click()
}

const removeGalleryImage = (index) => {
  if (form.value) form.value.gallery.splice(index, 1)
  formError.value = ''
}

const initializeForm = () => {
  if (props.product) {
    form.value = {
      name: props.product.name || '',
      description: props.product.description || '',
      price: props.product.price || 0,
      categoriesInput: Array.isArray(props.product.categories) ? props.product.categories.join(', ') : '',
      image: props.product.image || '',
      gallery: Array.isArray(props.product.gallery) ? [...props.product.gallery] : [],
      inStock: props.product.inStock !== undefined ? props.product.inStock : true,
      stockQuantity: props.product.stockQuantity || 0,
    }
  }
}

watch(() => props.product, (newProduct) => {
  if (newProduct) initializeForm()
}, { immediate: true })

watch(() => props.isOpen, (newVal) => {
  if (!newVal) {
    form.value = null
    formError.value = ''
    uploadProgress.value = 0
    isSubmitting.value = false
    if (mainImageInput.value) mainImageInput.value.value = ''
    if (galleryInput.value) galleryInput.value.value = ''
  } else {
    initializeForm()
  }
})
</script>