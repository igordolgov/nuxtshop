// Тесты server/lib/bulkHelpers.ts — массовые операции:
// нормализация списка id, разбор патча, применение обновления/удаления.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Мок KV (bulkHelpers импортирует productHelpers → storage) ──────
vi.mock('../../server/lib/storage', () => ({
  kvGetJSON: vi.fn(async () => null),
  kvPutJSON: vi.fn(async () => {}),
  kvDelete: vi.fn(async () => {}),
}));

import {
  applyBulkDelete,
  applyBulkPatch,
  normalizeIdList,
  parseBulkPatch,
} from '../../server/lib/bulkHelpers';
import type { Product } from '../../server/lib/productHelpers';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: '1',
    slug: 'tovar',
    name: 'Товар',
    description: '',
    price: 100,
    image: '/images/a.png',
    gallery: [],
    categories: ['посуда'],
    inStock: true,
    stockQuantity: 3,
    characteristics: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

let catalog: Product[];

beforeEach(() => {
  catalog = [
    makeProduct({ id: '1', name: 'Кружка', categories: ['посуда'], stockQuantity: 3 }),
    makeProduct({ id: '2', name: 'Кастрюля', categories: ['посуда', 'кухня'], stockQuantity: 0, inStock: false }),
    makeProduct({ id: '3', name: 'Носки', categories: ['одежда'], stockQuantity: 10 }),
  ];
});

describe('normalizeIdList — список id из тела запроса', () => {
  it('трим, дедуп, пустые и мусорные элементы отбрасываются', () => {
    expect(normalizeIdList([' 1 ', '1', 2, null, undefined, '', '  '])).toEqual(['1', '2']);
  });

  it('не массив (в т.ч. undefined) — null: эндпоинт ответит 400', () => {
    expect(normalizeIdList('1,2')).toBeNull();
    expect(normalizeIdList({ id: '1' })).toBeNull();
    expect(normalizeIdList(undefined)).toBeNull();
  });

  it('пустой массив — пустой список (не null): ids пришли, но не выбрано ничего', () => {
    expect(normalizeIdList([])).toEqual([]);
  });
});

describe('parseBulkPatch — валидация тела запроса', () => {
  it('пустое тело: нет изменений, quantity = null', () => {
    const patch = parseBulkPatch({});
    expect(patch.hasChanges).toBe(false);
    expect(patch.stockQuantity).toBeNull();
    expect(patch.inStock).toBeUndefined();
  });

  it('inStock строго boolean: строки и числа отклоняются', () => {
    expect(() => parseBulkPatch({ inStock: 'true' })).toThrow(/inStock/);
    expect(() => parseBulkPatch({ inStock: 1 })).toThrow(/inStock/);
    expect(parseBulkPatch({ inStock: false }).inStock).toBe(false);
  });

  it('stockQuantity — только вместе с inStock: true', () => {
    expect(() => parseBulkPatch({ stockQuantity: 5 })).toThrow(/В наличии/);
    expect(() => parseBulkPatch({ inStock: false, stockQuantity: 5 })).toThrow(/В наличии/);
    expect(parseBulkPatch({ inStock: true, stockQuantity: 5 }).stockQuantity).toBe(5);
  });

  it('stockQuantity: числовая строка превращается в целое, мусор и отрицательные — 400', () => {
    expect(parseBulkPatch({ inStock: true, stockQuantity: '7' }).stockQuantity).toBe(7);
    expect(parseBulkPatch({ inStock: true, stockQuantity: 2.9 }).stockQuantity).toBe(2);
    expect(() => parseBulkPatch({ inStock: true, stockQuantity: 'abc' })).toThrow(/неотрицательным/);
    expect(() => parseBulkPatch({ inStock: true, stockQuantity: -1 })).toThrow(/неотрицательным/);
  });

  it('setCategories — CSV и массивы, пустая замена отклоняется как в PUT', () => {
    expect(parseBulkPatch({ setCategories: 'A, B' }).setCategories).toEqual(['A', 'B']);
    expect(() => parseBulkPatch({ setCategories: [] })).toThrow(/хотя бы одну/);
    expect(() => parseBulkPatch({ setCategories: '' })).toThrow(/хотя бы одну/);
  });

  it('addCategories/removeCategories — пустой список допустим как no-op', () => {
    const add = parseBulkPatch({ addCategories: [] });
    expect(add.addCategories).toEqual([]);
    expect(add.hasChanges).toBe(false);

    const remove = parseBulkPatch({ removeCategories: [] });
    expect(remove.removeCategories).toEqual([]);
    expect(remove.hasChanges).toBe(false);
  });

  it('два режима категорий одновременно отклоняются даже с пустыми списками', () => {
    expect(() => parseBulkPatch({ setCategories: ['A'], addCategories: ['B'] })).toThrow(/один режим/);
    expect(() => parseBulkPatch({ addCategories: ['B'], removeCategories: ['C'] })).toThrow(/один режим/);
    expect(() => parseBulkPatch({ addCategories: [], removeCategories: [] })).toThrow(/один режим/);
  });

  it('hasChanges — true, если есть хоть одно поле изменения', () => {
    expect(parseBulkPatch({ inStock: true }).hasChanges).toBe(true);
    expect(parseBulkPatch({ inStock: true, stockQuantity: null }).hasChanges).toBe(true);
    expect(parseBulkPatch({ removeCategories: 'A' }).hasChanges).toBe(true);
    expect(parseBulkPatch({ setCategories: 'A' }).hasChanges).toBe(true);
  });
});

describe('applyBulkPatch — наличие и количество', () => {
  it('в наличие без количества: 0 → 1; уже в наличии — без изменений (не в updated)', () => {
    const { updated } = applyBulkPatch(catalog, ['1', '2'], { inStock: true, stockQuantity: null, hasChanges: true });
    const byId = new Map(updated.map((p) => [p.id, p]));
    // Кружка уже в наличии с количеством 3 — фактических изменений нет
    expect(byId.has('1')).toBe(false);
    // Кастрюля была с нулём — проставлено 1
    expect(byId.get('2')).toMatchObject({ stockQuantity: 1, inStock: true });
  });

  it('в наличие с явным количеством проставляется всем выбранным', () => {
    const { updated } = applyBulkPatch(catalog, ['1', '2'], { inStock: true, stockQuantity: 7, hasChanges: true });
    expect(updated.every((p) => p.stockQuantity === 7 && p.inStock)).toBe(true);
  });

  it('не в наличии: количество обнуляется', () => {
    const { updated } = applyBulkPatch(catalog, ['3'], { inStock: false, hasChanges: true });
    expect(updated[0]).toMatchObject({ id: '3', stockQuantity: 0, inStock: false });
  });

  it('значения совпали с текущими — товар не попадает в updated', () => {
    // Товар 1 уже в наличии с количеством 3
    const { updated } = applyBulkPatch(catalog, ['1'], { inStock: true, stockQuantity: 3, hasChanges: true });
    expect(updated).toHaveLength(0);
  });
});

describe('applyBulkPatch — категории', () => {
  it('setCategories заменяет список целиком', () => {
    const { updated } = applyBulkPatch(catalog, ['1'], { setCategories: ['новинки'], hasChanges: true });
    expect(updated[0].categories).toEqual(['новинки']);
  });

  it('addCategories добавляет без дублей, порядок сохраняется', () => {
    const { updated } = applyBulkPatch(catalog, ['2'], { addCategories: ['кухня', 'новинки'], hasChanges: true });
    expect(updated[0].categories).toEqual(['посуда', 'кухня', 'новинки']);
  });

  it('removeCategories убирает перечисленные', () => {
    const { updated } = applyBulkPatch(catalog, ['2'], { removeCategories: ['посуда'], hasChanges: true });
    expect(updated[0].categories).toEqual(['кухня']);
  });

  it('уборка до нуля категорий: товар в skipped, категории не тронуты, наличие применено', () => {
    const { updated, skipped } = applyBulkPatch(
      catalog,
      ['1', '2'],
      { inStock: false, removeCategories: ['посуда'], hasChanges: true },
    );
    expect(skipped.map((s) => s.id)).toEqual(['1']); // у Кружки одна категория «посуда»
    const byId = new Map(updated.map((p) => [p.id, p]));
    // Кружка: категории прежние, но «не в наличии» применено
    expect(byId.get('1')).toMatchObject({ categories: ['посуда'], inStock: false, stockQuantity: 0 });
    // Кастрюля: осталась «кухня», убрана «посуда»
    expect(byId.get('2')).toMatchObject({ categories: ['кухня'], inStock: false });
  });

  it('неизменённые категории — товар не попадает в updated', () => {
    const { updated } = applyBulkPatch(catalog, ['2'], { addCategories: ['посуда'], hasChanges: true });
    expect(updated).toHaveLength(0);
  });
});

describe('applyBulkPatch — выборка и общие инварианты', () => {
  it('неизвестные id игнорируются, невыбранные товары не меняются', () => {
    const { updated } = applyBulkPatch(catalog, ['999'], { inStock: false, hasChanges: true });
    expect(updated).toHaveLength(0);
    expect(catalog.map((p) => p.inStock)).toEqual([true, false, true]); // вход не мутирован
  });

  it('обновлённые товары — новые объекты со свежим updatedAt, исходный массив цел', () => {
    const before = catalog.map((p) => p.updatedAt);
    const { updated } = applyBulkPatch(catalog, ['1'], { inStock: false, hasChanges: true });
    expect(updated).toHaveLength(1);
    expect(updated[0].updatedAt).not.toBe(before[0]);
    expect(updated[0]).not.toBe(catalog[0]);
    expect(catalog[0].updatedAt).toBe(before[0]);
  });

  it('дубликаты в ids не приводят к двойной обработке', () => {
    const { updated } = applyBulkPatch(catalog, ['1', '1', '1'], { inStock: false, hasChanges: true });
    expect(updated).toHaveLength(1);
  });
});

describe('applyBulkDelete', () => {
  it('делит каталог на удалённые и оставшиеся, вход не мутируется', () => {
    const { remaining, deleted } = applyBulkDelete(catalog, ['2', '999']);
    expect(deleted.map((p) => p.id)).toEqual(['2']);
    expect(remaining.map((p) => p.id)).toEqual(['1', '3']);
    expect(catalog).toHaveLength(3);
  });

  it('пустой список — ничего не удалено', () => {
    const { remaining, deleted } = applyBulkDelete(catalog, []);
    expect(deleted).toHaveLength(0);
    expect(remaining).toEqual(catalog);
  });
});
