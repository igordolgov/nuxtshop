// app/composables/useImageZoom.ts
// Zoom-модалка галереи товара: открытие/закрытие, жесты Pointer Events
// (пан, пинч, двойной тап, свайп-листание между картинками), колесо мыши.
// Разбивка ProductGallery.vue (этап 6): жестовая подсистема живёт здесь,
// шаблон модалки и стили — в компоненте. touch-action:none на контейнере
// (в шаблоне) обязателен — без него браузер перехватит жест под скролл.
import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue';

export interface ImageZoomOptions {
  /** Геттер массива картинок галереи. */
  gallery: () => string[];
  /** Текущий слайд слайдера (общий с useGallerySlider). */
  currentIndex: Ref<number>;
  /** Нормализация URL слайда → рабочий src. */
  resolveUrl: (url: string) => string;
  /** Плейсхолдер битой картинки. */
  fallbackImage: string;
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 5;
const WHEEL_SENSITIVITY = 0.0015;
const DBL_TAP_SCALE = 2.5;
const TAP_MS = 300; // окно двойного тапа / задержка закрытия по тапу
const TAP_SLOP = 8; // движение меньше этого — считается тапом
const TAP_DIST = 40; // максимальный разнос двух тапов
const SWIPE_MS = 600; // максимальная длительность свайпа-листания
const SWIPE_X = 60; // горизонтальный порог свайпа-листания
const SWIPE_Y = 80; // вертикальный допуск свайпа-листания

export function useImageZoom(options: ImageZoomOptions) {
  const { gallery, resolveUrl, fallbackImage } = options;
  const currentIndex = options.currentIndex;

  const isZoomOpen = ref(false);
  const zoomImageUrl = ref('');
  const zoomLoading = ref(false);
  const zoomScale = ref(1);
  const zoomTranslate = ref({ x: 0, y: 0 });
  const isGestureActive = ref(false);
  const zoomImageRef = ref<HTMLElement | null>(null);

  const activePointers = new Map<number, { x: number; y: number }>();
  let gestureMode: 'none' | 'pan' | 'pinch' = 'none';
  let gestureLayout = { w: 0, h: 0 };
  let gestureStartScale = 1;
  let gestureBaseTranslate = { x: 0, y: 0 };
  let gestureStartPt = { x: 0, y: 0 };
  let gestureStartMid = { x: 0, y: 0 };
  let gestureStartDist = 1;
  let gestureStartTime = 0;
  let tapTimer: ReturnType<typeof setTimeout> | null = null;
  let lastTap = { time: 0, x: 0, y: 0 };

  const zoomStyle = computed(() => ({
    transform: `translate(${zoomTranslate.value.x}px, ${zoomTranslate.value.y}px) scale(${zoomScale.value})`,
    maxWidth: '100%',
    maxHeight: '100%',
  }));

  // ─── Открытие / закрытие ─────────────────────────────────────────────────

  const openZoom = (index: number | null = null) => {
    const imageIndex = index ?? currentIndex.value;
    if (imageIndex < 0 || imageIndex >= gallery().length) return;

    cancelTapTimer();
    activePointers.clear();
    gestureMode = 'none';
    isGestureActive.value = false;
    lastTap = { time: 0, x: 0, y: 0 };
    zoomImageUrl.value = resolveUrl(gallery()[imageIndex]);
    isZoomOpen.value = true;
    zoomLoading.value = true;
    zoomScale.value = 1;
    zoomTranslate.value = { x: 0, y: 0 };
    document.body.style.overflow = 'hidden';
  };

  const closeZoom = () => {
    cancelTapTimer();
    activePointers.clear();
    gestureMode = 'none';
    isGestureActive.value = false;
    isZoomOpen.value = false;
    zoomImageUrl.value = '';
    zoomScale.value = 1;
    zoomTranslate.value = { x: 0, y: 0 };
    document.body.style.overflow = '';
  };

  const handleZoomError = (event: Event) => {
    zoomLoading.value = false;
    const target = (event as { target?: { src?: string } } | null)?.target;
    if (target) target.src = fallbackImage;
  };

  // ─── Геометрия трансформации ─────────────────────────────────────────────
  //- Размер картинки в layout-пикселях (без учёта transform):
  //- getBoundingClientRect возвращает уже масштабированный бокс,
  //- поэтому делим на текущий масштаб.
  const measureLayout = () => {
    const el = zoomImageRef.value;
    if (!el?.getBoundingClientRect) return { w: 0, h: 0 };
    const rect = el.getBoundingClientRect();
    const s = zoomScale.value || 1;
    return { w: rect.width / s, h: rect.height / s };
  };

  //- Пределы сдвига: масштабированная картинка не должна покидать экран.
  //- Картинка отцентрирована flex-контейнером, поэтому transform-origin —
  //- центр экрана, а допустимый |t| = (layout * scale - viewport) / 2.
  const clampTranslate = (t: { x: number; y: number }, scale: number) => {
    const maxX = Math.max(0, (gestureLayout.w * scale - window.innerWidth) / 2);
    const maxY = Math.max(0, (gestureLayout.h * scale - window.innerHeight) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, t.x)),
      y: Math.min(maxY, Math.max(-maxY, t.y)),
    };
  };

  const clampScale = (scale: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale));

  //- Масштабирование с «якорем»: точка экрана screenPt остаётся на месте.
  //- Формула: t1 = m − (s1/s0)·(m − t0), где m — точка относительно центра
  //- экрана. При возврате к ZOOM_MIN картинка пружинит в центр без сдвига.
  const zoomAround = (scale: number, screenPt: { x: number; y: number }) => {
    const s0 = zoomScale.value || 1;
    const s1 = clampScale(scale);
    if (s1 === s0) return;
    if (s1 <= ZOOM_MIN + 0.001) {
      zoomScale.value = ZOOM_MIN;
      zoomTranslate.value = { x: 0, y: 0 };
      return;
    }
    gestureLayout = measureLayout();
    const t0 = zoomTranslate.value;
    const k = s1 / s0;
    const mx = screenPt.x - window.innerWidth / 2;
    const my = screenPt.y - window.innerHeight / 2;
    const t1 = clampTranslate({ x: mx - k * (mx - t0.x), y: my - k * (my - t0.y) }, s1);
    zoomScale.value = s1;
    zoomTranslate.value = t1;
  };

  // ─── Жесты (Pointer Events — один путь для touch и мыши) ─────────────────

  const getPinchGeometry = () => {
    const [a, b] = [...activePointers.values()];
    return {
      dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  };

  //- Ребейз базы жеста: весь накопленный сдвиг уходит в baseTranslate,
  //- поэтому новый палец/пинч продолжают с текущего положения, а не с нуля.
  const startPan = (x: number, y: number) => {
    gestureMode = 'pan';
    gestureStartPt = { x, y };
    gestureBaseTranslate = { ...zoomTranslate.value };
    gestureLayout = measureLayout();
  };

  const cancelTapTimer = () => {
    if (tapTimer) {
      clearTimeout(tapTimer);
      tapTimer = null;
    }
  };

  const handleZoomPointerDown = (event: PointerEvent) => {
    if (!isZoomOpen.value || zoomLoading.value) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    isGestureActive.value = true;
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {}

    if (activePointers.size === 1) {
      startPan(event.clientX, event.clientY);
      gestureStartScale = zoomScale.value;
      gestureStartTime = Date.now();
    } else if (activePointers.size === 2) {
      // Второй палец — переключаемся на пинч с новой базой
      const { dist, mid } = getPinchGeometry();
      gestureMode = 'pinch';
      gestureStartDist = dist;
      gestureStartMid = mid;
      gestureBaseTranslate = { ...zoomTranslate.value };
      gestureStartScale = zoomScale.value;
      gestureLayout = measureLayout();
    }
  };

  const handleZoomPointerMove = (event: PointerEvent) => {
    if (!activePointers.has(event.pointerId)) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (gestureMode === 'pinch' && activePointers.size >= 2) {
      // Пинч: масштаб по дистанции пальцев, сдвиг — чтобы середина между
      // пальцами ехала вместе с жестом (zoom-to-midpoint)
      const { dist, mid } = getPinchGeometry();
      const s1 = clampScale(gestureStartScale * (dist / gestureStartDist));
      const k = s1 / gestureStartScale;
      const mx0 = gestureStartMid.x - window.innerWidth / 2;
      const my0 = gestureStartMid.y - window.innerHeight / 2;
      const mx1 = mid.x - window.innerWidth / 2;
      const my1 = mid.y - window.innerHeight / 2;
      const t1 = {
        x: mx1 - k * (mx0 - gestureBaseTranslate.x),
        y: my1 - k * (my0 - gestureBaseTranslate.y),
      };
      zoomScale.value = s1;
      zoomTranslate.value = clampTranslate(t1, s1);
    } else if (gestureMode === 'pan' && activePointers.size === 1) {
      const p = [...activePointers.values()][0];
      const dx = p.x - gestureStartPt.x;
      const dy = p.y - gestureStartPt.y;
      if (Math.hypot(dx, dy) > TAP_SLOP) cancelTapTimer();

      if (zoomScale.value <= ZOOM_MIN + 0.001) {
        // Масштаб 1: это жест листания — горизонтальный сдвиг с демпфированием
        zoomTranslate.value = { x: Math.max(-120, Math.min(120, dx * 0.35)), y: 0 };
      } else {
        // Пан: накопленный сдвиг + дельта жеста, с прижимом к границам
        const t1 = {
          x: gestureBaseTranslate.x + dx,
          y: gestureBaseTranslate.y + dy,
        };
        zoomTranslate.value = clampTranslate(t1, zoomScale.value);
      }
    }
  };

  const handleZoomPointerUp = (event: PointerEvent) => {
    if (!activePointers.has(event.pointerId)) return;
    const p = { x: event.clientX, y: event.clientY };
    activePointers.delete(event.pointerId);
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {}

    // Тап и свайп-листание имеют смысл только для одиночного pan-жеста
    let afterGesture: (() => void) | null = null;
    if (gestureMode === 'pan' && activePointers.size === 0) {
      const dx = p.x - gestureStartPt.x;
      const dy = p.y - gestureStartPt.y;
      const dist = Math.hypot(dx, dy);
      const dt = Date.now() - gestureStartTime;
      if (dist < TAP_SLOP && dt < TAP_MS) {
        afterGesture = () => handleZoomTap(p);
      } else if (
        zoomScale.value <= ZOOM_MIN + 0.001 &&
        dt < SWIPE_MS &&
        Math.abs(dx) > SWIPE_X &&
        Math.abs(dy) < SWIPE_Y &&
        gallery().length > 1
      ) {
        cancelTapTimer();
        const next =
          dx < 0
            ? (currentIndex.value + 1) % gallery().length
            : (currentIndex.value - 1 + gallery().length) % gallery().length;
        afterGesture = () => openZoom(next);
      }
    }

    endGesture();
    if (afterGesture) afterGesture();
  };

  const handleZoomPointerCancel = (event: PointerEvent) => {
    activePointers.delete(event.pointerId);
    endGesture();
  };

  // Все пальцы убраны: гасим жест; недозум пружинит обратно к «fit»
  const endGesture = () => {
    if (activePointers.size === 1 && gestureMode === 'pinch') {
      // После пинча остался один палец — ребейз в пан без прыжка
      const p = [...activePointers.values()][0];
      startPan(p.x, p.y);
      return;
    }
    if (activePointers.size > 0) return;
    gestureMode = 'none';
    isGestureActive.value = false;
    if (zoomScale.value < 1.1) {
      zoomScale.value = ZOOM_MIN;
      zoomTranslate.value = { x: 0, y: 0 };
    } else {
      zoomTranslate.value = clampTranslate(zoomTranslate.value, zoomScale.value);
    }
  };

  //- Тап: двойной — зум к точке тапа / возврат к fit; одиночный при
  //- масштабе 1 закрывает модалку (с задержкой TAP_MS — вдруг двойной)
  const handleZoomTap = (p: { x: number; y: number }) => {
    const now = Date.now();
    const isDoubleTap =
      now - lastTap.time < TAP_MS && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < TAP_DIST;

    if (isDoubleTap) {
      cancelTapTimer();
      lastTap = { time: 0, x: 0, y: 0 };
      if (zoomScale.value > ZOOM_MIN + 0.05) {
        zoomAround(ZOOM_MIN, p);
      } else {
        zoomAround(DBL_TAP_SCALE, p);
      }
      return;
    }

    lastTap = { time: now, x: p.x, y: p.y };
    cancelTapTimer();
    tapTimer = setTimeout(() => {
      tapTimer = null;
      if (zoomScale.value <= ZOOM_MIN + 0.05) closeZoom();
    }, TAP_MS);
  };

  //- Колесо/тачпад (в т.ч. ctrl+wheel — пинч на тачпаде): зум к курсору
  const handleZoomWheel = (event: WheelEvent) => {
    if (!isZoomOpen.value) return;
    const factor = Math.exp(-event.deltaY * WHEEL_SENSITIVITY);
    zoomAround(zoomScale.value * factor, { x: event.clientX, y: event.clientY });
  };

  const handleZoomKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && isZoomOpen.value) closeZoom();
  };

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  onMounted(() => {
    window.addEventListener('keydown', handleZoomKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleZoomKeydown);
    if (isZoomOpen.value) document.body.style.overflow = '';
    cancelTapTimer();
  });

  return {
    isZoomOpen,
    zoomImageUrl,
    zoomLoading,
    zoomScale,
    zoomTranslate,
    isGestureActive,
    zoomImageRef,
    zoomStyle,
    openZoom,
    closeZoom,
    handleZoomError,
    handleZoomPointerDown,
    handleZoomPointerMove,
    handleZoomPointerUp,
    handleZoomPointerCancel,
    handleZoomWheel,
  };
}
