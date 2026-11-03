// composables/useScrollDirection.ts
// Видимость «плавающих» элементов (нижняя CTA карточки товара, кнопка
// «наверх») по направлению прокрутки — паттерн WB/Ozon/Amazon:
// прокрутка ВНИЗ (чтение контента) — элемент уезжает и перестаёт
// перекрывать карточки; прокрутка ВВЕРХ — возвращается.
//
// atTop — что делать у верха страницы (scrollTop <= threshold):
//   'show' — нижняя CTA товара видна у карточки всегда (кнопка покупки);
//   'hide' — кнопка «наверх» у верха страницы не нужна.
//
// Почему capture-слушатель на window (как в ScrollToTop): scroll НЕ
// всплывает, но в capture-фазе событие любого скроллящегося элемента
// приходит на window. Фильтры ниже отсекают шум:
//   - горизонтальные ленты (крошки, галерея): scrollHeight == clientHeight;
//   - мелкие внутренние списки: переполнение < max(minOverflow, threshold).
// rAF-троттлинг: scroll стреляет десятки раз за кадр на мобильных.
import { ref, onMounted, onBeforeUnmount } from 'vue';

export interface ScrollDirectionOptions {
  /** Порог «у верха страницы» */
  threshold?: number;
  /** Поведение у верха страницы: показать элемент или скрыть */
  atTop?: 'show' | 'hide';
  /** Минимальное переполнение контейнера, считающееся прокруткой страницы */
  minOverflow?: number;
}

export const useScrollDirection = ({
  threshold = 0,
  atTop = 'show',
  minOverflow = 4,
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
    if (pendingTop <= threshold) {
      isVisible.value = atTop === 'show';
      return;
    }
    if (baseline == null) return;
    const delta = pendingTop - baseline;
    if (delta > 6) isVisible.value = false;
    else if (delta < -6) isVisible.value = true;
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
  });

  onBeforeUnmount(() => {
    window.removeEventListener('scroll', onScroll, { capture: true });
    if (raf) cancelAnimationFrame(raf);
  });

  return { isVisible, reset };
};
