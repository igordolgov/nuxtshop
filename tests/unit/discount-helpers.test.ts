// tests/unit/discount-helpers.test.ts
// Скидки витрины: hasDiscount / discountPercent (app/utils/productDiscount).
import { describe, expect, it } from 'vitest';
import { discountPercent, hasDiscount } from '../../app/utils/productDiscount';

describe('hasDiscount', () => {
  it('true только когда oldPrice — конечное число строго больше price', () => {
    expect(hasDiscount({ price: 79990, oldPrice: 106990 })).toBe(true);
    // равные цены — скидки нет
    expect(hasDiscount({ price: 100, oldPrice: 100 })).toBe(false);
    // oldPrice ниже цены — некорректные данные, не показываем
    expect(hasDiscount({ price: 100, oldPrice: 50 })).toBe(false);
    // oldPrice = 0 и отрицательная — мусор, не показываем
    expect(hasDiscount({ price: 100, oldPrice: 0 })).toBe(false);
    expect(hasDiscount({ price: 100, oldPrice: -5 })).toBe(false);
  });

  it('бесконечность/NaN/не-числа — не скидка', () => {
    expect(hasDiscount({ price: 100, oldPrice: Number.NaN })).toBe(false);
    expect(hasDiscount({ price: 100, oldPrice: Number.POSITIVE_INFINITY })).toBe(false);
    expect(hasDiscount({ price: 100, oldPrice: '200' as unknown as number })).toBe(false);
    expect(hasDiscount({ price: Number.NaN, oldPrice: 200 })).toBe(false);
  });

  it('пустые/частичные товары безопасны', () => {
    expect(hasDiscount(null)).toBe(false);
    expect(hasDiscount(undefined)).toBe(false);
    expect(hasDiscount({})).toBe(false);
    expect(hasDiscount({ price: null, oldPrice: 200 })).toBe(false);
    expect(hasDiscount({ price: 100, oldPrice: null })).toBe(false);
  });
});

describe('discountPercent', () => {
  it('округляет до целых процентов', () => {
    // 79 990 из 106 990 → 25.24% → 25
    expect(discountPercent({ price: 79990, oldPrice: 106990 })).toBe(25);
    // 79 990 из 99 990 → 20.0% → 20
    expect(discountPercent({ price: 79990, oldPrice: 99990 })).toBe(20);
    // 149 990 из 199 990 → 24.99% → 25
    expect(discountPercent({ price: 149990, oldPrice: 199990 })).toBe(25);
  });

  it('без скидки — 0, а не деление на ноль', () => {
    expect(discountPercent({ price: 100, oldPrice: 100 })).toBe(0);
    expect(discountPercent({ price: 100, oldPrice: 50 })).toBe(0);
    expect(discountPercent(null)).toBe(0);
    expect(discountPercent(undefined)).toBe(0);
    expect(discountPercent({})).toBe(0);
  });
});
