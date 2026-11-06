// Тесты localizedOrderItemName/localizedOrderVariantName: локализация
// снапшота позиции заказа (nameEn/nameEs, variantNameEn/variantNameEs)
// с фолбэком на русские базовые поля — контракт как у localizedProduct.
import { describe, expect, it } from 'vitest';
import {
  localizedOrderItemName,
  localizedOrderVariantName,
} from '../../app/utils/localizedOrderItem';

const item = {
  name: 'Ноутбук Тест',
  nameEn: 'Test Laptop',
  nameEs: 'Laptop de prueba',
  variantName: '1 ТБ',
  variantNameEn: '1TB SSD',
  variantNameEs: '1 TB SSD',
};

describe('localizedOrderItemName', () => {
  it('en/es отдают перевод, ru — базовое поле', () => {
    expect(localizedOrderItemName(item, 'en')).toBe('Test Laptop');
    expect(localizedOrderItemName(item, 'es')).toBe('Laptop de prueba');
    expect(localizedOrderItemName(item, 'ru')).toBe('Ноутбук Тест');
  });

  it('пустой/отсутствующий перевод → фолбэк на русское name', () => {
    expect(localizedOrderItemName({ name: 'Товар' }, 'es')).toBe('Товар');
    expect(localizedOrderItemName({ name: 'Товар', nameEs: '  ' }, 'es')).toBe('Товар');
    expect(localizedOrderItemName({ name: 'Товар' }, 'xx')).toBe('Товар');
  });

  it('null/undefined позиция → пустая строка', () => {
    expect(localizedOrderItemName(null, 'es')).toBe('');
    expect(localizedOrderItemName(undefined, 'en')).toBe('');
  });
});

describe('localizedOrderVariantName', () => {
  it('en/es отдают перевод метки варианта', () => {
    expect(localizedOrderVariantName(item, 'en')).toBe('1TB SSD');
    expect(localizedOrderVariantName(item, 'es')).toBe('1 TB SSD');
    expect(localizedOrderVariantName(item, 'ru')).toBe('1 ТБ');
  });

  it('нет варианта → пустая строка; нет перевода → фолбэк', () => {
    expect(localizedOrderVariantName({ name: 'Т', variantName: null }, 'es')).toBe('');
    expect(localizedOrderVariantName({ name: 'Т', variantName: 'Память' }, 'es')).toBe('Память');
    expect(localizedOrderVariantName({ name: 'Т' }, 'en')).toBe('');
  });
});
