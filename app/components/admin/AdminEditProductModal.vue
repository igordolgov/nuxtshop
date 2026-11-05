<!-- app/components/admin/AdminEditProductModal.vue -->
<!-- Категории — мультвыбор с подсказками (AdminCategoryPicker, обяз.
    поле с валидацией; раньше — голое CSV-поле без подсказок, при этом
    allCategories не использовался вовсе, а очистка поля молча
    сохраняла прежние категории). -->
<template lang="pug">
.modal(v-if="isOpen" class="modal-open")
  //- modal-box-fit (main.css): вмещается в экран телефона (dvh-высота
  //- с полем + внутренний скролл), на desktop — авто-ширина как раньше
  .modal-box.modal-box-fit.max-w-2xl.relative.p-3(class="sm:p-6")
    //- Кнопка закрытия
    button.btn.btn-xs.btn-circle.btn-error.absolute.right-2.top-2(
      @click="handleCancel"
      :disabled="isSubmitting"
    ) ✕

    h3.text-base.font-bold.mb-2(class="sm:text-xl") {{ $t('admin.productForm.editTitle') }}
    form(@submit.prevent="handleSubmit" v-if="form")
      //- Языковые вкладки: RU — основной контент (обязательный), EN/ES —
      //- необязательные переводы (пусто → витрина показывает русский)
      .flex.gap-1.mb-2.flex-wrap.items-center
        button.btn.btn-xs(type="button" :disabled="isSubmitting" :class="langTab === 'ru' ? 'btn-primary' : 'btn-outline'" @click="langTab = 'ru'") Русский
        button.btn.btn-xs(type="button" :disabled="isSubmitting" :class="langTab === 'en' ? 'btn-primary' : 'btn-outline'" @click="langTab = 'en'") English
        button.btn.btn-xs(type="button" :disabled="isSubmitting" :class="langTab === 'es' ? 'btn-primary' : 'btn-outline'" @click="langTab = 'es'") Español
        span.text-xs.ml-1(v-if="langTab !== 'ru'" class="text-base-content/60") {{ $t('admin.productForm.optionalHint') }}

      //- Основная информация - 2 колонки на мобильных, 6 на десктопе
      .grid.gap-2.mb-2(class="grid-cols-2 sm:grid-cols-6")
        //- Название и категории — поля активной языковой вкладки
        template(v-if="langTab === 'ru'")
          .form-control(class="sm:col-span-2")
            label.label.py-1
              span.label-text.text-xs {{ $t('admin.productForm.nameLabel') }}
            input.input.input-bordered.input-sm.w-full(
              type="text"
              v-model="form.name"
              required
              :placeholder="$t('admin.productForm.namePlaceholder')"
              :disabled="isSubmitting"
            )

          //- Категории — обязательное поле, мультвыбор с подсказками
          .form-control(class="sm:col-span-2")
            label.label.py-1
              span.label-text.text-xs {{ $t('admin.productForm.categoriesLabel') }}
            AdminCategoryPicker(
              v-model="form.categories"
              :allCategories="props.allCategories || []"
              :disabled="isSubmitting"
              :error="categoriesEmpty"
              :placeholder="$t('admin.productForm.categoriesPlaceholder')"
            )
            label.label.py-1(v-if="categoriesEmpty")
              span.label-text-alt.text-error {{ $t('admin.productForm.categoriesRequired') }}

        template(v-else-if="langTab === 'en'")
          .form-control(class="sm:col-span-2")
            label.label.py-1
              span.label-text.text-xs Name (English)
            input.input.input-bordered.input-sm.w-full(
              type="text"
              v-model="form.nameEn"
              placeholder="Product name in English"
              :disabled="isSubmitting"
            )

          .form-control(class="sm:col-span-2")
            label.label.py-1
              span.label-text.text-xs Categories (English)
            AdminCategoryPicker(
              v-model="form.categoriesEn"
              :allCategories="props.allCategories || []"
              :disabled="isSubmitting"
              placeholder="Category in English or empty"
            )

        template(v-else)
          .form-control(class="sm:col-span-2")
            label.label.py-1
              span.label-text.text-xs Nombre (Español)
            input.input.input-bordered.input-sm.w-full(
              type="text"
              v-model="form.nameEs"
              placeholder="Nombre del producto en español"
              :disabled="isSubmitting"
            )

          .form-control(class="sm:col-span-2")
            label.label.py-1
              span.label-text.text-xs Categorías (Español)
            AdminCategoryPicker(
              v-model="form.categoriesEs"
              :allCategories="props.allCategories || []"
              :disabled="isSubmitting"
              placeholder="Categoría en español o vacío"
            )

        //- Цена
        .form-control(class="sm:col-span-1")
          label.label.py-1
            span.label-text.text-xs {{ $t('admin.productForm.priceLabel') }}
          input.input.input-bordered.input-sm.w-full(
            type="number"
            v-model.number="form.price"
            required
            placeholder="0"
            min="0"
            step="0.01"
            :disabled="isSubmitting"
          )

        //- Цена до скидки (необязательно; должна быть больше текущей цены)
        .form-control(class="sm:col-span-1")
          label.label.py-1
            span.label-text.text-xs {{ $t('admin.productForm.oldPriceLabel') }}
          input.input.input-bordered.input-sm.w-full(
            type="number"
            v-model.number="form.oldPrice"
            placeholder="0"
            min="0"
            step="0.01"
            :disabled="isSubmitting"
          )

        //- Количество на складе
        .form-control(class="sm:col-span-1")
          label.label.py-1
            span.label-text.text-xs {{ $t('admin.productForm.qtyLabel') }}
          input.input.input-bordered.input-sm.w-full(
            type="number"
            v-model.number="form.stockQuantity"
            min="0"
            placeholder="0"
            :disabled="isSubmitting"
          )

      //- Описание товара (активная вкладка) + наличие (чекбокс общий для
      //- всех языков и раньше занимал колонку в гриде, тесня категории)
      .form-control.mb-2
        .flex.items-center.justify-between
          label.label.py-1
            span.label-text.text-xs {{ $t('admin.productForm.descriptionLabel', { lang: langLabel }) }}
          label.cursor-pointer.flex.items-center.gap-1.text-xs
            input.checkbox.checkbox-primary.checkbox-xs(
              type="checkbox"
              v-model="form.inStock"
              :disabled="isSubmitting"
            )
            | {{ $t('admin.productForm.inStock') }}
        textarea.textarea.textarea-bordered.textarea-sm.w-full(
          v-if="langTab === 'ru'"
          v-model="form.description"
          :placeholder="$t('admin.productForm.descriptionPlaceholder')"
          rows="2"
          :disabled="isSubmitting"
        )
        textarea.textarea.textarea-bordered.textarea-sm.w-full(
          v-else-if="langTab === 'en'"
          v-model="form.descriptionEn"
          placeholder="Description in English (optional)"
          rows="2"
          :disabled="isSubmitting"
        )
        textarea.textarea.textarea-bordered.textarea-sm.w-full(
          v-else
          v-model="form.descriptionEs"
          placeholder="Descripción en español (opcional)"
          rows="2"
          :disabled="isSubmitting"
        )

      //- Основное изображение
      .grid.gap-2.mb-2(class="grid-cols-2 sm:grid-cols-4")
        .form-control(class="sm:col-span-3")
          label.label.py-1
            span.label-text.text-xs {{ $t('admin.productForm.imageLabel') }}
          .flex.flex-col.gap-1
            input.input.input-bordered.input-sm.w-full(
              type="text"
              v-model="form.image"
              :placeholder="$t('admin.productForm.imageUrlPlaceholder')"
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
            .text-xs.text-gray-500.mb-1 {{ $t('admin.productForm.preview') }}
            .w-full.h-16.border.rounded.overflow-hidden.flex.items-center.justify-center.bg-base-200(
              class="sm:h-20"
            )
              template(v-if="form.image && isValidImage(form.image)")
                //- decoding=async: декодирование превью вне главного потока
                NuxtImg(
                  :src="form.image"
                  :alt="$t('admin.productForm.preview')"
                  class="w-full h-full object-cover"
                  decoding="async"
                  @error="handleImageError"
                )
              template(v-else)
                .text-xs.text-gray-400 {{ $t('admin.productForm.previewNone') }}

      //- Галерея изображений
      .form-control.mb-1
        label.label.py-1
          span.label-text.text-xs {{ $t('admin.productForm.galleryLabel', { n: form.gallery.length, m: MAX_GALLERY_IMAGES }) }}
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
              //- lazy: превью галереи догружаются по мере видимости
              NuxtImg(
                :src="image"
                :alt="$t('admin.productForm.galleryImageAlt', { n: index + 1 })"
                class="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                @error="handleGalleryImageError(index)"
              )
            button.btn.btn-xs.btn-circle.btn-error.absolute.-top-1.-right-1.p-0(
              @click="removeGalleryImage(index)"
              :disabled="isSubmitting"
              type="button"
            ) ✕

      //- Варианты (цвет/память/размер): ось + строки. Пусто — товар без
      //- вариантов; первая строка = базовый вариант (contract variants[0])
      details.border.border-base-300.rounded-lg.group
        summary.cursor-pointer.list-none.px-3.py-2.text-sm.font-medium.flex.items-center.justify-between
          span {{ $t('admin.variants.sectionTitle', { n: variantRows.length }) }}
          svg.w-4.h-4.transition-transform(
            class="text-base-content/75 group-open:rotate-180"
            xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"
          )
            path(stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7")
        .px-3.py-3.border-t.border-base-300
          AdminVariantsEditor(
            v-model:axis="variantAxis"
            v-model:variants="variantRows"
            :disabled="isSubmitting"
          )

      //- Характеристики (spec-лист карточки): чипы-пресеты по категориям
      details.border.border-base-300.rounded-lg.mt-2.group
        summary.cursor-pointer.list-none.px-3.py-2.text-sm.font-medium.flex.items-center.justify-between
          span {{ $t('admin.characteristics.sectionTitle', { n: filledCharacteristicsCount }) }}
          svg.w-4.h-4.transition-transform(
            class="text-base-content/75 group-open:rotate-180"
            xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"
          )
            path(stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7")
        .px-3.py-3.border-t.border-base-300
          AdminCharacteristicsEditor(
            v-model="characteristicPairs"
            :categories="form.categories"
            :disabled="isSubmitting"
          )

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
        ) {{ $t('admin.common.cancel') }}
        button.btn.btn-primary.btn-sm(
          type="submit"
          :disabled="isSubmitting || !isFormValid || hasTooManyGalleryImages"
        )
          span.loading.loading-spinner.loading-xs.mr-1(v-if="isSubmitting")
          span(v-if="uploadProgress > 0 && uploadProgress < 100") {{ uploadProgress }}%
          span(v-else-if="isSubmitting") {{ $t('admin.common.saving') }}
          span(v-else) {{ $t('admin.common.save') }}
</template>

<script setup>
// ============================================
// Компонент: AdminEditProductModal
// Модалка редактирования товара.
// Категории — обязательное поле с мультвыбором (AdminCategoryPicker):
// раньше голый CSV-инпут без подсказок, при очистке которого сервер
// молча сохранял прежние категории.
// Изображения ресайзятся на клиенте в WebP (useImageResize).
// ============================================
const { updateProduct } = useProducts()
const { resizeToWebp } = useImageResize()
const notify = useNotifyQueue()
const { t } = useI18n()

const props = defineProps({
  isOpen: Boolean,
  product: Object,
  allCategories: Array,
})

const emit = defineEmits(['update:isOpen', 'productUpdated'])

const MAX_GALLERY_IMAGES = 5

// Активная языковая вкладка (RU — основной контент, EN/ES — переводы)
const langTab = ref('ru')
const LANG_LABELS = { ru: 'русский', en: 'English', es: 'Español' }
const langLabel = computed(() => LANG_LABELS[langTab.value] || 'русский')

const isSubmitting = ref(false)
const uploadProgress = ref(0)
const mainImageInput = ref(null)
const galleryInput = ref(null)
const form = ref(null)
const formError = ref('')

//- Варианты и характеристики (редакторы) — отдельные ref'ы, инициализируются
//- из props.product в initializeForm; сабмит собирает их в payload
const variantAxis = ref({ ru: '', en: '', es: '' })
const variantRows = ref([])
const characteristicPairs = ref([])
const filledCharacteristicsCount = computed(
  () => characteristicPairs.value.filter((p) => p?.label?.trim()).length,
)

const isFormValid = computed(() => {
  if (!form.value) return false
  const hasName = form.value.name && form.value.name.trim().length > 0
  const hasValidPrice = form.value.price !== null && form.value.price !== undefined && form.value.price >= 0
  // Категории обязательны — согласовано с POST/PUT («Укажите хотя бы одну категорию»)
  const hasCategories = form.value.categories.length > 0
  return hasName && hasValidPrice && hasCategories
})

const categoriesEmpty = computed(() => !form.value || form.value.categories.length === 0)

const hasTooManyGalleryImages = computed(() => {
  return form.value && form.value.gallery.length > MAX_GALLERY_IMAGES
})

const isValidImage = (imageUrl) => {
  if (!imageUrl) return false
  return imageUrl.startsWith('data:') || imageUrl.startsWith('http') || imageUrl.startsWith('/') || imageUrl.startsWith('./')
}

const handleImageError = () => {
  formError.value = t('admin.productForm.imageError')
  notify.error(t('admin.productForm.imageError'))
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
    formError.value = t(validation.error, validation.params)
    return
  }

  uploadProgress.value = 10
  try {
    form.value.image = await resizeToWebp(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.85 })
    formError.value = ''
    notify.success(t('admin.common.uploaded'))
  } catch (err) {
    console.error('Ошибка обработки изображения:', err)
    formError.value = t('admin.productForm.uploadError')
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
    formError.value = t('admin.productForm.maxImages', { n: MAX_GALLERY_IMAGES })
    return
  }

  const filesToProcess = files.slice(0, availableSlots)
  let loadedCount = 0

  uploadProgress.value = 10

  for (const file of filesToProcess) {
    const validation = validateImageFile(file)
    if (!validation.valid) {
      formError.value = t(validation.error, validation.params)
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
  if (loadedCount > 0) notify.success(t('admin.common.uploadedCount', { n: loadedCount }))
  if (galleryInput.value) galleryInput.value.value = ''
}

const handleCancel = () => {
  if (!isSubmitting.value) {
    formError.value = ''
    emit('update:isOpen', false)
  }
}

// ── Сборка вариантов/характеристик для payload ───────────────────
// Пустые названия отбрасываются; '' в цене/остатке = наследование
// (поле не уходит в тело); переводы добавляются только непустые.
const buildVariantsPayload = () =>
  variantRows.value
    .filter((variant) => variant.name?.trim())
    .map((variant) => {
      const item = {
        id: variant.id,
        name: variant.name.trim(),
        inStock: variant.inStock !== false,
      }
      if (variant.nameEn?.trim()) item.nameEn = variant.nameEn.trim()
      if (variant.nameEs?.trim()) item.nameEs = variant.nameEs.trim()
      if (variant.price !== '' && variant.price !== null && variant.price !== undefined) {
        item.price = Number(variant.price)
      }
      if (variant.image) item.image = variant.image
      if (
        variant.stockQuantity !== '' &&
        variant.stockQuantity !== null &&
        variant.stockQuantity !== undefined
      ) {
        item.stockQuantity = Number(variant.stockQuantity)
      }
      return item
    })

const buildCharacteristicsPayload = () =>
  characteristicPairs.value
    .filter((pair) => pair?.label?.trim())
    .map((pair) => ({ label: pair.label.trim(), value: (pair.value || '').trim() }))

const handleSubmit = async () => {
  if (!form.value || !isFormValid.value) return

  if (hasTooManyGalleryImages.value) {
    formError.value = t('admin.productForm.maxImages', { n: MAX_GALLERY_IMAGES })
    return
  }

  isSubmitting.value = true
  uploadProgress.value = 10
  formError.value = ''

  try {
    const categories = [...form.value.categories]

    const updatedProduct = {
      name: form.value.name.trim(),
      description: form.value.description?.trim() || '',
      price: Number(form.value.price),
      // «Цена до скидки»: пусто/мусор → null — сервер удалит поле
      // (null в PUT трактуется как «убрать скидку»)
      oldPrice:
        form.value.oldPrice === null || form.value.oldPrice === undefined || form.value.oldPrice === ''
          ? null
          : Number(form.value.oldPrice),
      categories,
      image: form.value.image || '',
      gallery: form.value.gallery || [],
      inStock: Boolean(form.value.inStock),
      stockQuantity: Number(form.value.stockQuantity) || 0,
      // Переводы уходят ВСЕГДА: пустая строка = «очистить перевод»
      // (сервер удаляет поле → витрина фолбэкается на русский)
      nameEn: form.value.nameEn?.trim() || '',
      nameEs: form.value.nameEs?.trim() || '',
      descriptionEn: form.value.descriptionEn?.trim() || '',
      descriptionEs: form.value.descriptionEs?.trim() || '',
      categoriesEn: [...(form.value.categoriesEn || [])],
      categoriesEs: [...(form.value.categoriesEs || [])],
      // Варианты: всегда полным списком (заменяют прежние; [] = без вариантов)
      variants: buildVariantsPayload(),
      variantName: variantAxis.value.ru.trim() || '',
      variantNameEn: variantAxis.value.en.trim() || '',
      variantNameEs: variantAxis.value.es.trim() || '',
      // Характеристики: всегда полным списком (заменяют прежние; [] = очистить)
      characteristics: buildCharacteristicsPayload(),
    }

    if (updatedProduct.name.length === 0) throw new Error(t('admin.productForm.nameRequired'))
    if (updatedProduct.price < 0) throw new Error(t('admin.productForm.priceNegative'))
    if (
      updatedProduct.oldPrice !== null &&
      (Number.isNaN(updatedProduct.oldPrice) ||
        updatedProduct.oldPrice < 0 ||
        updatedProduct.oldPrice <= updatedProduct.price)
    ) {
      throw new Error(t('admin.productForm.oldPriceValidation.belowPrice'))
    }

    uploadProgress.value = 60
    const product = await updateProduct(props.product.id, updatedProduct)
    uploadProgress.value = 90

    notify.success(t('admin.productForm.savedToast'))
    emit('productUpdated', product)

    uploadProgress.value = 100
    setTimeout(() => {
      isSubmitting.value = false
      uploadProgress.value = 0
      emit('update:isOpen', false)
    }, 300)
  } catch (error) {
    // ofetch кладёт тело ответа в error.data — там текст ошибки сервера;
    // error.message у FetchError — безликое «[PUT] /api/...: 400»
    formError.value = error?.data?.message || error.message || t('admin.common.error')
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
      // «Цена до скидки» (нет в записи → пусто = без скидки)
      oldPrice: props.product.oldPrice ?? null,
      categories: Array.isArray(props.product.categories) ? [...props.product.categories] : [],
      image: props.product.image || '',
      gallery: Array.isArray(props.product.gallery) ? [...props.product.gallery] : [],
      inStock: props.product.inStock !== undefined ? props.product.inStock : true,
      stockQuantity: props.product.stockQuantity || 0,
      // Переводы (пусто в KV → пусто в форме)
      nameEn: props.product.nameEn || '',
      nameEs: props.product.nameEs || '',
      descriptionEn: props.product.descriptionEn || '',
      descriptionEs: props.product.descriptionEs || '',
      categoriesEn: Array.isArray(props.product.categoriesEn) ? [...props.product.categoriesEn] : [],
      categoriesEs: Array.isArray(props.product.categoriesEs) ? [...props.product.categoriesEs] : [],
    }

    //- Варианты: строки редактора + ось; price/stockQuantity — строки
    //- ('' = наследовать от товара)
    variantAxis.value = {
      ru: props.product.variantName || '',
      en: props.product.variantNameEn || '',
      es: props.product.variantNameEs || '',
    }
    variantRows.value = (props.product.variants || []).map((variant, index) => ({
      id: variant.id || `v-${index}`,
      name: variant.name || '',
      nameEn: variant.nameEn || '',
      nameEs: variant.nameEs || '',
      price: variant.price ?? '',
      image: variant.image || '',
      inStock: variant.inStock !== false,
      stockQuantity: variant.stockQuantity ?? '',
    }))

    //- Характеристики: Record → массив пар для редактора (порядок — как в KV)
    characteristicPairs.value = Object.entries(props.product.characteristics || {}).map(
      ([label, value]) => ({ label, value: String(value) }),
    )
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
    langTab.value = 'ru'
    variantAxis.value = { ru: '', en: '', es: '' }
    variantRows.value = []
    characteristicPairs.value = []
    if (mainImageInput.value) mainImageInput.value.value = ''
    if (galleryInput.value) galleryInput.value.value = ''
  } else {
    initializeForm()
  }
})
</script>