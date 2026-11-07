// Тесты localizedCategorySuggestions: подсказки пикера категорий в админке
// на вкладках en/es показываются в языке вкладки (перевод по карте
// buildCategoryLabelMap), непереведённые значения остаются сырыми.
import { describe, expect, it } from 'vitest';

import { localizedCategorySuggestions } from '../../app/utils/categorySuggestions';

const RAW = ['Электроника', 'Смартфоны', 'Одежда'];

const MAP_ES = new Map([
  ['Электроника', 'Electrónica'],
  ['Смартфоны', 'Smartphones'],
  ['Одежда', 'Ropa'],
]);

describe('localizedCategorySuggestions', () => {
  it('нет карты (вкладка ru) — сырые значения как есть', () => {
    expect(localizedCategorySuggestions(RAW, null)).toEqual(RAW);
    expect(localizedCategorySuggestions(RAW, undefined)).toEqual(RAW);
    expect(localizedCategorySuggestions(RAW, new Map())).toEqual(RAW);
  });

  it('полная карта — все значения переведены', () => {
    expect(localizedCategorySuggestions(RAW, MAP_ES)).toEqual([
      'Electrónica',
      'Smartphones',
      'Ropa',
    ]);
  });

  it('частичная карта — непереведённое остаётся сырым (фолбэк витрины)', () => {
    const partial = new Map([['Смартфоны', 'Smartphones']]);
    expect(localizedCategorySuggestions(RAW, partial)).toEqual([
      'Электроника',
      'Smartphones',
      'Одежда',
    ]);
  });

  it('коллизия переводов не дублирует строки', () => {
    const colliding = new Map([
      ['Электроника', 'Tech'],
      ['Смартфоны', 'Tech'],
    ]);
    expect(localizedCategorySuggestions(['Электроника', 'Смартфоны'], colliding)).toEqual(['Tech']);
  });

  it('входной массив не мутируется', () => {
    const copy = [...RAW];
    localizedCategorySuggestions(RAW, MAP_ES);
    expect(RAW).toEqual(copy);
  });

  it('пустой справочник — пустой результат', () => {
    expect(localizedCategorySuggestions([], MAP_ES)).toEqual([]);
  });
});
