// Тесты server/lib/stockAlertHelpers.ts — заявки «сообщить о поступлении»:
// валидация контакта (email/телефон), дедупликация, id.
import { describe, expect, it } from 'vitest';
import {
  hasStockAlert,
  nextStockAlertId,
  normalizeStockAlertInput,
  StockAlertValidationError,
} from '../../server/lib/stockAlertHelpers';
import type { StockAlertItem } from '../../server/lib/stockAlertHelpers';

const alert = (overrides: Partial<StockAlertItem> = {}): StockAlertItem => ({
  id: '1',
  productId: '7',
  productName: 'Кружка',
  contact: 'ivan@example.ru',
  createdAt: '2026-01-01T10:00:00.000Z',
  ...overrides,
});

describe('normalizeStockAlertInput', () => {
  it('валидный email проходит и триммится', () => {
    expect(normalizeStockAlertInput({ productId: '7', contact: '  ivan@example.ru ' })).toEqual({
      productId: '7',
      contact: 'ivan@example.ru',
    });
  });

  it('валидный телефон (≥ 10 цифр, с мусором-разделителями) проходит', () => {
    expect(normalizeStockAlertInput({ productId: '7', contact: '+7 999 123-45-67' })).toEqual({
      productId: '7',
      contact: '+7 999 123-45-67',
    });
  });

  it('productId обязателен', () => {
    expect(() => normalizeStockAlertInput({ productId: '', contact: 'a@b.ru' })).toThrow(
      StockAlertValidationError,
    );
    expect(() => normalizeStockAlertInput({ contact: 'a@b.ru' })).toThrow(
      /Не указан товар/,
    );
  });

  it('контакт обязателен и не длиннее 120', () => {
    expect(() => normalizeStockAlertInput({ productId: '7' })).toThrow(/Укажите email или телефон/);
    expect(() => normalizeStockAlertInput({ productId: '7', contact: 'x'.repeat(121) })).toThrow(
      /Укажите email или телефон/,
    );
  });

  it('битый email — ошибка формата', () => {
    expect(() => normalizeStockAlertInput({ productId: '7', contact: 'мусор@нет' })).toThrow(
      /Неверный формат email/,
    );
    expect(() => normalizeStockAlertInput({ productId: '7', contact: 'a@b@' })).toThrow(
      /Неверный формат email/,
    );
  });

  it('короткие цифры (не телефон) — ошибка', () => {
    expect(() => normalizeStockAlertInput({ productId: '7', contact: '12345' })).toThrow(
      /не короче 10 цифр/,
    );
  });
});

describe('hasStockAlert — дедупликация', () => {
  const alerts = [
    alert({ id: '1', productId: '7', contact: 'Ivan@example.ru' }),
    alert({ id: '2', productId: '7', contact: '+7 999 123-45-67' }),
    alert({ id: '3', productId: '9', contact: 'ivan@example.ru' }),
  ];

  it('email: совпадение без учёта регистра', () => {
    expect(hasStockAlert(alerts, '7', 'ivan@example.ru')).toBe(true);
    expect(hasStockAlert(alerts, '7', 'IVAN@EXAMPLE.RU')).toBe(true);
  });

  it('телефон: 8-ка и 7-ка — один и тот же номер', () => {
    expect(hasStockAlert(alerts, '7', '89991234567')).toBe(true);
    expect(hasStockAlert(alerts, '7', '79991234567')).toBe(true);
    expect(hasStockAlert(alerts, '7', '+7 999 123-45-67')).toBe(true);
  });

  it('другой товар или новый контакт — дубликата нет', () => {
    expect(hasStockAlert(alerts, '9', '89991234567')).toBe(false);
    expect(hasStockAlert(alerts, '7', 'maria@example.ru')).toBe(false);
    expect(hasStockAlert([], '7', 'ivan@example.ru')).toBe(false);
  });
});

describe('nextStockAlertId', () => {
  it('максимум + 1, пустой список — 1', () => {
    expect(nextStockAlertId([alert({ id: '4' }), alert({ id: '12' })])).toBe('13');
    expect(nextStockAlertId([])).toBe('1');
  });
});
