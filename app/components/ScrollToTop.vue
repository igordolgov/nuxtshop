<!-- app/components/ScrollToTop.vue -->
<template lang="pug">
button.scroll-to-top-btn(
  v-show="isVisible",
  :class="{ 'is-visible': isVisible }",
  type="button",
  :aria-label="$t('common.scrollToTop')",
  :title="$t('common.scrollToTop')",
  @click="scrollToTop"
)
  //- Кольцо прогресса: доля прокрутки текущего контекста (страница,
  //- каталог на главной, таблица админки). dashoffset двигается
  //- напрямую в rAF — без реактивности на каждый scroll-кадр.
  svg.progress-ring(
    viewBox="0 0 44 44",
    :stroke-dasharray="ringLength",
    :stroke-dashoffset="ringLength",
    aria-hidden="true"
  )
    circle(cx="22", cy="22", r="20", ref="ringEl")
  svg.scroll-icon(
    viewBox="0 0 24 24",
    width="22",
    height="22",
    fill="currentColor",
    aria-hidden="true"
  )
    path(d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z")
</template>

<script setup>
const props = defineProps({
  threshold: { type: Number, default: 200 },
})

const route = useRoute()

//- Режим 'position' (классика «кнопки наверх»): видна всегда, когда
//- страница/каталог прокручены дальше threshold, в любом направлении.
//- Прежний режим 'direction' (WB/Ozon: вниз — скрыть, вверх — показать)
//- пользователи читали как поломку: «кнопка не появляется при скролле
//- вниз». У верха страницы (<= threshold) всегда скрыта (atTop: 'hide').
//- useScrollDirection сам ставит capture-слушатель на window (scroll не
//- всплывает — ловится и внутренний скролл каталога на главной) и
//- отсекает горизонтальные ленты/мелкие списки (переполнение < threshold).
//- ignoreTarget — модалки: их внутренний скролл — не «прокрутка
//- страницы», иначе кнопка всплывала поверх открытой модалки (в админке
//- перекрывала контент: формы товара, групповые операции).
const { isVisible, reset } = useScrollDirection({
  threshold: props.threshold,
  atTop: 'hide',
  follow: 'position',
  ignoreTarget: (el) => el.closest('.modal, dialog[open]') !== null,
})

//- ─── Кольцо прогресса и контекст прокрутки ─────────────────────
//- Свой capture-слушатель (как в useScrollDirection) запоминает,
//- ЧТО прокручивали последним: окно или контейнер. По этой же цели
//- считается прогресс для кольца и выполняется клик «наверх».
const ringLength = 2 * Math.PI * 20 // окружность кольца: 2πr, r = 20
const ringEl = ref(null)
let lastContext = null // Element последнего скролла; null — окно
let raf = 0
let pendingTarget = null

//- Скролл внутри открытой модалки/диалога игнорируем так же, как
//- в видимости (один предикат на оба слушателя).
const insideModal = (el) => el.closest('.modal, dialog[open]') !== null

//- Метрики контекста. Фильтр «мелких» контейнеров тот же, что в
//- видимости: горизонтальные ленты и короткие списки не «страница».
const contextMetrics = (target) => {
  if (!target || target === document || target === window) {
    const doc = document.documentElement
    return {
      top: window.scrollY || doc.scrollTop || 0,
      room: doc.scrollHeight - doc.clientHeight,
    }
  }
  const room = target.scrollHeight - target.clientHeight
  if (room < Math.max(props.threshold, 4)) return null
  return { top: target.scrollTop, room }
}

const applyProgress = () => {
  raf = 0
  const metrics = contextMetrics(pendingTarget)
  if (!metrics) return
  lastContext = pendingTarget instanceof Element ? pendingTarget : null
  const progress = scrollProgressOf(metrics) ?? 0
  if (ringEl.value) {
    ringEl.value.style.strokeDashoffset = String(ringLength * (1 - progress))
  }
}

const onScroll = (event) => {
  const target = event?.target
  if (target instanceof Element && insideModal(target)) return
  pendingTarget = target
  if (!raf) raf = requestAnimationFrame(applyProgress)
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true, capture: true })
  // Страница может открыться уже прокрученной (восстановление позиции,
  // якорь) — scroll-события не будет, кольцо считаем сразу по окну.
  pendingTarget = window
  applyProgress()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll, { capture: true })
  if (raf) cancelAnimationFrame(raf)
})

//- ─── Смена маршрута: контекст прошлой страницы умер ─────────────
//- Кнопка живёт в layout и переживает навигацию. На главной каталог
//- прокручивается внутренним контейнером (.products-container): окно
//- остаётся на нуле, и при переходе на карточку товара scroll-событие
//- может не прийти вовсе — Chrome стреляет scroll-reset при отцеплении
//- прокрученного контейнера, Safari/Firefox не обязаны (баг: «открыл
//- товар — кнопка наверх осталась»). Сбрасываем видимость в стартовое
//- состояние (atTop) и пересчитываем кольцо по окну. Если router
//- восстановил прокрутку страницы (кнопка «назад»), его scrollTo
//- выстрелит событием, и кнопка вернётся сама. Слушаем path, а не
//- fullPath: смена ?search=… на той же главной — тот же контейнер
//- скролла, кнопка должна продолжать отражать его состояние.
watch(
  () => route.path,
  () => {
    reset()
    pendingTarget = window
    lastContext = null
    applyProgress()
  },
)

const scrollToTop = () => {
  const behavior =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth'

  // Скроллим контекст, который пользователь прокручивал (таблица
  // админки, каталог), плюс окно, если прокручена и страница. Прежний
  // «наверх для всего» (querySelectorAll('*')) сбрасывал и горизонтальные
  // ленты — галерея товара прыгала к первому фото.
  if (lastContext instanceof Element) {
    lastContext.scrollTo({ top: 0, behavior })
  }
  if (window.scrollY > 0) {
    window.scrollTo({ top: 0, behavior })
  }
}
</script>

<style scoped>
.scroll-to-top-btn {
  position: fixed;
  right: 20px;
  /* 24px: MessengerFab отключён (default.vue) — прежний 76px оставлял
     кнопку висеть над пустым местом (след удалённой кнопки мессенджеров) */
  bottom: 24px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  z-index: 30; /* карта z-index (main.css): «плавающие кнопки» —
  под шапкой/тостами/модалками, а не 9999 поверх всего */
  padding: 0;
  margin: 0;
  touch-action: manipulation;

  /* Объёмное стекло: полупрозрачная подложка темы (в среднем ~45%,
     текст под кнопкой просвечивает наполовину), свет идёт сверху слева —
     диагональный градиент + спекулярный блик (::before) + внутренние
     блики-кромки и полутени в box-shadow. Токены daisyUI задают цвет
     поверхности; белые/чёрные альфы в бликах/тенях — физика стекла,
     одинаково работает в corporate и business. */
  background: linear-gradient(
    155deg,
    color-mix(in oklab, var(--color-base-100) 52%, transparent) 0%,
    color-mix(in oklab, var(--color-base-100) 36%, transparent) 50%,
    color-mix(in oklab, var(--color-base-100) 44%, transparent) 100%
  );
  color: color-mix(in oklab, var(--color-base-content) 85%, transparent);
  border: 1px solid color-mix(in oklab, var(--color-base-content) 18%, transparent);
  /* blur 3px — стекло ощущается, но текст под кнопкой остаётся
     наполовину читаем (жёстче blur «съедал» текст в кашу) */
  -webkit-backdrop-filter: blur(3px) saturate(1.1);
  backdrop-filter: blur(3px) saturate(1.1);
  box-shadow:
    0 6px 20px color-mix(in oklab, var(--color-base-content) 16%, transparent),
    0 2px 5px color-mix(in oklab, var(--color-base-content) 12%, transparent),
    /* блик: светлые кромки сверху и слева */
    inset 0 1px 0 rgb(255 255 255 / 0.4),
    inset 1px 0 0 rgb(255 255 255 / 0.16),
    /* полутень: нижняя внутренняя кромка уходит в тень */
    inset 0 -2px 5px rgb(0 0 0 / 0.12),
    inset 0 -1px 0 rgb(0 0 0 / 0.08);

  /* стартовое состояние — невидимо и сдвинуто */
  opacity: 0;
  transform: translateY(16px) scale(0.9);
  pointer-events: none;

  transition:
    opacity 0.25s ease,
    transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94),
    color 0.15s ease,
    box-shadow 0.15s ease;
}

/* Спекулярный блик — глянцевое пятно света сверху слева; лежит
   ПОД кольцом прогресса и иконкой (::before — первый в отрисовке) */
.scroll-to-top-btn::before {
  content: '';
  position: absolute;
  inset: 2px;
  border-radius: 50%;
  background: radial-gradient(
    110% 80% at 30% 16%,
    rgb(255 255 255 / 0.32) 0%,
    rgb(255 255 255 / 0.07) 42%,
    transparent 65%
  );
  pointer-events: none;
}

.scroll-to-top-btn.is-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.scroll-to-top-btn:hover {
  background: linear-gradient(
    155deg,
    color-mix(in oklab, var(--color-base-100) 70%, transparent) 0%,
    color-mix(in oklab, var(--color-base-100) 52%, transparent) 50%,
    color-mix(in oklab, var(--color-base-100) 62%, transparent) 100%
  );
  color: var(--color-base-content);
  transform: translateY(-2px);
  box-shadow:
    0 8px 24px color-mix(in oklab, var(--color-base-content) 20%, transparent),
    0 3px 7px color-mix(in oklab, var(--color-base-content) 14%, transparent),
    inset 0 1px 0 rgb(255 255 255 / 0.5),
    inset 1px 0 0 rgb(255 255 255 / 0.2),
    inset 0 -2px 5px rgb(0 0 0 / 0.12),
    inset 0 -1px 0 rgb(0 0 0 / 0.08);
}

.scroll-to-top-btn:active {
  /* «Нажалось»: тень под кнопкой сжимается, внутренняя полутень
     переворачивается вниз-вверх — стекло утоплено */
  transform: translateY(0) scale(0.94);
  box-shadow:
    0 2px 8px color-mix(in oklab, var(--color-base-content) 14%, transparent),
    inset 0 2px 6px rgb(0 0 0 / 0.16),
    inset 0 1px 0 rgb(255 255 255 / 0.2),
    inset 0 -1px 0 rgb(255 255 255 / 0.25);
}

.scroll-to-top-btn:focus {
  outline: none;
}

.scroll-to-top-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}

/* Кольцо прогресса по границе кнопки; поворот — старт сверху */
.progress-ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
  pointer-events: none;
}

.progress-ring circle {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 3;
  stroke-linecap: round;
}

.scroll-icon {
  position: relative;
}

/* Адаптив */
@media (max-width: 767.98px) {
  .scroll-to-top-btn {
    right: 16px;
    /* Над нижней навигацией (var ставит main.css); на карточке товара
       — ещё и над CTA «В корзину» (--scrolltop-bottom больше) */
    bottom: var(--scrolltop-bottom, 72px);
  }
}

@media (min-width: 1440px) {
  .scroll-to-top-btn {
    right: 32px;
    bottom: 96px;
    width: 60px;
    height: 60px;
  }
}

/* Уважаем настройки ОС */
@media (prefers-reduced-motion: reduce) {
  .scroll-to-top-btn {
    transition-duration: 0.01ms;
  }
  .scroll-to-top-btn:hover,
  .scroll-to-top-btn:active {
    transform: none;
  }
}
</style>
