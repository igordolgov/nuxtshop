// app/composables/useGalleryAutoscroll.ts
// Автоскролл галереи товара: раз в intervalMs — следующий слайд
// (nextImage слайдера уже зациклен, переход анимирует
// transition-transform на .image-slides-container).
//
// Пользовательское действие — ПАУЗА с возобновлением через resumeMs
// (по умолчанию 5 с) бездействия; каждое новое действие сдвигает
// возобновление. Первый слайд после возобновления — через intervalMs,
// мгновенного прыжка нет. Пауза при:
// · касание/клик/драг внутри галереи — touchstart/pointerdown/wheel/keydown
//   на контейнере в CAPTURE-фазе: события кнопок со .stop (стрелки, зум,
//   точки) тоже доходят — .stop срабатывает позже, в bubble-фазе таргета;
// · скролл страницы — window scroll. Свою страницу компонент не скроллит,
//   поэтому любой scroll-ивент — пользовательский. Исключение —
//   восстановление позиции при клиентской навигации (vue-router делает
//   scrollTo сразу после монтирования): первые SETTLE_MS после старта
//   scroll-сигнал игнорируется;
// · выбор варианта товара (jumpToImage изменился после монтирования) —
//   не отрываем галерею от картинки, которую пользователь выбрал.
//   Диплинк с предвыбранным вариантом прыжка при монтировании не считается
//   выбором — автоскролл от него продолжает работать.
//
// Совсем не запускается: при единственном изображении и при
// prefers-reduced-motion: reduce (автолистание — движение, а глобальный
// CSS проекта его глушит — не оставляем рассинхрона).
// Таймерная логика (тик/пауза/возобновление) — в чистой фабрике
// createAutoscrollClock (app/utils/autoscrollClock.ts), покрытой
// юнит-тестами; этот композабл — тонкая DOM-обвязка: слушатели паузы,
// matchMedia, жизненный цикл.
import { onMounted, onUnmounted, watch, type Ref } from 'vue';
import { createAutoscrollClock, type AutoscrollClock } from '../utils/autoscrollClock';

export interface GalleryAutoscrollOptions {
  /** Ref корневого контейнера галереи (capture-слушатели паузы). */
  container: Ref<HTMLElement | null>;
  /** Геттер массива картинок галереи. */
  gallery: () => unknown[];
  /** Шаг вперёд с зацикливанием (nextImage слайдера). */
  advance: () => void;
  /** Геттер URL картинки выбранного варианта. */
  jumpToImage?: () => string | null | undefined;
  /** Пауза между слайдами, мс. */
  intervalMs?: number;
  /** Бездействие до возобновления после действия пользователя, мс. */
  resumeMs?: number;
}

/** Стандарт каруселей: 4 с на слайд. */
const DEFAULT_INTERVAL_MS = 4000;

/** Бездействие до возобновления автоскролла. */
const DEFAULT_RESUME_MS = 5000;

/** Окно игнорирования scroll-сигналов после старта (см. шапку). */
const SETTLE_MS = 1000;

export function useGalleryAutoscroll(options: GalleryAutoscrollOptions) {
  const {
    container,
    gallery,
    advance,
    jumpToImage,
    intervalMs = DEFAULT_INTERVAL_MS,
    resumeMs = DEFAULT_RESUME_MS,
  } = options;

  // Снятие ровно того, что навесили: teardown() и onUnmounted.
  const detachFns: Array<() => void> = [];
  let clock: AutoscrollClock | null = null;
  let startedAt = 0;
  let disposed = false;

  const pause = () => clock?.pause();

  const pauseOnScroll = () => {
    // Восстановление позиции скролла после клиентской навигации —
    // не пользовательский скролл (см. шапку файла).
    if (Date.now() - startedAt <= SETTLE_MS) return;
    pause();
  };

  const attachInterrupts = () => {
    const el = container.value;
    if (!el) return;
    // capture + passive: только наблюдаем, ничего не перехватываем.
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const removeOpts: EventListenerOptions = { capture: true };
    el.addEventListener('touchstart', pause, opts);
    el.addEventListener('pointerdown', pause, opts);
    el.addEventListener('wheel', pause, opts);
    // Клавиатурная навигация, пока фокус внутри галереи (Enter/стрелки
    // на стрелках-кнопках и точках).
    el.addEventListener('keydown', pause, opts);
    window.addEventListener('scroll', pauseOnScroll, { passive: true });
    detachFns.push(
      () => el.removeEventListener('touchstart', pause, removeOpts),
      () => el.removeEventListener('pointerdown', pause, removeOpts),
      () => el.removeEventListener('wheel', pause, removeOpts),
      () => el.removeEventListener('keydown', pause, removeOpts),
      () => window.removeEventListener('scroll', pauseOnScroll),
    );
  };

  const teardown = () => {
    if (disposed) return;
    disposed = true;
    clock?.dispose();
    for (const detach of detachFns) detach();
    detachFns.length = 0;
  };

  onMounted(() => {
    if (gallery().length <= 1) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    startedAt = Date.now();
    clock = createAutoscrollClock({
      intervalMs,
      resumeMs,
      isHidden: () => document.hidden,
      canTick: () => gallery().length > 1,
      onTick: advance,
    });
    attachInterrupts();
    clock.start();
  });

  onUnmounted(teardown);

  // Выбор варианта после монтирования — пользовательское действие.
  if (jumpToImage) {
    watch(jumpToImage, (url) => {
      if (url) pause();
    });
  }
}
