<!-- app/components/ScrollToTop.vue -->
<template lang="pug">
button.scroll-to-top-btn(
  v-show="isVisible",
  :class="{ 'is-visible': isVisible }",
  type="button",
  aria-label="Прокрутить к началу",
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
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  threshold: { type: Number, default: 200 },
})

const isVisible = ref(false)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * scroll не всплывает, но capture-фаза проходит через всех предков.
 * Один слушатель на window с capture: true ловит scroll любого элемента.
 */
const onScroll = (event) => {
  const target = event?.target

  let scrollTop = 0
  if (!target || target === document || target === window) {
    scrollTop = window.scrollY || document.documentElement.scrollTop || 0
  } else if (target.scrollTop != null) {
    scrollTop = target.scrollTop
  }

  isVisible.value = scrollTop > props.threshold
}

const scrollToTop = () => {
  const behavior = prefersReducedMotion() ? 'auto' : 'smooth'

  window.scrollTo({ top: 0, behavior })

  document.querySelectorAll('*').forEach((el) => {
    if (el.scrollTop > 0) {
      el.scrollTo({ top: 0, behavior })
    }
  })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, {
    passive: true,
    capture: true,
  })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll, { capture: true })
})
</script>

<style scoped>
.scroll-to-top-btn {
  position: fixed;
  right: 20px;
  bottom: 20px;
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
    /* 92px — над мобильным футером */
    bottom: 92px;
  }
}

@media (min-width: 1440px) {
  .scroll-to-top-btn {
    right: 32px;
    bottom: 32px;
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