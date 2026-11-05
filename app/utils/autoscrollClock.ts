// app/utils/autoscrollClock.ts
// Чистая таймерная логика автоскролла каруселей — без DOM и Vue.
// Отделена от useGalleryAutoscroll (DOM-обвязка), чтобы покрываться
// юнит-тестами в node-окружении (tests/unit/autoscroll-clock.test.ts).
//
// Цикл — цепочка setTimeout с интервалом intervalMs: тик либо выполняет
// onTick и перезапускается, либо (в скрытой вкладке / при canTick: false)
// просто перезапускается — слайды не «листаются» невидимыми пачками.
// pause() снимает ближайший тик и возобновляет цикл через resumeMs
// бездействия; повторные pause() сдвигают возобновление. Возобновление
// не дёргает слайд сразу: первый шаг — через intervalMs.
// dispose() останавливает всё навсегда (размонтирование компонента).

export interface AutoscrollClockOptions {
  /** Пауза между слайдами, мс. */
  intervalMs: number;
  /** Бездействие до возобновления после pause(), мс. */
  resumeMs: number;
  /** Вкладка скрыта — тики пропускаются с перепланированием. */
  isHidden: () => boolean;
  /** Разрешён ли следующий тик (например, в галерее >1 картинки). */
  canTick?: () => boolean;
  /** Действие тика (следующий слайд). */
  onTick: () => void;
}

export interface AutoscrollClock {
  /** Запуск цикла, если он ещё не идёт и не запланировано возобновление. */
  start: () => void;
  /** Снять ближайший тик и запланировать возобновление через resumeMs. */
  pause: () => void;
  /** Остановить всё навсегда. */
  dispose: () => void;
}

export function createAutoscrollClock(options: AutoscrollClockOptions): AutoscrollClock {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let resumeTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const schedule = () => {
    if (disposed) return;
    timer = setTimeout(tick, options.intervalMs);
  };

  const tick = () => {
    timer = null;
    if (disposed) return;
    if (options.isHidden() || (options.canTick && !options.canTick())) {
      schedule();
      return;
    }
    options.onTick();
    schedule();
  };

  return {
    start() {
      if (disposed || timer !== null || resumeTimer !== null) return;
      schedule();
    },
    pause() {
      if (disposed) return;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (resumeTimer !== null) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        resumeTimer = null;
        schedule();
      }, options.resumeMs);
    },
    dispose() {
      disposed = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (resumeTimer !== null) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    },
  };
}
