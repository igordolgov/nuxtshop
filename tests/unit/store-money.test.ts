// Тесты store.config.ts — форматирование денег (валюта витрины).
// Форматтер чистый: Intl.NumberFormat + символ/позиция из таблиц валюты.
// NBSP (U+00A0) — разделитель разрядов в ru-RU, не путать с пробелом.
import { describe, expect, it } from 'vitest';

import {
  currencySymbol,
  formatMoney,
  STORE_CURRENCY,
  STORE_PAYMENT_METHODS,
} from '../../store.config';

describe('formatMoney — RUB (₽ после суммы)', () => {
  it('короткое число', () => {
    expect(formatMoney(500, 'RUB')).toBe('500 ₽');
  });

  it('разряды через NBSP (ru-RU)', () => {
    // Intl ru-RU использует NBSP (U+00A0) как разделитель разрядов
    expect(formatMoney(12345, 'RUB')).toBe(`12 345 ₽`);
  });

  it('ноль', () => {
    expect(formatMoney(0, 'RUB')).toBe('0 ₽');
  });
});

describe('formatMoney — USD ($ перед суммой)', () => {
  it('короткое число', () => {
    expect(formatMoney(500, 'USD')).toBe('$500');
  });

  it('разряды через запятую (en-US)', () => {
    expect(formatMoney(1234, 'USD')).toBe('$1,234');
  });

  it('ноль', () => {
    expect(formatMoney(0, 'USD')).toBe('$0');
  });
});

describe('formatMoney — дефолты', () => {
  it('без валюты берётся STORE_CURRENCY', () => {
    expect(formatMoney(500)).toBe(formatMoney(500, STORE_CURRENCY));
    expect(currencySymbol()).toBe(currencySymbol(STORE_CURRENCY));
  });

  it('NaN/null-подобные → 0 с валютой', () => {
    expect(formatMoney(Number.NaN, 'RUB')).toBe('0 ₽');
  });

  it('currencySymbol известных валют', () => {
    expect(currencySymbol('RUB')).toBe('₽');
    expect(currencySymbol('USD')).toBe('$');
  });
});

describe('STORE_PAYMENT_METHODS', () => {
  it('непустой список и все методы валидных идентификаторов', () => {
    expect(STORE_PAYMENT_METHODS.length).toBeGreaterThan(0);
    const ALL = ['card', 'cash', 'transfer'];
    for (const m of STORE_PAYMENT_METHODS) expect(ALL).toContain(m);
  });
});
