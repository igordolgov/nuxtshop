<!-- app\components\admin\ImagePickerModal.vue -->
<template lang="pug">
dialog.modal(:class="{ 'modal-open': isOpen }")
  .modal-box.bg-base-200.border.border-base-300.max-w-md(class="w-11/12")
    .flex.justify-between.items-center.mb-4
      h3.text-lg.font-bold.text-base-content Выбор изображения
      button.btn.btn-ghost.btn-sm(@click="closeModal") ✕

    .space-y-3
      //- Предустановленные изображения
      .grid.grid-cols-3.gap-2
        .aspect-square.cursor-pointer.border-2.rounded-lg(
          v-for="image in presetImages"
          :key="image"
          :class="{ 'border-primary': selectedImage === image }"
          @click="selectImage(image)"
        )
          NuxtImg.w-full.h-full.object-cover.rounded(
            :src="image"
            @error="handleImageError"
          )
      
      //- Поле для ввода своего URL
      .form-control
        label.label.label-text.py-1 Или введите свой URL:
        .flex.gap-2
          input.input.input-bordered.input-sm.flex-1(
            type="url"
            v-model="customImageUrl"
            placeholder="https://example.com/image.jpg"
          )
          button.btn.btn-primary.btn-sm(
            @click="selectCustomImage"
            :disabled="!isValidUrl(customImageUrl)"
          ) Выбрать

    .modal-action.mt-4
      button.btn.btn-ghost.btn-sm(@click="closeModal") Отмена
</template>

<script setup lang="ts">
interface Props {
  isOpen: boolean
}

interface Emits {
  (e: 'update:isOpen', value: boolean): void
  (e: 'imageSelected', url: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selectedImage = ref('')
const customImageUrl = ref('')

// Предустановленные изображения
const presetImages = [
  'https://via.placeholder.com/300x300?text=Изображение+1',
  'https://via.placeholder.com/300x300?text=Изображение+2',
  'https://via.placeholder.com/300x300?text=Изображение+3',
  'https://via.placeholder.com/300x300?text=Изображение+4',
  'https://via.placeholder.com/300x300?text=Изображение+5',
  'https://via.placeholder.com/300x300?text=Изображение+6'
]

// Валидация URL
const isValidUrl = (string: string) => {
  try {
    new URL(string)
    return true
  } catch (_) {
    return false
  }
}

// Обработчик ошибок изображения
const handleImageError = (event: Event) => {
  const target = event.target as HTMLImageElement
  target.src = 'https://via.placeholder.com/150?text=Ошибка'
}

// Выбор изображения
const selectImage = (imageUrl: string) => {
  selectedImage.value = imageUrl
  emit('imageSelected', imageUrl)
  closeModal()
}

// Выбор кастомного изображения
const selectCustomImage = () => {
  if (customImageUrl.value && isValidUrl(customImageUrl.value)) {
    emit('imageSelected', customImageUrl.value)
    closeModal()
  }
}

// Закрытие модального окна
const closeModal = () => {
  selectedImage.value = ''
  customImageUrl.value = ''
  emit('update:isOpen', false)
}
</script>
