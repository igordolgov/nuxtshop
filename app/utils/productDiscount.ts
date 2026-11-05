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
