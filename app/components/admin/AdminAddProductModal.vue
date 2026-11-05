<!-- app/components/admin/AdminAddProductModal.vue — модалка добавления товара:
    категории ОБЯЗАТЕЛЬНЫ и выбираются мультиселектом AdminCategoryPicker
    (чипы + автодополнение; раньше — одиночный select + ручной CSV-инпут),
    пустое поле молча подставляло фиктивную категорию «Другое», которая
    сохранялась в KV и доезжала до корзины; изображения ресайзятся на
    клиенте в WebP (useImageResize) — в JSON уходит ~50–150 КБ вместо
    мегабайт base64. -->
<template lang="pug">
.modal(v-if="isOpen" class="modal-open")
  //- modal-box-fit (main.css): вмещается в экран телефона (dvh-высота
  //- с полем + внутренний скролл), на desktop — авто-ширина как раньше
  .modal-box.modal-box-fit.max-w-2xl.relative.p-3(class="sm:p-6")
    //- Кнопка закрытия
    button.btn.btn-xs.btn-circle.btn-error.absolute.right-2.top-2(
      type="button"
      @click="handleCancel"
      :disabled="isSubmitting"
      :aria-label="$t('admin.common.close')"
    ) ✕

    h3.text-base.font-bold.mb-2(class="sm:text-xl") {{ $t('admin.productForm.addTitle') }}

    form(@submit.prevent="handleSubmit")
      //- Языковые вкладки: RU — основной контент (обязательный), EN/ES —
      //- необязательные переводы (пусто → витрина показывает русский)
      .flex.gap-1.mb-2.flex-wrap.items-center
        button.btn.btn-xs(type="button" :disabled="isSubmitting" :class="langTab === 'ru' ? 'btn-primary' : 'btn-outline'" @click="langTab = 'ru'") Русский
        button.btn.btn-xs(type="button" :disabled="isSubmitting" :class="langTab === 'en' ? 'btn-primary' : 'btn-outline'" @click="langTab = 'en'") English
        button.btn.btn-xs(type="button" :disabled="isSubmitting" :class="langTab === 'es' ? 'btn-primary' : 'btn-outline'" @click="langTab = 'es'") Español
        span.text-xs.ml-1(v-if="langTab !== 'ru'" class="text-base-content/60") {{ $t('admin.productForm.optionalHint') }}

      //- Основная информация — 2 колонки на мобильных
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
              :class="{ 'input-error': errors.name }"
              @blur="validateField('name')"
            )
            label.label.py-1(v-if="errors.name")
              span.label-text-alt.text-error {{ errors.name }}

          //- Категории — обязательное поле, мультвыбор с подсказками
          .form-control(class="sm:col-span-2")
            label.label.py-1
              span.label-text.text-xs {{ $t('admin.productForm.categoriesLabel') }}
            AdminCategoryPicker(
              v-model="form.categories"
              :allCategories="props.allCategories"
              :disabled="isSubmitting"
              :error="Boolean(errors.categories)"
              :placeholder="$t('admin.productForm.categoriesPlaceholder')"
            )
            label.label.py-1(v-if="errors.categories")
              span.label-text-alt.text-error {{ errors.categories }}

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
              :allCategories="props.allCategories"
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
              :allCategories="props.allCategories"
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
            :class="{ 'input-error': errors.price }"
            @blur="validateField('price')"
          )
          label.label.py-1(v-if="errors.price")
            span.label-text-alt.text-error {{ errors.price }}

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
            :class="{ 'input-error': errors.oldPrice }"
            @blur="validateField('oldPrice')"
          )
          label.label.py-1(v-if="errors.oldPrice")
            span.label-text-alt.text-error {{ errors.oldPrice }}

        //- Количество
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

      //- Описание (активная вкладка)
      .form-control.mb-2
        label.label.py-1
          span.label-text.text-xs {{ $t('admin.productForm.descriptionLabel', { lang: langLabel }) }}
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

      //- Характеристики-переводы (en/es): редактор в своей языковой вкладке.
      //- Пусто → сервер не сохранит поле, витрина фолбэкится на русский список
      //- (известные лейблы переводятся словарём specLabels.*)
      .form-control.mb-2(v-if="langTab === 'en'")
        label.label.py-1
          span.label-text.text-xs {{ $t('admin.characteristics.enTitle') }}
        AdminCharacteristicsEditor(
          v-model="characteristicPairsEn"
          :categories="form.categories"
          lang="en"
          :disabled="isSubmitting"
        )
        p.text-xs.mt-1(class="text-base-content/50") {{ $t('admin.characteristics.fallbackHint') }}
      .form-control.mb-2(v-else-if="langTab === 'es'")
        label.label.py-1
          span.label-text.text-xs {{ $t('admin.characteristics.esTitle') }}
        AdminCharacteristicsEditor(
          v-model="characteristicPairsEs"
          :categories="form.categories"
          lang="es"
          :disabled="isSubmitting"
        )
        p.text-xs.mt-1(class="text-base-content/50") {{ $t('admin.characteristics.fallbackHint') }}

      //- Изображения
      .grid.gap-2.mb-2(class="grid-cols-2 sm:grid-cols-4")
        //- Основное изображение
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
                NuxtImg(
                  :src="form.image"
                  :alt="$t('admin.productForm.previewAlt')"
                  class="w-full h-full object-cover"
                  @error="handleImageError"
                )
              template(v-else)
                .text-xs.text-gray-400 {{ $t('admin.productForm.previewNone') }}

      //- Галерея
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
              NuxtImg(
                :src="image"
                :alt="$t('admin.productForm.galleryImageAlt', { n: index + 1 })"
                class="w-full h-full object-cover"
                @error="handleGalleryImageError(index)"
              )
            button.btn.btn-xs.btn-circle.btn-error.absolute.-top-1.-right-1.p-0(
              type="button"
              @click="removeGalleryImage(index)"
              :disabled="isSubmitting"
            ) ✕

      //- Варианты (цвет/память/размер): ось + строки; пусто — товар без
      //- вариантов; первая строка = базовый вариант (contract variants[0])
      details.border.border-base-300.rounded-lg.group.mt-1
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

      //- Ошибка формы
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
          :disabled="isSubmitting || !isFormValid"
        )
          span.loading.loading-spinner.loading-xs.mr-1(v-if="isSubmitting")
          span(v-if="isSubmitting") {{ $t('admin.common.saving') }}
          span(v-else) {{ $t('admin.common.add') }}
</template>

<script setup>
// ============================================
// Компонент: AdminAddProductModal
// Модалка добавления товара.
// Категории ОБЯЗАТЕЛЬНЫ: раньше при пустом поле сюда
// подставлялась фиктивная категория «Другое» — она сохранялась
// в KV и показывалась в корзине/избранном. Теперь — валидация
// на клиенте (поле + ошибки) и на сервере (index.post.js).
// Изображения ресайзятся на клиенте в WebP (useImageResize) —
// в JSON уходит ~50–150 КБ вместо мегабайт base64.
// ============================================
const { createProduct, loadProducts } = useProducts()
const { resizeToWebp } = useImageResize()
const notify = useNotifyQueue()
const { t } = useI18n()

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  allCategories: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:isOpen', 'productAdded'])

// ⚙️ НАСТРОЙКА: максимум изображений в галерее товара
const MAX_GALLERY_IMAGES = 5

// Активная языковая вкладка (RU — основной контент, EN/ES — переводы)
const langTab = ref('ru')
const LANG_LABELS = { ru: 'русский', en: 'English', es: 'Español' }
const langLabel = computed(() => LANG_LABELS[langTab.value] || 'русский')

const isSubmitting = ref(false)
const uploadProgress = ref(0)
const mainImageInput = ref(null)
const galleryInput = ref(null)
const formError = ref('')

//- Варианты и характеристики (редакторы) — в новой записи сохраняются
//- как есть; сабмит собирает их в payload (buildVariants/CharacteristicsPayload)
const variantAxis = ref({ ru: '', en: '', es: '' })
const variantRows = ref([])
const characteristicPairs = ref([])
//- Переводные spec-листы (вкладки EN/ES); пустой список в payload —
//- сервер не сохранит поле (фолбэк на русский)
const characteristicPairsEn = ref([])
const characteristicPairsEs = ref([])
const filledCharacteristicsCount = computed(
  () => characteristicPairs.value.filter((p) => p?.label?.trim()).length,
)

// Ошибки валидации полей (categories добавлена как обязательная)
const errors = ref({ name: '', price: '', oldPrice: '', categories: '' })

const form = ref({
  name: '',
  description: '',
  price: null,
  // «Цена до скидки» для витринного бейджа −%; пусто — без скидки
  oldPrice: null,
  categories: [],
  // Переводы (необязательные)
  nameEn: '',
  nameEs: '',
  descriptionEn: '',
  descriptionEs: '',
  categoriesEn: [],
  categoriesEs: [],
  image: '',
  gallery: [],
  inStock: true,
  stockQuantity: 0,
})

//- Категории меняются пикером — перечитываем ошибку обязательности
//- (снимаем сразу, как только выбрана первая категория)
watch(
  () => form.value.categories,
  () => {
    if (errors.value.categories) validateField('categories')
  },
  { deep: true },
)

//- Цена изменилась — перепроверяем уже показанную ошибку oldPrice
//- (условие «oldPrice > price» могло стать выполненным/нарушенным)
watch(
  () => form.value.price,
  () => {
    if (errors.value.oldPrice) validateField('oldPrice')
  },
)

const isFormValid = computed(() => {
  const hasName = form.value.name?.trim().length > 0
  const hasValidPrice =
    form.value.price !== null && form.value.price !== undefined && form.value.price >= 0
  const hasCategories = form.value.categories.length > 0
  const noErrors =
    !errors.value.name && !errors.value.price && !errors.value.oldPrice && !errors.value.categories
  return hasName && hasValidPrice && hasCategories && noErrors
})

const hasTooManyGalleryImages = computed(() => {
  return form.value.gallery.length > MAX_GALLERY_IMAGES
})

const validateField = (field) => {
  switch (field) {
    case 'name':
      if (!form.value.name?.trim()) errors.value.name = t('admin.productForm.nameValidation.required')
      else if (form.value.name.length < 2) errors.value.name = t('admin.productForm.nameValidation.min')
      else if (form.value.name.length > 100) errors.value.name = t('admin.productForm.nameValidation.max')
      else errors.value.name = ''
      break
    case 'price':
      if (form.value.price === null || form.value.price === undefined)
        errors.value.price = t('admin.productForm.priceValidation.required')
      else if (form.value.price < 0) errors.value.price = t('admin.productForm.priceValidation.negative')
      else errors.value.price = ''
      break
    case 'oldPrice':
      // Необязательное поле: пусто — ок; заполнено — положительное число
      // и строго больше текущей цены (иначе бейдж −% не имеет смысла)
      if (form.value.oldPrice === null || form.value.oldPrice === undefined || form.value.oldPrice === '')
        errors.value.oldPrice = ''
      else if (Number.isNaN(Number(form.value.oldPrice)) || form.value.oldPrice < 0)
        errors.value.oldPrice = t('admin.productForm.priceValidation.negative')
      else if (
        form.value.price !== null &&
        form.value.price !== undefined &&
        form.value.oldPrice <= form.value.price
      )
        errors.value.oldPrice = t('admin.productForm.oldPriceValidation.belowPrice')
      else errors.value.oldPrice = ''
      break
    case 'categories':
      if (form.value.categories.length === 0)
        errors.value.categories = t('admin.productForm.categoriesRequired')
      else errors.value.categories = ''
      break
  }
}

const isValidImage = (imageUrl) => {
  if (!imageUrl) return false
  return (
    imageUrl.startsWith('data:image/') ||
    imageUrl.startsWith('http://') ||
    imageUrl.startsWith('https://') ||
    imageUrl.startsWith('/')
  )
}

const handleImageError = () => {
  formError.value = t('admin.productForm.imageError')
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
    formError.value = t(validation.error, validation.params)
    return
  }

  uploadProgress.value = 10

  try {
    // Основное изображение: до 1200px, webp q=0.85
    form.value.image = await resizeToWebp(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.85 })
    uploadProgress.value = 30
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
  if (files.length === 0) return

  const availableSlots = MAX_GALLERY_IMAGES - form.value.gallery.length
  if (availableSlots <= 0) {
    formError.value = t('admin.productForm.maxImages', { n: MAX_GALLERY_IMAGES })
    return
  }

  const filesToProcess = files.slice(0, availableSlots)
  let loadedCount = 0

  uploadProgress.value = 10

  // Последовательно: сохраняем порядок файлов и честный прогресс
  for (const file of filesToProcess) {
    const validation = validateImageFile(file)
    if (!validation.valid) {
      formError.value = t(validation.error, validation.params)
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
  if (loadedCount > 0) notify.success(t('admin.common.uploadedCount', { n: loadedCount }))
  if (galleryInput.value) galleryInput.value.value = ''
}

const triggerGalleryUpload = () => {
  galleryInput.value?.click()
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

// ── Сборка вариантов/характеристик для payload (как в Edit-модалке) ──
// Пустые названия отбрасываются; '' в цене/остатке = наследование.
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

const buildCharacteristicsPayload = (pairs = characteristicPairs.value) =>
  pairs
    .filter((pair) => pair?.label?.trim())
    .map((pair) => ({ label: pair.label.trim(), value: (pair.value || '').trim() }))

const handleSubmit = async () => {
  validateField('name')
  validateField('price')
  validateField('oldPrice')
  validateField('categories')

  if (!isFormValid.value) return
  if (hasTooManyGalleryImages.value) {
    formError.value = t('admin.productForm.maxImages', { n: MAX_GALLERY_IMAGES })
    return
  }

  isSubmitting.value = true
  uploadProgress.value = 10
  formError.value = ''

  try {
    // Категории обязательны — фиктивная «Другое» больше не подставляется.
    // (Раньше здесь было: if (categories.length === 0) categories.push('Другое'))
    const categories = [...form.value.categories]

    const newProduct = {
      name: form.value.name.trim(),
      description: form.value.description?.trim() || '',
      price: Number(form.value.price),
      // «Цена до скидки»: пусто/мусор → null — сервер не сохранит поле
      oldPrice:
        form.value.oldPrice === null || form.value.oldPrice === undefined || form.value.oldPrice === ''
          ? null
          : Number(form.value.oldPrice),
      categories,
      image: form.value.image || '',
      gallery: form.value.gallery,
      inStock: Boolean(form.value.inStock),
      stockQuantity: Math.max(0, Number(form.value.stockQuantity) || 0),
      // Переводы необязательны: пустые строки сервер не сохраняет
      // (поля просто не появятся в записи — фолбэк на русский)
      nameEn: form.value.nameEn?.trim() || '',
      nameEs: form.value.nameEs?.trim() || '',
      descriptionEn: form.value.descriptionEn?.trim() || '',
      descriptionEs: form.value.descriptionEs?.trim() || '',
      categoriesEn: [...(form.value.categoriesEn || [])],
      categoriesEs: [...(form.value.categoriesEs || [])],
      // Варианты и характеристики — полными списками ([] = без них)
      variants: buildVariantsPayload(),
      variantName: variantAxis.value.ru.trim() || '',
      variantNameEn: variantAxis.value.en.trim() || '',
      variantNameEs: variantAxis.value.es.trim() || '',
      characteristics: buildCharacteristicsPayload(),
      // Переводные spec-листы: пустой список сервер не сохранит (фолбэк)
      characteristicsEn: buildCharacteristicsPayload(characteristicPairsEn.value),
      characteristicsEs: buildCharacteristicsPayload(characteristicPairsEs.value),
    }

    uploadProgress.value = 40
    const product = await createProduct(newProduct)
    uploadProgress.value = 80

    await loadProducts(true)

    notify.success(t('admin.products.addedToast', { name: product.name }))
    emit('productAdded', product)

    uploadProgress.value = 100
    setTimeout(() => {
      resetForm()
      emit('update:isOpen', false)
    }, 300)
  } catch (error) {
    // ofetch кладёт тело ответа в error.data — там живёт текст ошибки
    // от сервера («Укажите хотя бы одну категорию», «Требуется авторизация»);
    // error.message у FetchError — безликое «[POST] /api/...: 400»
    formError.value = error?.data?.message || error.message || t('admin.common.error')
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
    categories: [],
    nameEn: '',
    nameEs: '',
    descriptionEn: '',
    descriptionEs: '',
    categoriesEn: [],
    categoriesEs: [],
    image: '',
    gallery: [],
    inStock: true,
    stockQuantity: 0,
  }
  errors.value = { name: '', price: '', categories: '' }
  langTab.value = 'ru'
  if (mainImageInput.value) mainImageInput.value.value = ''
  if (galleryInput.value) galleryInput.value.value = ''
  uploadProgress.value = 0
  formError.value = ''
  variantAxis.value = { ru: '', en: '', es: '' }
  variantRows.value = []
  characteristicPairs.value = []
  characteristicPairsEn.value = []
  characteristicPairsEs.value = []
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) resetForm()
  },
)
</script>