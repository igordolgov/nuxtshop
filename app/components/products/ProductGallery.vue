<!-- app/components/products/ProductGallery.vue -->
<!-- ============================================
  Компонент: ProductGallery
  Назначение: галерея изображений товара с зумом
  Props: product, gallery, productName
  Emits: image-load, image-error
============================================ -->
<template lang="pug">
.product-gallery
  .main-image-container(
    :class="{ 'swiping': !isHorizontal && (isSwiping || isDragging) }"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
  )
    .image-wrapper.rounded-box.overflow-hidden.relative.bg-base-200(
      ref="imageWrapper"
    )
      //- Кнопка "Назад"
      button.image-nav-btn.prev-btn(
        v-if="gallery.length > 1"
        @click.stop="prevImage"
        @touchstart.stop.prevent="prevImage"
        class="top-1/2 left-2 z-20 absolute -translate-y-1/2"
        aria-label="Предыдущее изображение"
      )
        svg.w-6.h-6.text-white.opacity-80(
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        )
          path(stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7")

      //- Контейнер слайдов
      .image-slides-container(
        ref="slidesContainer"
        :style="{ transform: `translateX(${slideOffset}px)` }"
        class="flex w-full h-full transition-transform duration-300 ease-out"
      )
        .image-slide(
          v-for="(image, index) in gallery"
          :key="`slide-${index}`"
          class="relative w-full h-full shrink-0"
        )
          .image-center-container
            //- Скелетон для конкретного слайда
            .skeleton.w-full.h-full.rounded-box.absolute.inset-0(
              v-if="loadingStates[index]"
              aria-hidden="true"
            )
            img(
              :src="getValidImageUrl(image)"
              :alt="`${productName} - изображение ${index + 1}`"
              class="z-10 relative product-main-image"
              :class="{ 'cursor-zoom-in': isDesktop, 'horizontal-zoom-image': isHorizontal }"
              @load="handleImageLoad(index)"
              @error="(e) => handleImageError(e, index)"
              @click="isDesktop ? openZoom(index) : null"
              draggable="false"
              placeholder
              fetchpriority="high"
              :fallback="fallbackImage"
              :width="800"
              :height="600"
              provider="ipx"
            )

      //- Кнопка "Вперёд"
      button.image-nav-btn.next-btn(
        v-if="gallery.length > 1"
        @click.stop="nextImage"
        @touchstart.stop.prevent="nextImage"
        class="top-1/2 right-2 z-20 absolute -translate-y-1/2"
        aria-label="Следующее изображение"
      )
        svg.w-6.h-6.text-white.opacity-80(
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        )
          path(stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7")

      //- Кнопка зума
      button.zoom-icon-btn(
        v-if="gallery.length > 0"
        @click.stop="openZoom(currentIndex)"
        @touchstart.stop="openZoom(currentIndex)"
        class="right-4 bottom-4 z-30 absolute flex justify-center items-center bg-black/30 hover:bg-black/50 rounded-full size-12 transition-all"
        aria-label="Увеличить изображение"
      )
        svg.w-6.h-6.text-white(
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        )
          path(stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7")

      //- Индикаторы (точки)
      .image-indicator(
        v-if="gallery.length > 1"
        class="bottom-2 sm:bottom-8 lg:bottom-1 left-1/2 z-20 absolute flex gap-2 -translate-x-1/2"
      )
        .indicator-dot(
          v-for="(image, index) in gallery"
          :key="`indicator-${index}`"
          @click.stop="goToImage(index)"
          :class="{ 'active': index === currentIndex }"
          class="rounded-full size-2 transition-all duration-300 cursor-pointer"
          :style="index === currentIndex ? 'transform: scale(1.3);' : 'background-color: rgba(255, 255, 255, 0.8);'"
          :aria-label="`Перейти к изображению ${index + 1}`"
        )

  Teleport(to="body")
    Transition(name="fade")
      .zoom-modal(v-if="isZoomOpen")
        button.close-btn(@click="closeZoom" aria-label="Закрыть")
          svg.w-6.h-6(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2")
            path(stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12")

        .image-loader(v-if="zoomLoading")
          .loading.loading-spinner.loading-lg.text-white
          span.text-white.mt-2.text-sm Загрузка...

        .zoom-container(
          @touchstart="handleZoomTouchStart"
          @touchmove="handleZoomTouchMove"
          @touchend="handleZoomTouchEnd"
          @mousedown="handleZoomMouseDown"
          @mousemove="handleZoomMouseMove"
          @mouseup="handleZoomMouseUp"
          @mouseleave="handleZoomMouseUp"
        )
          img(
            :src="zoomImageUrl"
            :alt="`${productName} - увеличенное изображение`"
            class="modal-zoom-image"
            :style="zoomStyle"
            draggable="false"
            @load="zoomLoading = false"
            @error="handleZoomError"
            placeholder
            :fallback="fallbackImage"
            :width="1200"
            :height="800"
            provider="ipx"
          )
</template>

<script setup>
import { useResizeObserver } from '@vueuse/core'

// ============================================
// Props
// ============================================
const props = defineProps({
  product: { type: Object, default: () => ({}) },
  gallery: { type: Array, default: () => [] },
  productName: { type: String, default: 'Товар' }
})

// ============================================
// Emits
// ============================================
const emit = defineEmits(['image-load', 'image-error'])

// ============================================
// Composables
// ============================================
const { isDesktop, isHorizontal } = useMobileDetection()

// ============================================
// Реактивное состояние
// ============================================
const imageWrapper = ref(null)
const slidesContainer = ref(null)
const currentIndex = ref(0)
const slideOffset = ref(0)
const fallbackImage = '/images/placeholder.jpg'

// Состояние загрузки для каждого слайда
const loadingStates = ref([])

// Swipe/Drag состояние
const touchStartX = ref(0)
const isSwiping = ref(false)
const isDragging = ref(false)
const dragStartX = ref(0)
const currentDragOffset = ref(0)

// Zoom состояние
const isZoomOpen = ref(false)
const zoomImageUrl = ref('')
const zoomLoading = ref(false)
const zoomScale = ref(1)
const zoomTranslate = ref({ x: 0, y: 0 })
const isPinching = ref(false)
const startScale = ref(1)
let zoomStartDistance = 0
let zoomIsMouseDown = false
let zoomStartX = 0
let zoomStartY = 0

// ============================================
// Вычисляемые свойства
// ============================================
const zoomStyle = computed(() => ({
  transform: `translate(${zoomTranslate.value.x}px, ${zoomTranslate.value.y}px) scale(${zoomScale.value})`,
  maxWidth: '100%',
  maxHeight: '100%'
}))

// ============================================
// Методы
// ============================================
const getValidImageUrl = (url) => {
  if (!url) return fallbackImage
  if (url.startsWith('data:')) return url
  if (url.startsWith('/')) return url
  if (url.includes('unsplash.com')) {
    if (!url.includes('?')) url += '?w=800&h=600&fit=crop'
    return url
  }
  if (url.startsWith('http')) return url
  if (url.startsWith('photo-')) return `https://images.unsplash.com/${url}`
  return fallbackImage
}

const updateSlidePosition = async () => {
  await nextTick()
  if (imageWrapper.value) {
    const width = imageWrapper.value.getBoundingClientRect().width
    slideOffset.value = -currentIndex.value * width
  }
}

// ИСПРАВЛЕНО: убран бессмысленный if/else, обе ветки делали одно и то же
const goToImage = async (index) => {
  if (index >= 0 && index < props.gallery.length) {
    currentIndex.value = index
    loadingStates.value[index] = true
    await updateSlidePosition()
  }
}

const nextImage = () => {
  const next = (currentIndex.value + 1) % props.gallery.length
  goToImage(next)
}

const prevImage = () => {
  const prev = (currentIndex.value - 1 + props.gallery.length) % props.gallery.length
  goToImage(prev)
}

// ============================================
// Обработчики изображений
// ============================================
const handleImageLoad = (index) => {
  loadingStates.value[index] = false
  // После загрузки изображения размеры контейнера могли измениться
  nextTick(() => updateSlidePosition())
  emit('image-load', { index })
}

const handleImageError = (event, index) => {
  loadingStates.value[index] = false
  if (event?.target) event.target.src = fallbackImage
  emit('image-error', { event, index })
}

// ============================================
// Touch/Slide обработчики
// ============================================
const handleTouchStart = (event) => {
  if (isHorizontal.value || props.gallery.length <= 1) return
  touchStartX.value = event.touches[0].clientX
  isSwiping.value = true
}

const handleTouchMove = (event) => {
  if (!isSwiping.value || props.gallery.length <= 1) return
  const diff = event.touches[0].clientX - touchStartX.value
  if (imageWrapper.value) {
    const width = imageWrapper.value.getBoundingClientRect().width
    const maxOffset = (props.gallery.length - 1) * width
    slideOffset.value = Math.max(-maxOffset, Math.min(0, -currentIndex.value * width + diff))
  }
}

const handleTouchEnd = async (event) => {
  if (!isSwiping.value) return
  const diff = (event.changedTouches?.[0]?.clientX || 0) - touchStartX.value
  if (Math.abs(diff) > 50) {
    // ИСПРАВЛЕНО: if/else вместо тернарника с await
    if (diff > 0) {
      await prevImage()
    } else {
      await nextImage()
    }
  } else {
    await updateSlidePosition()
  }
  isSwiping.value = false
}

// ============================================
// Mouse/Drag обработчики
// ============================================
const handleMouseDown = (event) => {
  if (props.gallery.length <= 1) return
  isDragging.value = true
  dragStartX.value = event.clientX
  currentDragOffset.value = slideOffset.value
  event.preventDefault()
}

const handleMouseMove = (event) => {
  if (!isDragging.value) return
  const diff = event.clientX - dragStartX.value
  if (imageWrapper.value) {
    const width = imageWrapper.value.getBoundingClientRect().width
    const maxOffset = (props.gallery.length - 1) * width
    slideOffset.value = Math.max(-maxOffset, Math.min(0, currentDragOffset.value + diff))
  }
}

const handleMouseUp = async (event) => {
  if (!isDragging.value) return
  const diff = event.clientX - dragStartX.value
  if (Math.abs(diff) > 50) {
    // ИСПРАВЛЕНО: if/else вместо тернарника с await
    if (diff > 0) {
      await prevImage()
    } else {
      await nextImage()
    }
  } else {
    await updateSlidePosition()
  }
  isDragging.value = false
}

const handleMouseLeave = async () => {
  if (isDragging.value) {
    isDragging.value = false
    await updateSlidePosition()
  }
}

// ============================================
// Zoom обработчики (без изменений)
// ============================================
const openZoom = (index = null) => {
  const imageIndex = index ?? currentIndex.value
  if (imageIndex < 0 || imageIndex >= props.gallery.length) return

  zoomImageUrl.value = getValidImageUrl(props.gallery[imageIndex])
  isZoomOpen.value = true
  zoomLoading.value = true
  zoomScale.value = 1
  zoomTranslate.value = { x: 0, y: 0 }
  isPinching.value = false
  document.body.style.overflow = 'hidden'
}

const closeZoom = () => {
  isZoomOpen.value = false
  zoomImageUrl.value = ''
  zoomScale.value = 1
  zoomTranslate.value = { x: 0, y: 0 }
  document.body.style.overflow = ''
}

const handleZoomError = (event) => {
  zoomLoading.value = false
  if (event?.target) event.target.src = fallbackImage
}

const handleZoomTouchStart = (event) => {
  if (event.touches?.length === 2) {
    event.preventDefault()
    isPinching.value = true
    startScale.value = zoomScale.value
    const [t1, t2] = event.touches
    zoomStartDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
  } else if (event.touches?.length === 1 && !isPinching.value) {
    zoomIsMouseDown = true
    zoomStartX = event.touches[0].clientX
    zoomStartY = event.touches[0].clientY
  }
}

const handleZoomTouchMove = (event) => {
  if (isPinching.value && event.touches?.length === 2 && zoomStartDistance > 0) {
    event.preventDefault()
    const [t1, t2] = event.touches
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
    const newScale = startScale.value * (dist / zoomStartDistance)
    zoomScale.value = Math.max(1, Math.min(5, newScale))
  } else if (zoomIsMouseDown && event.touches?.length === 1) {
    event.preventDefault()
    zoomTranslate.value = {
      x: event.touches[0].clientX - zoomStartX,
      y: event.touches[0].clientY - zoomStartY
    }
  }
}

const handleZoomTouchEnd = (event) => {
  if (event.touches?.length < 2) isPinching.value = false
  if (event.touches?.length === 0) {
    zoomIsMouseDown = false
    if (zoomScale.value < 1.1) {
      zoomScale.value = 1
      zoomTranslate.value = { x: 0, y: 0 }
    }
  }
}

const handleZoomMouseDown = (event) => {
  zoomIsMouseDown = true
  zoomStartX = event.clientX
  zoomStartY = event.clientY
}

const handleZoomMouseMove = (event) => {
  if (!zoomIsMouseDown) return
  zoomTranslate.value = {
    x: event.clientX - zoomStartX,
    y: event.clientY - zoomStartY
  }
}

const handleZoomMouseUp = () => {
  zoomIsMouseDown = false
}

// ============================================
// Lifecycle
// ============================================

// ИСПРАВЛЕНО: вынесен обработчик resize, чтобы можно было удалить его в onUnmounted
const handleResize = () => updateSlidePosition()

onMounted(async () => {
  // ИСПРАВЛЕНО: Array.from вместо new Array(...).fill(...)
  loadingStates.value = Array.from({ length: props.gallery.length }, () => true)
  await updateSlidePosition()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  // ИСПРАВЛЕНО: удаляем именно ту функцию, которую добавили
  window.removeEventListener('resize', handleResize)
  if (isZoomOpen.value) document.body.style.overflow = ''
})

// ============================================
// Watchers
// ============================================
watch(() => props.gallery, async (newGallery) => {
  currentIndex.value = 0
  // ИСПРАВЛЕНО: Array.from вместо new Array(...).fill(...)
  loadingStates.value = Array.from({ length: newGallery.length }, () => true)
  await nextTick()
  await updateSlidePosition()
}, { immediate: true })

watch(isHorizontal, async () => {
  await nextTick()
  await updateSlidePosition()
})

watch(currentIndex, async () => {
  await updateSlidePosition()
})

// ============================================
// ResizeObserver – автоматическое обновление при изменении размеров контейнера
// ============================================
useResizeObserver(imageWrapper, async () => {
  await updateSlidePosition()
})
</script>

<style scoped>
/* Стили остаются без изменений (ваши исходные стили) */
.product-gallery {
  width: 100%;
}
.main-image-container {
  width: 100%;
  position: relative;
  touch-action: pan-y pinch-zoom;
  user-select: none;
}
.image-wrapper {
  width: 100%;
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}
@media (min-width: 1024px) {
  .image-wrapper {
    height: 400px;
  }
}
.image-center-container {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  position: relative;
}
.product-main-image {
  max-width: 90%;
  max-height: 90%;
  object-fit: contain;
  position: relative;
  z-index: 10;
}
@media (min-width: 1024px) {
  .product-main-image {
    max-width: 100%;
    max-height: 100%;
    width: 100%;
    height: 100%;
  }
}
.skeleton {
  animation: pulse 2s infinite;
  border-radius: var(--radius-box, 0.5rem);
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  background-size: 200% 100%;
}
@keyframes pulse {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.image-nav-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(3, 106, 161, 0.7);
  border-radius: 50%;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0.8;
  z-index: 20;
}
.image-nav-btn:hover {
  opacity: 1;
  transform: scale(1.1);
}
.image-slides-container {
  width: 100%;
  height: 100%;
}
.image-slide {
  width: 100%;
  height: 100%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.zoom-icon-btn:hover {
  transform: scale(1.1);
}
.indicator-dot {
  box-shadow: 0px 0px 4px 1px rgba(0, 0, 0, 0.3);
}
.indicator-dot:hover {
  transform: scale(1.5);
}
.indicator-dot.active {
  background-color: rgb(35, 132, 251) !important;
  transform: scale(1.5);
}
.zoom-modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.95);
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.close-btn {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 1000;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  border: 2px solid rgba(255, 255, 255, 0.6);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}
.close-btn svg {
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4));
}
.close-btn:active {
  background: rgba(255, 255, 255, 0.4);
  transform: scale(0.95);
}
.image-loader {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.zoom-container {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.modal-zoom-image {
  max-width: 95vw;
  max-height: 95vh;
  object-fit: contain;
  touch-action: none;
  will-change: transform;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>