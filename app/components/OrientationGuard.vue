<template lang="pug">
//- Блокиратор горизонтального режима на телефонах в браузере (для
//- установленного PWA ориентацию уже фиксирует манифест — portrait-primary).
//- Виден ТОЛЬКО по media-query «телефон лежит набок»: JS и состояние не
//- нужны, SSR/гидратацию не затрагивает. Десктоп и планшет не задевает:
//- pointer: coarse отсекает мышь, max-height: 500px — высокие экраны.
.orientation-guard
  .guard-card
    Icon.guard-icon(name="mdi:phone-rotate-portrait" size="56")
    p.guard-title Поверните телефон вертикально
    p.guard-text Сайт работает только в портретном режиме
</template>

<style scoped>
/* По умолчанию (портрет, десктоп, планшет) блокиратора не существует */
.orientation-guard {
  display: none;
}

@media (orientation: landscape) and (max-height: 500px) and (pointer: coarse) {
  .orientation-guard {
    position: fixed;
    inset: 0;
    z-index: 9999; /* поверх навигации (z-40), модалок и офлайн-баннера (z-100) */
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--color-base-100); /* полностью прячет перевёрнутый сайт */
    overscroll-behavior: contain;
    touch-action: none;
    user-select: none;
  }

  .guard-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
    color: var(--color-base-content);
  }

  .guard-icon {
    color: var(--color-primary);
    /* Покачивание «портрет ↔ ландшафт»: подсказывает нужное действие */
    animation: guard-rotate 2.4s ease-in-out infinite;
  }

  .guard-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
  }

  .guard-text {
    margin: 0;
    font-size: 0.95rem;
    opacity: 0.7;
  }
}

@keyframes guard-rotate {
  0%,
  15% {
    transform: rotate(0deg);
  }
  45%,
  60% {
    transform: rotate(90deg);
  }
  90%,
  100% {
    transform: rotate(0deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .orientation-guard .guard-icon {
    animation: none;
  }
}
</style>
