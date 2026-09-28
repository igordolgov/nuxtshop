<!-- app/components/ui/ImageZoom.vue -->
<template lang="pug">
.image-zoom-container
  .main-image-wrapper(
    :class="{ 'cursor-zoom-in': !isZoomed, 'cursor-zoom-out': isZoomed }"
    @click="toggleZoom"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
  )
    //- width/height="0" — подсказка браузеру для предотвращения layout shift.
    //- Реальный размер задаётся CSS (.main-image).
    img.main-image(
      :src="src"
      :alt="alt"
      :style="imageStyle"
      width="0"
      height="0"
      ref="imageRef"
      @load="handleImageLoad"
    )

    //- Лупа при увеличении
    .magnifier(
      v-if="isZoomed && zoomType === 'magnifier'"
      :style="magnifierStyle"
    )
      .magnifier-image(:style="magnifiedImageStyle")

  //- Полноэкранный режим
  .fullscreen-overlay(
    v-if="isZoomed && zoomType === 'fullscreen'"
    @click="closeZoom"
  )
    .fullscreen-content
      button.close-button(
        @click="closeZoom"
        aria-label="Закрыть"
        type="button"
      ) ✕
      img.fullscreen-image(
        :src="src"
        :alt="alt"
        width="0"
        height="0"
      )

  //- Кнопка увеличения
  button.zoom-button(
    v-if="showZoomButton && !isZoomed"
    @click="toggleZoom"
    :title="zoomButtonText"
    aria-label="Увеличить изображение"
    type="button"
  ) 🔍
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Props {
  src: string
  alt?: string
  zoomType?: 'magnifier' | 'fullscreen'
  zoomLevel?: number
  magnifierSize?: number
  showZoomButton?: boolean
  zoomButtonText?: string
  maxWidth?: string
  maxHeight?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  alt: '',
  zoomType: 'magnifier',
  zoomLevel: 2,
  magnifierSize: 150,
  showZoomButton: true,
  zoomButtonText: 'Увеличить изображение',
  maxWidth: '100%',
  maxHeight: '400',
})

const emits = defineEmits<{
  zoomIn: []
  zoomOut: []
}>()

// Refs
const imageRef = ref<HTMLImageElement>()
const isZoomed = ref(false)
const mousePosition = ref({ x: 0, y: 0 })
const imageDimensions = ref({ width: 0, height: 0 })
const containerDimensions = ref({ width: 0, height: 0 })
const isImageLoaded = ref(false)

// Вычисляемые свойства
const imageStyle = computed(() => {
  const maxHeight =
    typeof props.maxHeight === 'number' ? `${props.maxHeight}px` : props.maxHeight

  return {
    maxWidth: props.maxWidth,
    maxHeight: isZoomed.value ? 'none' : maxHeight,
    cursor: isZoomed.value ? 'zoom-out' : 'zoom-in',
  }
})

const magnifierStyle = computed(() => ({
  width: `${props.magnifierSize}px`,
  height: `${props.magnifierSize}px`,
  left: `${mousePosition.value.x - props.magnifierSize / 2}px`,
  top: `${mousePosition.value.y - props.magnifierSize / 2}px`,
  display: isZoomed.value && isMouseInBounds.value ? 'block' : 'none',
}))

const isMouseInBounds = computed(() => {
  if (!imageRef.value) return false

  const rect = imageRef.value.getBoundingClientRect()
  const x = mousePosition.value.x
  const y = mousePosition.value.y

  return x >= 0 && x <= rect.width && y >= 0 && y <= rect.height
})

const magnifiedImageStyle = computed(() => {
  if (!imageRef.value || !isImageLoaded.value) return {}

  const rect = imageRef.value.getBoundingClientRect()
  const imageAspect = imageDimensions.value.width / imageDimensions.value.height
  const containerAspect = rect.width / rect.height

  let displayedWidth: number
  let displayedHeight: number

  if (imageAspect > containerAspect) {
    displayedWidth = rect.width
    displayedHeight = rect.width / imageAspect
  } else {
    displayedHeight = rect.height
    displayedWidth = rect.height * imageAspect
  }

  const bgWidth = imageDimensions.value.width * props.zoomLevel
  const bgHeight = imageDimensions.value.height * props.zoomLevel

  const scaleX = imageDimensions.value.width / displayedWidth
  const scaleY = imageDimensions.value.height / displayedHeight

  const bgPositionX =
    -mousePosition.value.x * scaleX * props.zoomLevel + props.magnifierSize / 2
  const bgPositionY =
    -mousePosition.value.y * scaleY * props.zoomLevel + props.magnifierSize / 2

  return {
    backgroundImage: `url(${props.src})`,
    backgroundSize: `${bgWidth}px ${bgHeight}px`,
    backgroundPosition: `${bgPositionX}px ${bgPositionY}px`,
    backgroundRepeat: 'no-repeat',
    width: '100%',
    height: '100%',
  }
})

// Методы
const handleImageLoad = () => {
  if (!imageRef.value) return

  imageDimensions.value = {
    width: imageRef.value.naturalWidth,
    height: imageRef.value.naturalHeight,
  }
  const rect = imageRef.value.getBoundingClientRect()
  containerDimensions.value = {
    width: rect.width,
    height: rect.height,
  }
  isImageLoaded.value = true
}

const handleMouseMove = (event: MouseEvent) => {
  if (!imageRef.value || !isZoomed.value) return

  const rect = imageRef.value.getBoundingClientRect()
  mousePosition.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

const handleMouseLeave = () => {
  // Скрываем лупу при выходе за пределы изображения
}

const toggleZoom = () => {
  if (!isImageLoaded.value) return

  isZoomed.value = !isZoomed.value

  if (isZoomed.value) {
    emits('zoomIn')
    if (props.zoomType === 'fullscreen') {
      document.body.style.overflow = 'hidden'
    }
  } else {
    emits('zoomOut')
    if (props.zoomType === 'fullscreen') {
      document.body.style.overflow = ''
    }
  }
}

const closeZoom = () => {
  isZoomed.value = false
  emits('zoomOut')
  document.body.style.overflow = ''
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isZoomed.value) {
    closeZoom()
  }
}

const handleResize = () => {
  if (isZoomed.value && props.zoomType === 'fullscreen') {
    closeZoom()
  }
  if (imageRef.value) {
    const rect = imageRef.value.getBoundingClientRect()
    containerDimensions.value = {
      width: rect.width,
      height: rect.height,
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', handleResize)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.image-zoom-container {
  position: relative;
  display: inline-block;
  max-width: 100%;
}

.main-image-wrapper {
  position: relative;
  display: inline-block;
  overflow: hidden;
  border-radius: 8px;
  transition: transform 0.3s ease;
}

.main-image {
  display: block;
  transition: all 0.3s ease;
  border-radius: 8px;
  width: 100%;
  height: auto;
  object-fit: contain;
}

.main-image:hover {
  transform: scale(1.02);
}

.cursor-zoom-in {
  cursor: zoom-in;
}

.cursor-zoom-out {
  cursor: zoom-out;
}

.magnifier {
  position: absolute;
  border: 2px solid #fff;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.1);
  pointer-events: none;
  z-index: 10;
  box-shadow: 0 0 20px rgb(0 0 0 / 0.3);
  overflow: hidden;
  transition: opacity 0.2s ease;
}

.magnifier-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.fullscreen-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100dvh;
  background: rgb(0 0 0 / 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  cursor: zoom-out;
  animation: fadeIn 0.3s ease;
}

.fullscreen-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
}

.fullscreen-image {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
}

.close-button {
  position: absolute;
  top: -40px;
  right: 0;
  background: rgb(0 0 0 / 0.7);
  color: white;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.3s ease;
}

.close-button:hover {
  background: rgb(0 0 0 / 0.9);
}

.zoom-button {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgb(0 0 0 / 0.7);
  color: white;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 5;
}

.zoom-button:hover {
  background: rgb(0 0 0 / 0.9);
  transform: scale(1.1);
}

@media (max-width: 768px) {
  .magnifier {
    display: none !important;
  }

  .zoom-button {
    width: 36px;
    height: 36px;
    font-size: 14px;
  }

  .fullscreen-content {
    max-width: 95vw;
    max-height: 95vh;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>