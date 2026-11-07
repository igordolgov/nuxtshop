<!-- app/components/ScrollToTop.vue -->
<template lang="pug">
button.scroll-to-top-btn(
  v-show="isVisible",
  :class="{ 'is-visible': isVisible }",
  type="button",
  :aria-label="$t('common.scrollToTop')",
  @click="scrollToTop"
)
  svg(
    viewBox="0 0 24 24",
    width="24",
    height="24",
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
const { isVisible } = useScrollDirection({ threshold: props.threshold, atTop: 'hide', follow: 'position' })

const scrollToTop = () => {
  const behavior =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth'

  window.scrollTo({ top: 0, behavior })

  document.querySelectorAll('*').forEach((el) => {
    if (el.scrollTop > 0) {
      el.scrollTo({ top: 0, behavior })
    }
  })
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
  z-index: 9999;
  padding: 0;
  margin: 0;

  /* цвета и тень */
  background: #ffffff;
  color: #1f2937;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.12);

  /* стартовое состояние — невидимо и сдвинуто */
  opacity: 0;
  transform: translateY(16px) scale(0.9);
  pointer-events: none;

  transition:
    opacity 0.25s ease,
    transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94),
    box-shadow 0.15s ease;
}

.scroll-to-top-btn.is-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.scroll-to-top-btn:hover {
  transform: translateY(-2px) scale(1.08);
  box-shadow: 0 6px 16px rgb(0 0 0 / 0.18);
}

.scroll-to-top-btn:active {
  transform: translateY(0) scale(0.95);
}

.scroll-to-top-btn:focus {
  outline: none;
}

.scroll-to-top-btn:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 3px;
}

/* Тёмные темы */
@media (prefers-color-scheme: dark) {
  .scroll-to-top-btn {
    background: #1f2937;
    color: #f9fafb;
    border-color: #374151;
  }
}

:root[data-theme='business'] .scroll-to-top-btn {
  background: #1f2937;
  color: #f9fafb;
  border-color: #374151;
}

:root[data-theme='corporate'] .scroll-to-top-btn {
  background: #ffffff;
  color: #1f2937;
  border-color: #e5e7eb;
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