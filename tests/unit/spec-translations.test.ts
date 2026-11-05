// Тесты предзаполнения переводных spec-листов (вкладки EN/ES редактора
// характеристик): app/utils/specTranslations.ts — чистые функции без Vue.
import { describe, expect, it } from 'vitest';

import { mergeSpecRows, toSpecPairs } from '../../app/utils/specTranslations';

describe('toSpecPairs', () => {
  it('Record → массив пар в порядке вставки', () => {
    expect(toSpecPairs({ Экран: 'AMOLED', Вес: '200 г' })).toEqual([
      { label: 'Экран', value: 'AMOLED' },
      { label: 'Вес', value: '200 г' },
    ]);
  });

  it('null/undefined/не-объект — пустой список', () => {
    expect(toSpecPairs(null)).toEqual([]);
    expect(toSpecPairs(undefined)).toEqual([]);
    expect(toSpecPairs('мусор' as unknown as Record<string, unknown>)).toEqual([]);
  });
});

describe('mergeSpecRows: предзаполнение переводного списка', () => {
  const ru = [
    { label: 'Экран', value: 'AMOLED' },
    { label: 'Вес', value: '200 г' },
    { label: 'Цвет', value: 'Чёрный' },
  ];

  it('перевода нет — полный русский список (предзаполнение)', () => {
    expect(mergeSpecRows([], ru)).toEqual(ru);
  });

  it('сохранённый перевод приоритетнее по позициям, остальное — русский', () => {
    const saved = [{ label: 'Screen', value: 'AMOLED' }];
    expect(mergeSpecRows(saved, ru)).toEqual([
      { label: 'Screen', value: 'AMOLED' },
      { label: 'Вес', value: '200 г' },
      { label: 'Цвет', value: 'Чёрный' },
    ]);
  });

  it('русский список вырос после перевода — новые строки предзаполняются', () => {
    const saved = [
      { label: 'Screen', value: 'AMOLED' },
      { label: 'Weight', value: '200 g' },
      { label: 'Color', value: 'Black' },
    ];
    const grown = [...ru, { label: 'Гарантия', value: '12 мес' }];
    expect(mergeSpecRows(saved, grown)).toEqual([
      { label: 'Screen', value: 'AMOLED' },
      { label: 'Weight', value: '200 g' },
      { label: 'Color', value: 'Black' },
      { label: 'Гарантия', value: '12 мес' },
    ]);
  });

  it('строки, добавленные админом прямо в переводе, не теряются', () => {
    const saved = [...ru, { label: 'Warranty', value: '12 months' }];
    expect(mergeSpecRows(saved, ru)).toEqual(saved);
  });

  it('сократившийся русский список: хвост перевода остаётся (правит админ)', () => {
    const saved = [
      { label: 'Screen', value: 'AMOLED' },
      { label: 'Weight', value: '200 g' },
      { label: 'Color', value: 'Black' },
    ];
    const shrunk = [ru[0], ru[1]];
    expect(mergeSpecRows(saved, shrunk)).toEqual([
      { label: 'Screen', value: 'AMOLED' },
      { label: 'Weight', value: '200 g' },
      { label: 'Color', value: 'Black' },
    ]);
  });

  it('оба списка пусты — пусто', () => {
    expect(mergeSpecRows([], [])).toEqual([]);
  });
});
