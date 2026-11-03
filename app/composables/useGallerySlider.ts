// app/composables/useGallerySlider.ts
// Слайдер галереи товара: позиция слайда, скелетоны загрузки, свайп
// (touch) и драг (mouse), стрелки/точки, прыжок на картинку варианта.
// Разбивка ProductGallery.vue (этап 6): состояние и обработчики живут
// здесь, шаблон и стили — в компоненте. gallery/jumpToImage передаются
// геттерами (проп может быть заменён родителем целиком).
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useResizeObserver } from '@vueuse/core';

export interface GallerySliderOptions {
  /** Геттер массива картинок галереи. */
  gallery: () => string[];
  /** Геттер URL картинки выбранного варианта (прыжок на слайд). */
  jumpToImage?: () => string | null | undefined;
  /** emit компонента: image-load / image-error. */
  emit: (event: 'image-load' | 'image-error', payload: unknown) => void;
}

export function useGallerySlider(options: GallerySliderOptions) {
  const { gallery, jumpToImage, emit } = options;

  const imageWrapper = ref<HTMLElement | null>(null);
  const slidesContainer = ref<HTMLElement | null>(null);
  const currentIndex = ref(0);
  const slideOffset = ref(0);
  const fallbackImage = '/images/placeholder.jpg';

  const loadingStates = ref<boolean[]>([]);

  const touchStartX = ref(0);
  const isSwiping = ref(false);
  const isDragging = ref(false);
  const dragStartX = ref(0);
  const currentDragOffset = ref(0);

  const getValidImageUrl = (url: string): string => {
    if (!url) return fallbackImage;
    if (url.startsWith('data:')) return url;
    if (url.startsWith('/')) return url;
    if (url.includes('unsplash.com')) {
      if (!url.includes('?')) url += '?w=800&h=600&fit=crop';
      return withImageFormat(url);
    }
    if (url.startsWith('http')) return url;
    // photo- без домена: раньше отдавался оригинал без ресайза (2-5 МБ),
    // теперь размер галереи + auto=format/q=75 (utils/productImage)
    if (url.startsWith('photo-'))
      return withImageFormat(`https://images.unsplash.com/${url}?w=800&h=600&fit=crop`);
    return fallbackImage;
  };

  const updateSlidePosition = async () => {
    await nextTick();
    if (imageWrapper.value) {
      const width = imageWrapper.value.getBoundingClientRect().width;
      slideOffset.value = -currentIndex.value * width;
    }
  };

  const goToImage = async (index: number) => {
    if (index >= 0 && index < gallery().length) {
      currentIndex.value = index;
      loadingStates.value[index] = true;
      await updateSlidePosition();
    }
  };

  const nextImage = () => {
    const next = (currentIndex.value + 1) % gallery().length;
    goToImage(next);
  };

  const prevImage = () => {
    const prev = (currentIndex.value - 1 + gallery().length) % gallery().length;
    goToImage(prev);
  };

  // ─── Обработчики изображений ─────────────────────────────────────────────

  const handleImageLoad = (index: number) => {
    loadingStates.value[index] = false;
    // После загрузки изображения размеры контейнера могли измениться
    nextTick(() => updateSlidePosition());
    emit('image-load', { index });
  };

  const handleImageError = (event: Event, index: number) => {
    loadingStates.value[index] = false;
    const target = (event as { target?: { src?: string } } | null)?.target;
    if (target) target.src = fallbackImage;
    emit('image-error', { event, index });
  };

  // ─── Touch/Slide обработчики ─────────────────────────────────────────────

  const handleTouchStart = (event: TouchEvent) => {
    // Свайп работает в обеих ориентациях; блокируем только для
    // одиночного изображения (свайпать нечего)
    if (gallery().length <= 1) return;
    touchStartX.value = event.touches[0].clientX;
    isSwiping.value = true;
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (!isSwiping.value || gallery().length <= 1) return;
    const diff = event.touches[0].clientX - touchStartX.value;
    if (imageWrapper.value) {
      const width = imageWrapper.value.getBoundingClientRect().width;
      const maxOffset = (gallery().length - 1) * width;
      slideOffset.value = Math.max(-maxOffset, Math.min(0, -currentIndex.value * width + diff));
    }
  };

  const handleTouchEnd = async (event: TouchEvent) => {
    if (!isSwiping.value) return;
    const diff = (event.changedTouches?.[0]?.clientX || 0) - touchStartX.value;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        await prevImage();
      } else {
        await nextImage();
      }
    } else {
      await updateSlidePosition();
    }
    isSwiping.value = false;
  };

  // ─── Mouse/Drag обработчики ──────────────────────────────────────────────

  const handleMouseDown = (event: MouseEvent) => {
    if (gallery().length <= 1) return;
    isDragging.value = true;
    dragStartX.value = event.clientX;
    currentDragOffset.value = slideOffset.value;
    event.preventDefault();
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!isDragging.value) return;
    const diff = event.clientX - dragStartX.value;
    if (imageWrapper.value) {
      const width = imageWrapper.value.getBoundingClientRect().width;
      const maxOffset = (gallery().length - 1) * width;
      slideOffset.value = Math.max(-maxOffset, Math.min(0, currentDragOffset.value + diff));
    }
  };

  const handleMouseUp = async (event: MouseEvent) => {
    if (!isDragging.value) return;
    const diff = event.clientX - dragStartX.value;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        await prevImage();
      } else {
        await nextImage();
      }
    } else {
      await updateSlidePosition();
    }
    isDragging.value = false;
  };

  const handleMouseLeave = async () => {
    if (isDragging.value) {
      isDragging.value = false;
      await updateSlidePosition();
    }
  };

  // ─── Lifecycle и watchers ────────────────────────────────────────────────

  const handleResize = () => updateSlidePosition();

  onMounted(async () => {
    loadingStates.value = Array.from({ length: gallery().length }, () => true);
    await updateSlidePosition();
    window.addEventListener('resize', handleResize);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
  });

  watch(
    gallery,
    async (newGallery) => {
      currentIndex.value = 0;
      loadingStates.value = Array.from({ length: newGallery.length }, () => true);
      await nextTick();
      await updateSlidePosition();
    },
    { immediate: true },
  );

  watch(currentIndex, async () => {
    await updateSlidePosition();
  });

  //- Выбор варианта с собственной картинкой: прыжок на слайд с ней.
  //- URL нет в галерее — молча игнорируем (картинка варианта может
  //- отсутствовать среди слайдов, это не ошибка)
  if (jumpToImage) {
    watch(
      jumpToImage,
      async (url) => {
        if (!url) return;
        const index = gallery().indexOf(url);
        if (index >= 0 && index !== currentIndex.value) {
          await goToImage(index);
        }
      },
      { immediate: true },
    );
  }

  // ResizeObserver – автоматическое обновление при изменении размеров
  // контейнера (в т.ч. при повороте экрана — поэтому отдельный watch
  // ориентации не нужен)
  useResizeObserver(imageWrapper, async () => {
    await updateSlidePosition();
  });

  return {
    imageWrapper,
    slidesContainer,
    currentIndex,
    slideOffset,
    fallbackImage,
    loadingStates,
    isSwiping,
    isDragging,
    getValidImageUrl,
    goToImage,
    nextImage,
    prevImage,
    handleImageLoad,
    handleImageError,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  };
}
