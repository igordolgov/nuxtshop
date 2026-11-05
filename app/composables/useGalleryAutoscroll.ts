// app/composables/useGalleryAutoscroll.ts
// Автоскролл галереи товара: раз в intervalMs — следующий слайд
// (nextImage слайдера уже зациклен, переход анимирует
// transition-transform на .image-slides-container).
//
// Прерывание НАВСЕГДА (не пауза) при любом пользовательском действии:
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
// Не запускается: при единственном изображении и при
// prefers-reduced-motion: reduce (автолистание — движение, а глобальный
// CSS проекта его глушит — не оставляем рассинхрона).
// В фоновой вкладке (document.hidden) тик пропускается с перепланированием:
// слайды не «листаются» невидимыми пачками, цикл продолжается по возвращении.
import { onMounted, onUnmounted, watch, type Ref } from 'vue';

export interface GalleryAutoscrollOptions {
  /** Ref корневого контейнера галереи (capture-слушатели прерывания). */
  container: Ref<HTMLElement | null>;
  /** Геттер массива картинок галереи. */
  gallery: () => unknown[];
  /** Шаг вперёд с зацикливанием (nextImage слайдера). */
  advance: () => void;
  /** Геттер URL картинки выбранного варианта. */
  jumpToImage?: () => string | null | undefined;
  /** Пауза между слайдами, мс. */
  intervalMs?: number;
}

/** Стандарт каруселей: 4 с на слайд. */
const DEFAULT_INTERVAL_MS = 4000;

/** Окно игнорирования scroll-сигналов после старта (см. шапку). */
const SETTLE_MS = 1000;

export function useGalleryAutoscroll(options: GalleryAutoscrollOptions) {
  const { container, gallery, advance, jumpToImage, intervalMs = DEFAULT_INTERVAL_MS } = options;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let startedAt = 0;

  // Снятие ровно того, что навесили: stop() и onUnmounted.
  const detachFns: Array<() => void> = [];

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    for (const detach of detachFns) detach();
    detachFns.length = 0;
  };

  const schedule = () => {
    if (stopped || gallery().length <= 1) return;
    timer = setTimeout(tick, intervalMs);
  };

  const tick = () => {
    timer = null;
    if (stopped) return;
    if (document.hidden) {
      schedule();
      return;
    }
    advance();
    schedule();
  };

  const stopOnScroll = () => {
    // Восстановление позиции скролла после клиентской навигации —
    // не пользовательский скролл (см. шапку файла).
    if (Date.now() - startedAt <= SETTLE_MS) return;
    stop();
  };

  const attachInterrupts = () => {
    const el = container.value;
    if (!el) return;
    // capture + passive: только наблюдаем, ничего не перехватываем.
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const removeOpts: EventListenerOptions = { capture: true };
    el.addEventListener('touchstart', stop, opts);
    el.addEventListener('pointerdown', stop, opts);
    el.addEventListener('wheel', stop, opts);
    // Клавиатурная навигация, пока фокус внутри галереи (Enter/стрелки
    // на стрелках-кнопках и точках).
    el.addEventListener('keydown', stop, opts);
    window.addEventListener('scroll', stopOnScroll, { passive: true });
    detachFns.push(
      () => el.removeEventListener('touchstart', stop, removeOpts),
      () => el.removeEventListener('pointerdown', stop, removeOpts),
      () => el.removeEventListener('wheel', stop, removeOpts),
      () => el.removeEventListener('keydown', stop, removeOpts),
      () => window.removeEventListener('scroll', stopOnScroll),
    );
  };

  onMounted(() => {
    if (gallery().length <= 1) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    startedAt = Date.now();
    attachInterrupts();
    schedule();
  });

  onUnmounted(stop);

  //- Выбор варианта после монтирования — пользовательское действие.
  if (jumpToImage) {
    watch(jumpToImage, (url) => {
      if (url) stop();
    });
  }
}
