// app/composables/useHeaderUi.ts
// UI-эффекты шапки (разбивка Header.vue, этап 6): полёт «синей точки»
// сравнения и переключатель темы. Композаблы сами подписываются на
// события в onMounted/onUnmounted (вызываются из setup шапки), видимое
// шаблону состояние возвращают вызывающему.
import { ref, onMounted, onUnmounted } from 'vue';

// ─── Полёт «синей точки» сравнения (см. app/utils/compareFly.ts) ─────────
// Карточки диспатчат COMPARE_FLY_EVENT, точка летит по лёгкой дуге
// к видимому приёмнику [data-fly-compare], исчезает у цели, а бейдж
// на бургере мигает ~1.5 с. prefers-reduced-motion — без полёта.

/** Документ с экспериментальным View Transitions API (Chrome/Safari 18+). */
interface ViewTransitionDocument extends Document {
  startViewTransition?: (callback: () => void | Promise<void>) => unknown;
}

export function useCompareFlyBadge() {
  const burgerBlink = ref(false);
  let burgerBlinkTimer: ReturnType<typeof setTimeout> | null = null;

  const blinkCompareBadge = () => {
    burgerBlink.value = false;
    // перезапуск CSS-анимации: кадр без класса, затем кадр с классом
    requestAnimationFrame(() => {
      burgerBlink.value = true;
    });
    clearTimeout(burgerBlinkTimer!);
    burgerBlinkTimer = setTimeout(() => {
      burgerBlink.value = false;
    }, 1500);
  };

  const flyCompareDot = (origin: { x: number; y: number }, targetEl: Element): void => {
    const target = elementCenter(targetEl);
    if (!target) return;
    const dot = document.createElement('span');
    dot.setAttribute('aria-hidden', 'true');
    // стили инлайном: точка создаётся вне Vue, scoped-стили на неё не действуют
    dot.style.cssText =
      'position:fixed;left:0;top:0;width:14px;height:14px;margin:-7px 0 0 -7px;' +
      'border-radius:9999px;background:var(--color-primary,#007bc7);' +
      'box-shadow:0 2px 12px rgba(0,0,0,.25);z-index:9999;pointer-events:none;' +
      'will-change:transform,opacity;opacity:.95';
    document.body.appendChild(dot);
    if (typeof dot.animate !== 'function') {
      dot.remove();
      return;
    }
    // лёгкая дуга: середина хорды выталкивается перпендикуляром
    const midX = (origin.x + target.x) / 2 + (target.y - origin.y) * 0.15;
    const midY = (origin.y + target.y) / 2 - (target.x - origin.x) * 0.15;
    const animation = dot.animate(
      [
        { transform: `translate(${origin.x}px, ${origin.y}px) scale(1)`, opacity: 1 },
        { transform: `translate(${midX}px, ${midY}px) scale(0.8)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${target.x}px, ${target.y}px) scale(0.35)`, opacity: 0.35 },
      ],
      { duration: 700, easing: 'cubic-bezier(0.32, 0.72, 0.35, 1)' },
    );
    const finish = () => {
      dot.remove();
      blinkCompareBadge();
    };
    animation.onfinish = finish;
    animation.oncancel = () => dot.remove();
  };

  const onCompareFly = (event: Event): void => {
    blinkCompareBadge();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const origin = getFlyOrigin((event as CustomEvent)?.detail, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    const targetEl = resolveFlyTarget(document.querySelectorAll('[data-fly-compare]'));
    if (targetEl) flyCompareDot(origin, targetEl);
  };

  onMounted(() => {
    if (!import.meta.client) return;
    window.addEventListener(COMPARE_FLY_EVENT, onCompareFly);
  });

  onUnmounted(() => {
    if (!import.meta.client) return;
    window.removeEventListener(COMPARE_FLY_EVENT, onCompareFly);
    clearTimeout(burgerBlinkTimer!);
    burgerBlinkTimer = null;
  });

  return { burgerBlink };
}

// ─── Переключатель темы (corporate/business) ─────────────────────────────
// Значение синхронизируется с <html data-theme> (ставится сервером и
// плагином темы); изменения из /settings прилетают событием 'theme-changed'.

export type HeaderTheme = 'corporate' | 'business';

export function useHeaderTheme() {
  const currentTheme = ref<HeaderTheme>('corporate');

  const applyTheme = (theme: HeaderTheme): void => {
    currentTheme.value = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  };

  const toggleTheme = (): void => {
    if (!import.meta.client) return;
    const next: HeaderTheme = currentTheme.value === 'corporate' ? 'business' : 'corporate';
    // View Transitions: мягкий кросс-фейд темы (Chrome/Safari 18+); нет API
    // или включено «уменьшить движение» — мгновенно, как раньше
    const doc = document as ViewTransitionDocument;
    if (
      typeof doc.startViewTransition === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      doc.startViewTransition(() => applyTheme(next));
      return;
    }
    applyTheme(next);
  };

  //- Тема, изменённая вне шапки (страница /settings), синхронизирует переключатель
  const onThemeChanged = (event: Event): void => {
    const theme = (event as CustomEvent<HeaderTheme | undefined>)?.detail;
    if (theme === 'corporate' || theme === 'business') currentTheme.value = theme;
  };

  onMounted(() => {
    if (!import.meta.client) return;
    const applied = document.documentElement.getAttribute('data-theme');
    currentTheme.value = applied === 'business' ? 'business' : 'corporate';
    window.addEventListener('theme-changed', onThemeChanged);
  });

  onUnmounted(() => {
    if (!import.meta.client) return;
    window.removeEventListener('theme-changed', onThemeChanged);
  });

  return { currentTheme, toggleTheme };
}
