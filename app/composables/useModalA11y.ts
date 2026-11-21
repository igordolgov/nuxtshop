// app/composables/useModalA11y.ts
// ── Единая a11y-обвязка модальных диалогов витрины ────────────────────────
//
// ЧТО ДЕЛАЕТ (каждое — опционально, конфигом):
//   Escape закрывает диалог (onClose), Tab не выпускает фокус за пределы
//   контейнера (WCAG 2.4.3), скролл фона заблокирован на всё время
//   открытия, при открытии фокус уходит в диалог (initialFocus или первый
//   фокусируемый), при закрытии возвращается на инициатора.
//
// КОГО ПРИМЕНЯЕМ: news-модалка (pages/news.vue), success-модалка чекаута
// (cart/checkout.vue), зум-фото галереи (ProductGallery — только trap:
// Escape/скролл-лок/фокус она ведёт сама, useImageZoom).
// MobileFiltersPanel не трогаем: свой trap/Escape уже в f7551c7.
//
// КОНТРАКТ: состояние открытия читается через getter-функцию (реактивные
// ref'ы читаются внутри watch — SSR-safe, на сервере тело не выполняется).
// Скролл-лок считает ВКЛАДКИ (несколько открытых модалек не снимают
// лок друг у друга); при размонтировании открытой модалки лок и фокус
// восстанавливаются принудительно.

interface UseModalA11yOptions {
  /** Открыта ли модалка (getter, читает ref'ы вызывающего). */
  isOpen: () => boolean;
  /** Корень диалога — внутри него ищутся фокусируемые и держится фокус. */
  container: () => HTMLElement | null;
  /** Если задан — Escape вызывает его (закрывает модалку). */
  onClose?: () => void;
  /** Куда ставить фокус при открытии (по умолчанию первый фокусируемый). */
  initialFocus?: () => HTMLElement | null;
  /** Ставить фокус в диалог при открытии (default true). */
  focusOnOpen?: boolean;
  /** Возвращать фокус на инициатора при закрытии (default true). */
  restoreFocus?: boolean;
  /** Ловить Tab внутри контейнера (default true). */
  trapTab?: boolean;
  /** Блокировать скролл body на время открытия (default true). */
  lockScroll?: boolean;
}

/** Видимые фокусируемые элементы: без disabled, без tabindex="-1",
 *  скрытые (display:none/visibility:hidden) не фокусируются. */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ── Счётчик скролл-локов на всё приложение: две открытые модалки —
// лок снимается, только когда закрыты обе (восстановление до '' могло бы
// сняться раньше времени у соседней) ───────────────────────────────────────
let scrollLockCount = 0;

export function useModalA11y(options: UseModalA11yOptions): void {
  const isVisible = (el: HTMLElement): boolean => {
    if (typeof el.checkVisibility === 'function') {
      return el.checkVisibility({ checkVisibilityCSS: true });
    }
    return el.offsetWidth > 0 || el.offsetHeight > 0;
  };

  const focusables = (): HTMLElement[] => {
    const root = options.container();
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isVisible);
  };

  const focusInto = () => {
    const explicit = options.initialFocus?.();
    const target =
      explicit && isVisible(explicit) ? explicit : (focusables()[0] ?? options.container());
    target?.focus?.({ preventScroll: true });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!options.isOpen()) return;

    if (event.key === 'Escape' && options.onClose) {
      event.preventDefault();
      options.onClose();
      return;
    }

    if (event.key === 'Tab' && (options.trapTab ?? true)) {
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const root = options.container();
      const active = document.activeElement;
      if (!root || !(active instanceof HTMLElement) || !root.contains(active)) {
        // Фокус ушёл из диалога (клик по фону, программный blur) — вернуть
        event.preventDefault();
        items[0].focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }
  };

  let prevFocus: HTMLElement | null = null;
  let listening = false;

  const listen = (on: boolean) => {
    if (on === listening) return;
    listening = on;
    if (on) document.addEventListener('keydown', onKeyDown, true);
    else document.removeEventListener('keydown', onKeyDown, true);
  };

  const open = () => {
    if (options.restoreFocus ?? true) {
      prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    if (options.lockScroll ?? true) {
      if (++scrollLockCount === 1) document.body.style.overflow = 'hidden';
    }
    listen(Boolean(options.onClose) || (options.trapTab ?? true));
    if (options.focusOnOpen ?? true) nextTick(focusInto);
  };

  const close = () => {
    listen(false);
    if (options.lockScroll ?? true) {
      if (scrollLockCount > 0 && --scrollLockCount === 0) {
        document.body.style.overflow = '';
      }
    }
    if (options.restoreFocus ?? true) {
      prevFocus?.focus?.({ preventScroll: true });
      prevFocus = null;
    }
  };

  watch(
    () => options.isOpen(),
    (isOpen) => {
      if (!import.meta.client) return;
      if (isOpen) open();
      else close();
    },
  );

  // Размонтирование при открытой модалке (переход на другой роут):
  // снять listener, вернуть скролл и фокус — иначе следующая страница
  // остаётся заблокированной
  onBeforeUnmount(() => {
    if (!import.meta.client) return;
    if (options.isOpen()) close();
    else listen(false);
  });
}
