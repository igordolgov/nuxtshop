// app/utils/compareFly.ts
// ============================================
// Полёт «синей точки» в бургер-меню при добавлении товара в сравнение.
//
// Фидбек владельца: при выборе товара для сравнения не видно, что он
// куда-то попал (тост не связан с меню). Схема:
//   1) карточка товара диспатчит window-событие COMPARE_FLY_EVENT
//      с координатами нажатой кнопки;
//   2) Header ловит его, рисует фиксированную точку и анимирует её
//      (Web Animations API, лёгкая дуга) к первому ВИДИМОМУ приёмнику
//      [data-fly-compare]:
//        мобайл  — бургер-кнопка в шапке (десктопная «Сравнение» скрыта);
//        десктоп — ссылка «Сравнение» в меню шапки (бургер скрыт lg:hidden);
//   3) точка исчезает у цели, бейдж-счётчик на приёмнике мигает ~1.5 с.
//
// Здесь только чистые, тестируемые хелперы; сама анимация — в Header.vue
// (точка создаётся императивно, поэтому её стили инлайновые, а не scoped).
// ============================================

/** Имя window-события «товар добавлен в сравнение — лети в меню» */
export const COMPARE_FLY_EVENT = 'shop:compare-fly';

/** detail window-события: точка клика или прямоугольник кнопки-источника */
export interface CompareFlyDetail {
  x?: number;
  y?: number;
  rect?: { left: number; top: number; width: number; height: number } | null;
}

/**
 * Точка старта полёта (чистая).
 * Приоритет: клик (detail.x, detail.y) → центр кнопки (detail.rect) →
 * низ экрана (viewport) → (0, 0).
 */
export const getFlyOrigin = (
  rawDetail: CompareFlyDetail | null | undefined = {},
  viewport: { width: number; height: number } | null = null,
): { x: number; y: number } => {
  const detail = rawDetail || {};
  if (Number.isFinite(detail.x) && Number.isFinite(detail.y)) {
    return { x: detail.x, y: detail.y };
  }
  const r = detail.rect;
  if (
    r &&
    Number.isFinite(r.left) &&
    Number.isFinite(r.top) &&
    Number.isFinite(r.width) &&
    Number.isFinite(r.height)
  ) {
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  if (viewport && Number.isFinite(viewport.width) && Number.isFinite(viewport.height)) {
    return { x: viewport.width / 2, y: viewport.height - 24 };
  }
  return { x: 0, y: 0 };
};

/**
 * Приёмник точки (чистая): первый элемент с клиентскими прямоугольниками.
 * display:none (бургер на десктопе, «Сравнение» на мобиле) даёт пустой
 * getClientRects() — такой кандидат пропускается.
 */
export const resolveFlyTarget = (
  elements: Array<Element | null | undefined> | null | undefined,
): Element | null => {
  for (const el of elements || []) {
    if (el && typeof el.getClientRects === 'function' && el.getClientRects().length > 0) {
      return el;
    }
  }
  return null;
};

/** Центр элемента в координатах вьюпорта, null если элемента нет. */
export const elementCenter = (el?: Element | null): { x: number; y: number } | null => {
  const r = el?.getBoundingClientRect?.();
  if (!r || !Number.isFinite(r.left) || !Number.isFinite(r.width)) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/**
 * Диспатч из карточки каталога / страницы товара (только клиент).
 * sourceEl — нажатая кнопка: её прямоугольник станет точкой старта.
 */
export const emitCompareFly = (sourceEl?: Element | null): void => {
  if (typeof window === 'undefined' || typeof window.CustomEvent !== 'function') return;
  const rect = sourceEl?.getBoundingClientRect?.();
  const detail: CompareFlyDetail = rect
    ? { rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } }
    : {};
  window.dispatchEvent(new CustomEvent(COMPARE_FLY_EVENT, { detail }));
};
