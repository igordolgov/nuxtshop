// composables/useScrollDirection.ts
// Видимость «плавающих» элементов (нижняя CTA карточки товара, кнопка
// «наверх») — два режима (follow):
//
//   'direction' — по направлению прокрутки (паттерн WB/Ozon/Amazon):
//     прокрутка ВНИЗ (чтение контента) — элемент уезжает и перестаёт
//     перекрывать карточки; прокрутка ВВЕРХ — возвращается. Режим по
//     умолчанию, нужен нижней CTA товара.
//
//   'position' — классика «кнопки наверх»: видна всегда, когда страница
//     прокручена дальше threshold, в ЛЮБОМ направлении. Предсказуемо для
//     пользователя: крутит каталог вниз — кнопка на месте (жалоба
//     «не всегда появляется при скроллинге вниз» была именно про это).
//
// atTop — что делать у верха страницы (scrollTop <= threshold):
//   'show' — нижняя CTA товара видна у карточки всегда (кнопка покупки);
//   'hide' — кнопка «наверх» у верха страницы не нужна.
//
// Почему capture-слушатель на window: scroll НЕ всплывает, но в
// capture-фазе событие любого скроллящегося элемента приходит на window —
// так ловится и скролл окна, и внутренний скролл каталога
// (.products-container на главной). Фильтры ниже отсекают шум:
//   - горизонтальные ленты (крошки, галерея): scrollHeight == clientHeight;
//   - мелкие внутренние списки: переполнение < max(minOverflow, threshold).
// rAF-троттлинг: scroll стреляет десятки раз за кадр на мобильных.
import { ref, onMounted, onBeforeUnmount } from 'vue';

export type ScrollFollowMode = 'direction' | 'position';

/**
 * Чистое решение о видимости плавающего элемента по паре позиций
 * прокрутки (прошлой и текущей). Вынесено из apply() для юнит-тестов.
 *
 * @returns true/false — целевая видимость; null — «оставить как есть»
 *   (дрожание <= 6 px у направления, первое событие без baseline).
 */
export const decideFloatingVisibility = ({
  follow,
  atTop,
  threshold,
  top,
  baseline,
}: {
  follow: ScrollFollowMode;
  atTop: 'show' | 'hide';
  threshold: number;
  top: number;
  baseline: number | null;
}): boolean | null => {
  // У верха страницы решает atTop, а не направление
  if (top <= threshold) return atTop === 'show';
  // Классика «наверх»: дальше порога видна в любом направлении —
  // и на первом событии, когда прошлой позиции ещё нет
  if (follow === 'position') return true;
  if (baseline == null) return null;
  const delta = top - baseline;
  // Дрожание (инерция тача, микросдвиги трекпада) — не переключаем
  if (delta > 6) return false; // прокрутка вниз — спрятать
  if (delta < -6) return true; // прокрутка вверх — показать
  return null;
};

export interface ScrollDirectionOptions {
  /** Порог «у верха страницы» */
  threshold?: number;
  /** Поведение у верха страницы: показать элемент или скрыть */
  atTop?: 'show' | 'hide';
  /** Минимальное переполнение контейнера, считающееся прокруткой страницы */
  minOverflow?: number;
  /** 'direction' (по умолчанию) — видимость по направлению прокрутки;
   *  'position' — видна всегда дальше threshold (классика «наверх») */
  follow?: ScrollFollowMode;
}

export const useScrollDirection = ({
  threshold = 0,
  atTop = 'show',
  minOverflow = 4,
  follow = 'direction',
}: ScrollDirectionOptions = {}) => {
  // Начальное состояние = поведение «у верха страницы»: CTA товара
  // видна сразу (кнопка покупки), кнопка «наверх» — скрыта до первого
  // скролла. Без этого FAB вспыхивал у шапки до первого события scroll.
  const isVisible = ref(atTop === 'show');
  let lastTop: number | null = null;
  let raf = 0;
  let pendingTop = 0;

  const scrollTopOf = (target?: EventTarget | null): number | null => {
    if (!target || target === document || target === window) {
      return window.scrollY || document.documentElement.scrollTop || 0;
    }
    const el = target as Element;
    if (el.scrollTop == null) return null;
    // отсекаем горизонтальные ленты и мелкие внутренние списки:
    // они не «прокрутка страницы», дёргать элементы из-за них нельзя
    const verticalRoom = el.scrollHeight - el.clientHeight;
    if (verticalRoom < Math.max(minOverflow, threshold)) return null;
    return el.scrollTop;
  };

  const apply = () => {
    raf = 0;
    const baseline = lastTop;
    lastTop = pendingTop;
    const decision = decideFloatingVisibility({
      follow,
      atTop,
      threshold,
      top: pendingTop,
      baseline,
    });
    if (decision != null) isVisible.value = decision;
  };

  const onScroll = (event?: Event) => {
    const top = scrollTopOf(event?.target);
    if (top == null) return;
    pendingTop = top;
    if (!raf) raf = requestAnimationFrame(apply);
  };

  const reset = () => {
    lastTop = null;
    isVisible.value = atTop === 'show';
  };

  onMounted(() => {
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    // Страница может открыться уже прокрученной (браузер восстановил
    // позицию после перезагрузки, переход по якорю) — scroll-события
    // при этом может не быть, и без стартовой проверки в режиме
    // 'position' кнопка оставалась бы скрытой до первого скролла.
    if (follow === 'position') {
      pendingTop = scrollTopOf(window) ?? 0;
      apply();
    }
  });

  onBeforeUnmount(() => {
    window.removeEventListener('scroll', onScroll, { capture: true });
    if (raf) cancelAnimationFrame(raf);
  });

  return { isVisible, reset };
};
