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
              :alt="`${productName} - изображение ${index + 1}`"
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
        type="button"
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
        button.close-btn(type="button" @click="closeZoom" aria-label="Закрыть")
          svg.w-6.h-6(xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2")
            path(stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12")

        .image-loader(v-if="zoomLoading")
          .loading.loading-spinner.loading-lg.text-white
          span.text-white.mt-2.text-sm Загрузка...

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
            :alt="`${productName} - увеличенное изображение`"
            :style="zoomStyle"
            draggable="false"
            decoding="async"
            @load="zoomLoading = false"
            @error="handleZoomError"
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
// Composables.
//- isHorizontal удалён вместе с боковой навигацией: свайп галереи
//- работает в обеих ориентациях, позиция слайда при повороте
//- пересчитывается через useResizeObserver
// ============================================
const { isDesktop } = useMobileDetection()

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

// Zoom состояние (модалка)
const isZoomOpen = ref(false)
const zoomImageUrl = ref('')
const zoomLoading = ref(false)
const zoomScale = ref(1)
const zoomTranslate = ref({ x: 0, y: 0 })
const isGestureActive = ref(false)
const zoomImageRef = ref(null)

// Параметры жестов
const ZOOM_MIN = 1
const ZOOM_MAX = 5
const WHEEL_SENSITIVITY = 0.0015
const DBL_TAP_SCALE = 2.5
const TAP_MS = 300 // окно двойного тапа / задержка закрытия по тапу
const TAP_SLOP = 8 // движение меньше этого — считается тапом
const TAP_DIST = 40 // максимальный разнос двух тапов
const SWIPE_MS = 600 // максимальная длительность свайпа-листания
const SWIPE_X = 60 // горизонтальный порог свайпа-листания
const SWIPE_Y = 80 // вертикальный допуск свайпа-листания

// Состояние активного жеста. Не reactive: обновляется на каждый
// pointermove, reactive-обёртки здесь сознательно не используются.
const activePointers = new Map()
let gestureMode = 'none' // 'none' | 'pan' | 'pinch'
let gestureLayout = { w: 0, h: 0 }
let gestureStartScale = 1
let gestureBaseTranslate = { x: 0, y: 0 }
let gestureStartPt = { x: 0, y: 0 }
let gestureStartMid = { x: 0, y: 0 }
let gestureStartDist = 1
let gestureStartTime = 0
let tapTimer = null
let lastTap = { time: 0, x: 0, y: 0 }

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
    return withImageFormat(url)
  }
  if (url.startsWith('http')) return url
  // photo- без домена: раньше отдавался оригинал без ресайза (2-5 МБ),
  // теперь размер галереи + auto=format/q=75 (utils/productImage)
  if (url.startsWith('photo-')) return withImageFormat(`https://images.unsplash.com/${url}?w=800&h=600&fit=crop`)
  return fallbackImage
}

const updateSlidePosition = async () => {
  await nextTick()
  if (imageWrapper.value) {
    const width = imageWrapper.value.getBoundingClientRect().width
    slideOffset.value = -currentIndex.value * width
  }
}

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
  // Свайп работает в обеих ориентациях; блокируем только для
  // одиночного изображения (свайпать нечего)
  if (props.gallery.length <= 1) return
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
// Zoom обработчики
// ============================================
const openZoom = (index = null) => {
  const imageIndex = index ?? currentIndex.value
  if (imageIndex < 0 || imageIndex >= props.gallery.length) return

  cancelTapTimer()
  activePointers.clear()
  gestureMode = 'none'
  isGestureActive.value = false
  lastTap = { time: 0, x: 0, y: 0 }
  zoomImageUrl.value = getValidImageUrl(props.gallery[imageIndex])
  isZoomOpen.value = true
  zoomLoading.value = true
  zoomScale.value = 1
  zoomTranslate.value = { x: 0, y: 0 }
  document.body.style.overflow = 'hidden'
}

const closeZoom = () => {
  cancelTapTimer()
  activePointers.clear()
  gestureMode = 'none'
  isGestureActive.value = false
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

// ============================================
// Zoom: геометрия трансформации
// ============================================
//- Размер картинки в layout-пикселях (без учёта transform):
//- getBoundingClientRect возвращает уже масштабированный бокс,
//- поэтому делим на текущий масштаб.
const measureLayout = () => {
  const el = zoomImageRef.value
  if (!el?.getBoundingClientRect) return { w: 0, h: 0 }
  const rect = el.getBoundingClientRect()
  const s = zoomScale.value || 1
  return { w: rect.width / s, h: rect.height / s }
}

//- Пределы сдвига: масштабированная картинка не должна покидать экран.
//- Картинка отцентрирована flex-контейнером, поэтому transform-origin —
//- центр экрана, а допустимый |t| = (layout * scale - viewport) / 2.
const clampTranslate = (t, scale) => {
  const maxX = Math.max(0, (gestureLayout.w * scale - window.innerWidth) / 2)
  const maxY = Math.max(0, (gestureLayout.h * scale - window.innerHeight) / 2)
  return {
    x: Math.min(maxX, Math.max(-maxX, t.x)),
    y: Math.min(maxY, Math.max(-maxY, t.y))
  }
}

const clampScale = (scale) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale))

//- Масштабирование с «якорем»: точка экрана screenPt остаётся на месте.
//- Формула: t1 = m − (s1/s0)·(m − t0), где m — точка относительно центра
//- экрана. При возврате к ZOOM_MIN картинка пружинит в центр без сдвига.
const zoomAround = (scale, screenPt) => {
  const s0 = zoomScale.value || 1
  const s1 = clampScale(scale)
  if (s1 === s0) return
  if (s1 <= ZOOM_MIN + 0.001) {
    zoomScale.value = ZOOM_MIN
    zoomTranslate.value = { x: 0, y: 0 }
    return
  }
  gestureLayout = measureLayout()
  const t0 = zoomTranslate.value
  const k = s1 / s0
  const mx = screenPt.x - window.innerWidth / 2
  const my = screenPt.y - window.innerHeight / 2
  const t1 = clampTranslate({ x: mx - k * (mx - t0.x), y: my - k * (my - t0.y) }, s1)
  zoomScale.value = s1
  zoomTranslate.value = t1
}

// ============================================
// Zoom: жесты (Pointer Events — один путь для touch и мыши)
// ============================================
const getPinchGeometry = () => {
  const [a, b] = [...activePointers.values()]
  return {
    dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }
}

//- Ребейз базы жеста: весь накопленный сдвиг уходит в baseTranslate,
//- поэтому новый палец/пинч продолжают с текущего положения, а не с нуля.
const startPan = (x, y) => {
  gestureMode = 'pan'
  gestureStartPt = { x, y }
  gestureBaseTranslate = { ...zoomTranslate.value }
  gestureLayout = measureLayout()
}

const cancelTapTimer = () => {
  if (tapTimer) {
    clearTimeout(tapTimer)
    tapTimer = null
  }
}

const handleZoomPointerDown = (event) => {
  if (!isZoomOpen.value || zoomLoading.value) return
  if (event.pointerType === 'mouse' && event.button !== 0) return

  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  isGestureActive.value = true
  try {
    event.currentTarget.setPointerCapture?.(event.pointerId)
  } catch {}

  if (activePointers.size === 1) {
    startPan(event.clientX, event.clientY)
    gestureStartScale = zoomScale.value
    gestureStartTime = Date.now()
  } else if (activePointers.size === 2) {
    // Второй палец — переключаемся на пинч с новой базой
    const { dist, mid } = getPinchGeometry()
    gestureMode = 'pinch'
    gestureStartDist = dist
    gestureStartMid = mid
    gestureBaseTranslate = { ...zoomTranslate.value }
    gestureStartScale = zoomScale.value
    gestureLayout = measureLayout()
  }
}

const handleZoomPointerMove = (event) => {
  if (!activePointers.has(event.pointerId)) return
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  if (gestureMode === 'pinch' && activePointers.size >= 2) {
    // Пинч: масштаб по дистанции пальцев, сдвиг — чтобы середина между
    // пальцами ехала вместе с жестом (zoom-to-midpoint)
    const { dist, mid } = getPinchGeometry()
    const s1 = clampScale(gestureStartScale * (dist / gestureStartDist))
    const k = s1 / gestureStartScale
    const mx0 = gestureStartMid.x - window.innerWidth / 2
    const my0 = gestureStartMid.y - window.innerHeight / 2
    const mx1 = mid.x - window.innerWidth / 2
    const my1 = mid.y - window.innerHeight / 2
    const t1 = {
      x: mx1 - k * (mx0 - gestureBaseTranslate.x),
      y: my1 - k * (my0 - gestureBaseTranslate.y)
    }
    zoomScale.value = s1
    zoomTranslate.value = clampTranslate(t1, s1)
  } else if (gestureMode === 'pan' && activePointers.size === 1) {
    const p = [...activePointers.values()][0]
    const dx = p.x - gestureStartPt.x
    const dy = p.y - gestureStartPt.y
    if (Math.hypot(dx, dy) > TAP_SLOP) cancelTapTimer()

    if (zoomScale.value <= ZOOM_MIN + 0.001) {
      // Масштаб 1: это жест листания — горизонтальный сдвиг с демпфированием
      zoomTranslate.value = { x: Math.max(-120, Math.min(120, dx * 0.35)), y: 0 }
    } else {
      // Пан: накопленный сдвиг + дельта жеста, с прижимом к границам
      const t1 = {
        x: gestureBaseTranslate.x + dx,
        y: gestureBaseTranslate.y + dy
      }
      zoomTranslate.value = clampTranslate(t1, zoomScale.value)
    }
  }
}

const handleZoomPointerUp = (event) => {
  if (!activePointers.has(event.pointerId)) return
  const p = { x: event.clientX, y: event.clientY }
  activePointers.delete(event.pointerId)
  try {
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  } catch {}

  // Тап и свайп-листание имеют смысл только для одиночного pan-жеста
  let afterGesture = null
  if (gestureMode === 'pan' && activePointers.size === 0) {
    const dx = p.x - gestureStartPt.x
    const dy = p.y - gestureStartPt.y
    const dist = Math.hypot(dx, dy)
    const dt = Date.now() - gestureStartTime
    if (dist < TAP_SLOP && dt < TAP_MS) {
      afterGesture = () => handleZoomTap(p)
    } else if (
      zoomScale.value <= ZOOM_MIN + 0.001 &&
      dt < SWIPE_MS &&
      Math.abs(dx) > SWIPE_X &&
      Math.abs(dy) < SWIPE_Y &&
      props.gallery.length > 1
    ) {
      cancelTapTimer()
      const next =
        dx < 0
          ? (currentIndex.value + 1) % props.gallery.length
          : (currentIndex.value - 1 + props.gallery.length) % props.gallery.length
      afterGesture = () => openZoom(next)
    }
  }

  endGesture()
  if (afterGesture) afterGesture()
}

const handleZoomPointerCancel = (event) => {
  activePointers.delete(event.pointerId)
  endGesture()
}

// Все пальцы убраны: гасим жест; недозум пружинит обратно к «fit»
const endGesture = () => {
  if (activePointers.size === 1 && gestureMode === 'pinch') {
    // После пинча остался один палец — ребейз в пан без прыжка
    const p = [...activePointers.values()][0]
    startPan(p.x, p.y)
    return
  }
  if (activePointers.size > 0) return
  gestureMode = 'none'
  isGestureActive.value = false
  if (zoomScale.value < 1.1) {
    zoomScale.value = ZOOM_MIN
    zoomTranslate.value = { x: 0, y: 0 }
  } else {
    zoomTranslate.value = clampTranslate(zoomTranslate.value, zoomScale.value)
  }
}

//- Тап: двойной — зум к точке тапа / возврат к fit; одиночный при
//- масштабе 1 закрывает модалку (с задержкой TAP_MS — вдруг двойной)
const handleZoomTap = (p) => {
  const now = Date.now()
  const isDoubleTap =
    now - lastTap.time < TAP_MS &&
    Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < TAP_DIST

  if (isDoubleTap) {
    cancelTapTimer()
    lastTap = { time: 0, x: 0, y: 0 }
    if (zoomScale.value > ZOOM_MIN + 0.05) {
      zoomAround(ZOOM_MIN, p)
    } else {
      zoomAround(DBL_TAP_SCALE, p)
    }
    return
  }

  lastTap = { time: now, x: p.x, y: p.y }
  cancelTapTimer()
  tapTimer = setTimeout(() => {
    tapTimer = null
    if (zoomScale.value <= ZOOM_MIN + 0.05) closeZoom()
  }, TAP_MS)
}

//- Колесо/тачпад (в т.ч. ctrl+wheel — пинч на тачпаде): зум к курсору
const handleZoomWheel = (event) => {
  if (!isZoomOpen.value) return
  const factor = Math.exp(-event.deltaY * WHEEL_SENSITIVITY)
  zoomAround(zoomScale.value * factor, { x: event.clientX, y: event.clientY })
}

const handleZoomKeydown = (event) => {
  if (event.key === 'Escape' && isZoomOpen.value) closeZoom()
}

// ============================================
// Lifecycle
// ============================================

const handleResize = () => updateSlidePosition()

onMounted(async () => {
  loadingStates.value = Array.from({ length: props.gallery.length }, () => true)
  await updateSlidePosition()
  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleZoomKeydown)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleZoomKeydown)
  if (isZoomOpen.value) document.body.style.overflow = ''
  cancelTapTimer()
})

// ============================================
// Watchers
// ============================================
watch(() => props.gallery, async (newGallery) => {
  currentIndex.value = 0
  loadingStates.value = Array.from({ length: newGallery.length }, () => true)
  await nextTick()
  await updateSlidePosition()
}, { immediate: true })

//- watch(isHorizontal) УДАЛЁН: пересчёт при повороте экрана
//- покрывает useResizeObserver(imageWrapper) ниже

watch(currentIndex, async () => {
  await updateSlidePosition()
})

// ============================================
// ResizeObserver – автоматическое обновление при изменении размеров контейнера
// (в т.ч. при повороте экрана — поэтому отдельный watch ориентации не нужен)
// ============================================
useResizeObserver(imageWrapper, async () => {
  await updateSlidePosition()
})
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