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
    width="20",
    height="20",
    fill="currentColor",
    aria-hidden="true"
  )
    path(d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z")
</template>

<script setup>
const props = defineProps({
  threshold: { type: Number, default: 200 },
})

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
const { isVisible } = useScrollDirection({
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
  bottom: 76px; /* под кнопкой мессенджеров (MessengerFab, 20+48+8) */
  width: 44px;
  height: 44px;
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

  /* «Матовое стекло»: полупрозрачная подложка темы + размытие.
     Токены daisyUI (base-100/base-content/primary) — сами темы
     corporate/business задают цвета, отдельных правил под темы
     и prefers-color-scheme больше не нужно. */
  background: color-mix(in oklab, var(--color-base-100) 65%, transparent);
  color: color-mix(in oklab, var(--color-base-content) 78%, transparent);
  border: 1px solid color-mix(in oklab, var(--color-base-content) 14%, transparent);
  -webkit-backdrop-filter: blur(10px) saturate(1.3);
  backdrop-filter: blur(10px) saturate(1.3);
  box-shadow: 0 4px 14px color-mix(in oklab, var(--color-base-content) 14%, transparent);

  /* стартовое состояние — невидимо и сдвинуто */
  opacity: 0;
  transform: translateY(16px) scale(0.9);
  pointer-events: none;

  transition:
    opacity 0.25s ease,
    transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94),
    background 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.scroll-to-top-btn.is-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.scroll-to-top-btn:hover {
  background: color-mix(in oklab, var(--color-base-100) 85%, transparent);
  color: var(--color-base-content);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px color-mix(in oklab, var(--color-base-content) 20%, transparent);
}

.scroll-to-top-btn:active {
  transform: translateY(0) scale(0.94);
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
@media (max-width: 768px) {
  .scroll-to-top-btn {
    right: 16px;
    /* 148px — над кнопкой мессенджеров (92px) и мобильным футером */
    bottom: 148px;
  }
}

@media (min-width: 1440px) {
  .scroll-to-top-btn {
    right: 32px;
    bottom: 96px;
    width: 56px;
    height: 56px;
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
