<!-- app/components/products/ProductGallery.vue -->
<!-- ============================================
  Компонент: ProductGallery
  Назначение: галерея изображений товара с зумом
  Props: product, gallery, productName
  Emits: image-load, image-error
  Ориентация экрана не используется: свайп работает
  в обеих ориентациях; пересчёт позиции слайда при
  повороте покрывает useResizeObserver(imageWrapper).
============================================ -->
<template lang="pug">
.product-gallery
  .main-image-container(
    :class="{ 'swiping': isSwiping || isDragging }"
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
        type="button"
        @click.stop="prevImage"
        @touchstart.stop.prevent="prevImage"
        class="top-1/2 left-2 z-20 absolute -translate-y-1/2"
        :aria-label="$t('product.prevImage')"
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
            //- ⚡ LCP: первый (видимый) слайд — eager + fetchpriority=high.
            //- Остальные слайды лежат за overflow-hidden границей (translateX),
            //- loading="lazy" откладывает их загрузку до свайпа — они не
            //- конкурируют с главной картинкой за пропускную способность.
            //- Мёртвые пропсы provider="ipx"/placeholder/:fallback УДАЛЕНЫ:
            //- NuxtImg v2 их не распознаёт и сливает в DOM как невалидные
            //- атрибуты. IPX на cloudflare-module недоступен в принципе
            //- (sharp не работает на Workers), картинки уже webp — ресайз
            //- делается при загрузке в админке (useImageResize). Подмену битых
            //- картинок делает handleImageError → fallbackImage.
            img(
              :src="getValidImageUrl(image)"
              :alt="$t('product.imageAlt', { name: productName || $t('product.nameFallback'), n: index + 1 })"
              class="z-10 relative product-main-image"
              :class="{ 'cursor-zoom-in': isDesktop }"
              @load="handleImageLoad(index)"
              @error="(e) => handleImageError(e, index)"
              @click="isDesktop ? openZoom(index) : null"
              draggable="false"
              decoding="async"
              :fetchpriority="index === 0 ? 'high' : 'low'"
              :loading="index === 0 ? 'eager' : 'lazy'"
              :width="800"
              :height="600"
            )

      //- Кнопка "Вперёд"
      button.image-nav-btn.next-btn(
        v-if="gallery.length > 1"
        type="button"
        @click.stop="nextImage"
        @touchstart.stop.prevent="nextImage"
        class="top-1/2 right-2 z-20 absolute -translate-y-1/2"
        :aria-label="$t('product.nextImage')"
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
        type="button"
        @click.stop="openZoom(currentIndex)"
        @touchstart.stop="openZoom(currentIndex)"
        class="right-4 bottom-4 z-30 absolute flex justify-center items-center bg-black/30 hover:bg-black/50 rounded-full size-12 transition-all"
        :aria-label="$t('product.zoomIn')"
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
          :aria-label="$t('product.goToImage', { n: index + 1 })"
        )

  Teleport(to="body")
    Transition(name="fade")
      .zoom-modal(v-if="isZoomOpen")
        button.close-btn(type="button" @click="closeZoom" :aria-label="$t('catalog.close')")
          svg.w-6.h-6(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2")
            path(stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12")

        .image-loader(v-if="zoomLoading")
          .loading.loading-spinner.loading-lg.text-white
          span.text-white.mt-2.text-sm {{ $t('common.loading') }}

        //- Жестовый контейнер: единые Pointer Events для touch и мыши.
        //- touch-action:none обязателен — без него браузер перехватит
        //- жест под скролл/pull-to-refresh и pointermove оборвётся.
        .zoom-container(
          @pointerdown="handleZoomPointerDown"
          @pointermove="handleZoomPointerMove"
          @pointerup="handleZoomPointerUp"
          @pointercancel="handleZoomPointerCancel"
          @wheel.prevent="handleZoomWheel"
          @contextmenu.prevent
        )
          //- Зум-модалка: открывается по клику (сдвиги после user input
          //- в CLS не учитываются), декодируем асинхронно. Мёртвые пропсы
          //- provider/placeholder/fallback удалены — см. комментарий выше.
          //- Класс zoom-anim включает transition только ВНЕ активного
          //- жеста: во время пана/пинча трансформ следует за пальцем 1:1.
          img.modal-zoom-image(
            ref="zoomImageRef"
            :class="{ 'zoom-anim': !isGestureActive }"
            :src="zoomImageUrl"
            :alt="$t('product.zoomAlt', { name: productName || $t('product.nameFallback') })"
            :style="zoomStyle"
            draggable="false"
            decoding="async"
            @load="zoomLoading = false"
            @error="handleZoomError"
          )
</template>

<script setup>
// ============================================
// Компонент: ProductGallery
// Галерея товара с зумом. Разбивка (этап 6): логика слайдера (свайп,
// драг, точки, прыжок на картинку варианта) — useGallerySlider.ts,
// жестовая зум-модалка (пан/пинч/двойной тап/колесо) — useImageZoom.ts.
// Ориентация экрана не используется: свайп работает в обеих ориентациях;
// пересчёт позиции слайда при повороте покрывает useResizeObserver.
// ============================================
const props = defineProps({
  product: { type: Object, default: () => ({}) },
  gallery: { type: Array, default: () => [] },
  productName: { type: String, default: '' },
  // URL картинки выбранного варианта (цвет/память): галерея прыгает на
  // неё. null/undefined — товар без вариантов или вариант без картинки
  jumpToImage: { type: String, default: null }
})

const emit = defineEmits(['image-load', 'image-error'])

//- isDesktop: на десктопе клик по картинке открывает зум (cursor-zoom-in)
const { isDesktop } = useMobileDetection()

// Слайдер: refs (imageWrapper/slidesContainer/currentIndex/…) + обработчики
const {
  imageWrapper, slidesContainer, currentIndex, slideOffset, fallbackImage, loadingStates,
  isSwiping, isDragging,
  getValidImageUrl, goToImage, nextImage, prevImage,
  handleImageLoad, handleImageError,
  handleTouchStart, handleTouchMove, handleTouchEnd,
  handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave,
} = useGallerySlider({ gallery: () => props.gallery, jumpToImage: () => props.jumpToImage, emit })

// Зум-модалка: тот же currentIndex и та же галерея, свои жесты
const {
  isZoomOpen, zoomLoading, isGestureActive, zoomImageUrl, zoomImageRef, zoomStyle,
  openZoom, closeZoom, handleZoomError,
  handleZoomPointerDown, handleZoomPointerMove, handleZoomPointerUp,
  handleZoomPointerCancel, handleZoomWheel,
} = useImageZoom({ gallery: () => props.gallery, currentIndex, resolveUrl: getValidImageUrl, fallbackImage })
</script>

<style scoped>
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
/* Стрелки листания — только десктоп (lg+): на телефоне есть свайп и
   точки, а полупрозрачные круги поверх фото загромождают кадр и
   перехватывают жест у краёв (@touchstart.stop.prevent) */
@media (max-width: 1023.98px) {
  .image-nav-btn {
    display: none;
  }
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
  /* Тач-цель: визуально точка 8px, кликабельная зона ~24px
     (WCAG 2.5.8 — минимальная область попадания) */
  position: relative;
}
.indicator-dot::after {
  content: '';
  position: absolute;
  inset: -8px;
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
  overscroll-behavior: contain;
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
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.modal-zoom-image {
  max-width: 95vw;
  max-height: 95vh;
  object-fit: contain;
  touch-action: none;
  will-change: transform;
}

/* Плавная анимация ВНЕ активного жеста: двойной тап, пружина недозума,
   откат свайпа. Во время жеста класс снимается — трансформ следует 1:1. */
.zoom-anim {
  transition: transform 0.25s ease-out;
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