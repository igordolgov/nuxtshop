<!-- app/components/admin/AdminVariantsEditor.vue -->
<!-- Редактор вариантов товара (цвет/память/размер) для модалок админки.
     Два v-model: axis {ru,en,es} — название оси; variants — массив строк.
     Цена/остаток варианта пустые = наследуются от товара (контракт
     productHelpers: variant.price ?? product.price, variant.stockQuantity
     ?? product.stockQuantity). Первая строка = «базовый» вариант:
     карточки каталога работают с variants[0].
     Существующие переводы (nameEn/nameEs) сохраняются: в тело уходит
     полный массив, серверной потери переводов нет. -->
<template lang="pug">
.variants-editor
  //- Название оси (например, «Цвет») — с необязательными переводами
  .grid.gap-1.mb-2(class="grid-cols-3")
    .form-control
      label.label.py-1
        span.label-text.text-xs {{ $t('admin.variants.axisLabel') }}
      input.input.input-bordered.input-sm.w-full(
        type="text"
        :value="axis.ru"
        maxlength="60"
        :placeholder="$t('admin.variants.axisPlaceholder')"
        :disabled="disabled"
        @input="updateAxis('ru', $event.target.value)"
      )
    .form-control
      label.label.py-1
        span.label-text.text-xs {{ $t('admin.variants.axisEn') }}
      input.input.input-bordered.input-sm.w-full(
        type="text"
        :value="axis.en"
        maxlength="60"
        placeholder="Color"
        :disabled="disabled"
        @input="updateAxis('en', $event.target.value)"
      )
    .form-control
      label.label.py-1
        span.label-text.text-xs {{ $t('admin.variants.axisEs') }}
      input.input.input-bordered.input-sm.w-full(
        type="text"
        :value="axis.es"
        maxlength="60"
        placeholder="Color"
        :disabled="disabled"
        @input="updateAxis('es', $event.target.value)"
      )

  //- Строки вариантов
  .flex.flex-col.gap-2
    .variant-row.border.border-base-300.rounded-lg.p-2(v-for="(variant, index) in variants" :key="index")
      .flex.flex-wrap.gap-1.items-center
        //- Порядковый бейдж: первая строка = базовый вариант (variants[0])
        span.badge.badge-sm.shrink-0(:class="index === 0 ? 'badge-primary' : 'badge-ghost'") {{ index + 1 }}
        input.input.input-bordered.input-sm.flex-1.min-w-32(
          type="text"
          :value="variant.name"
          maxlength="120"
          :placeholder="$t('admin.variants.namePlaceholder')"
          :aria-label="$t('admin.variants.nameAria', { n: index + 1 })"
          :disabled="disabled"
          @input="updateVariant(index, 'name', $event.target.value)"
        )
        input.input.input-bordered.input-sm.w-28(
          type="number"
          :value="variant.price"
          min="0"
          step="0.01"
          :placeholder="$t('admin.variants.pricePlaceholder')"
          :aria-label="$t('admin.variants.priceAria', { n: index + 1 })"
          :disabled="disabled"
          @input="updateVariant(index, 'price', $event.target.value)"
        )
        input.input.input-bordered.input-sm.w-20(
          type="number"
          :value="variant.stockQuantity"
          min="0"
          :placeholder="$t('admin.variants.stockPlaceholder')"
          :aria-label="$t('admin.variants.stockAria', { n: index + 1 })"
          :disabled="disabled"
          @input="updateVariant(index, 'stockQuantity', $event.target.value)"
        )
        label.cursor-pointer.flex.items-center.gap-1.text-xs.shrink-0
          input.checkbox.checkbox-primary.checkbox-xs(
            type="checkbox"
            :checked="variant.inStock !== false"
            :disabled="disabled"
            :aria-label="$t('admin.variants.inStockAria', { n: index + 1 })"
            @change="updateVariant(index, 'inStock', $event.target.checked)"
          )
          | {{ $t('admin.variants.inStock') }}
        button.btn.btn-ghost.btn-xs.btn-square.shrink-0(
          type="button"
          :disabled="disabled"
          :aria-label="$t('admin.variants.removeAria')"
          @click="removeVariant(index)"
        ) ✕

      //- Фото варианта: мини-превью + загрузка (WebP на клиенте) + очистка
      .flex.items-center.gap-2.mt-1
        .size-9.border.rounded.overflow-hidden.bg-base-200.flex.items-center.justify-center.shrink-0
          img(v-if="variant.image" :src="variant.image" :alt="$t('admin.variants.imageAlt', { n: index + 1 })" class="w-full h-full object-cover")
          span.text-base-content/30.text-xs(v-else) —
        input.hidden(type="file" accept="image/jpeg,image/png,image/webp" :ref="(el) => (fileInputs[index] = el)" @change="handleImageUpload($event, index)")
        button.btn.btn-ghost.btn-xs(type="button" :disabled="disabled" @click="fileInputs[index]?.click()")
          | {{ $t('admin.variants.imageBtn') }}
        button.btn.btn-ghost.btn-xs(type="button" v-if="variant.image" :disabled="disabled" @click="updateVariant(index, 'image', '')")
          | {{ $t('admin.variants.imageClear') }}

      //- Переводы названия варианта (опционально; пусто → фолбэк на русский)
      details.variant-translations
        summary.text-xs.cursor-pointer(class="text-base-content/60")
          | {{ $t('admin.variants.translations') }}
        .grid.gap-1.mt-1(class="grid-cols-2")
          input.input.input-bordered.input-sm.w-full(
            type="text"
            :value="variant.nameEn || ''"
            maxlength="120"
            placeholder="Name (English)"
            :disabled="disabled"
            @input="updateVariant(index, 'nameEn', $event.target.value)"
          )
          input.input.input-bordered.input-sm.w-full(
            type="text"
            :value="variant.nameEs || ''"
            maxlength="120"
            placeholder="Nombre (Español)"
            :disabled="disabled"
            @input="updateVariant(index, 'nameEs', $event.target.value)"
          )

  .text-xs.mt-1(v-if="variants.length === 0" class="text-base-content/50")
    | {{ $t('admin.variants.emptyHint') }}

  .flex.items-center.gap-2.mt-2
    button.btn.btn-outline.btn-xs(type="button" :disabled="disabled || variants.length >= MAX_VARIANTS" @click="addVariant")
      | + {{ $t('admin.variants.addBtn') }}
    span.text-xs(v-if="variants.length >= MAX_VARIANTS" class="text-warning")
      | {{ $t('admin.variants.maxReached', { n: MAX_VARIANTS }) }}
    span.text-xs(class="text-base-content/50")
      | {{ $t('admin.variants.baseHint') }}
</template>

<script setup>
// ============================================
// Компонент: AdminVariantsEditor
// Лимит 50 строк согласован с VARIANT_MAX в server/lib/productHelpers.
// Цена/остаток в форме хранятся строками ('' = наследовать) — конвертацию
// в число делает модалка при сабмите (как с базовой ценой товара).
// ============================================
const { resizeToWebp } = useImageResize()
const props = defineProps({
  // Название оси: { ru: 'Цвет', en: 'Color', es: 'Color' }
  axis: { type: Object, default: () => ({ ru: '', en: '', es: '' }) },
  // [{ id?, name, nameEn?, nameEs?, price, image, inStock, stockQuantity }]
  variants: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:axis', 'update:variants'])

// Лимит строк согласован с VARIANT_MAX в productHelpers
const MAX_VARIANTS = 50

const fileInputs = ref([])

const updateAxis = (locale, value) => {
  emit('update:axis', { ...props.axis, [locale]: value })
}

const emitVariants = (variants) => emit('update:variants', variants)

const newVariantId = () => `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

const addVariant = () => {
  if (props.variants.length >= MAX_VARIANTS) return
  emitVariants([
    ...props.variants,
    { id: newVariantId(), name: '', price: '', image: '', inStock: true, stockQuantity: '' },
  ])
}

const updateVariant = (index, field, value) => {
  const variants = props.variants.map((variant, i) =>
    i === index ? { ...variant, [field]: value } : variant,
  )
  emitVariants(variants)
}

const removeVariant = (index) => {
  emitVariants(props.variants.filter((_, i) => i !== index))
}

const handleImageUpload = async (event, index) => {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const webp = await resizeToWebp(file, { maxWidth: 800, maxHeight: 800, quality: 0.75 })
    updateVariant(index, 'image', webp)
  } catch (error) {
    console.error('Ошибка обработки изображения варианта:', error)
  } finally {
    if (fileInputs.value[index]) fileInputs.value[index].value = ''
  }
}
</script>
