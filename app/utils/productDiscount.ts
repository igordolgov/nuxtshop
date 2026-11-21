// app/utils/productDiscount.ts
// ── Скидки товара (oldPrice → зачёркнутая цена + бейдж −%) ──────────────
//
// Скидка — витринная пара полей: «цена до скидки» (oldPrice) и текущая
// цена (price). На деньги магазина не влияет: корзина, заказы и склад
// всегда считают от price — скидка уже внутри него (см. Product в
// server/lib/productHelpers.ts). Чистые функции — юнит-тесты без Vue,
// автоИмпорт из app/utils (imports.dirs в nuxt.config.ts).

/** Минимальная форма товара, нужная хелперам скидки. */
export interface DiscountProductLike {
  price?: number | null;
  oldPrice?: number | null;
}

/**
 * Есть ли показываемая скидка: oldPrice — конечное число строго больше
 * конечной price. Ничего не знаем про варианты: у варианта своя цена
 * (variantPrice) — вызывающая сторона решает, показывать ли скидку базы.
 */
export const hasDiscount = (product?: DiscountProductLike | null): boolean => {
  const price = product?.price;
  const oldPrice = product?.oldPrice;
  return (
    typeof price === 'number' &&
    Number.isFinite(price) &&
    typeof oldPrice === 'number' &&
    Number.isFinite(oldPrice) &&
    oldPrice > price
  );
};

/** Величина скидки в целых процентах, 0 — скидки нет: 79 990 при 106 990 → 25. */
export const discountPercent = (product?: DiscountProductLike | null): number => {
  if (
    !hasDiscount(product) ||
    typeof product?.price !== 'number' ||
    typeof product?.oldPrice !== 'number'
  ) {
    return 0;
  }
  return Math.round((1 - product.price / product.oldPrice) * 100);
};

/**
 * '2026-11-30' → '30.11' — компактная дата для плашки «акция до 30.11»
 * (карточка каталога и страница товара; слова локали даёт словарь
 * product.promoUntil). Год не нужен: акции короткие, а «30.11» читается
 * однозначно. Битое/пустое → '' (плашка не рендерится).
 */
export const promoUntilShort = (iso?: string | null): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return '';
  const day = m[3] ?? '';
  const month = m[2] ?? '';
  return `${Number(day)}.${month}`;
};
