// Тесты «Часто покупают вместе» (Amazon FBT): ко-встречаемость позиций
// в заказах. Файл самодостаточный (свой мок KV и фикстуры) — по образцу
// order-variants.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const kvStore = new Map<string, unknown>();

vi.mock('../../server/lib/storage', () => ({
  kvGetJSON: vi.fn(async (_event: unknown, key: string) => (kvStore.get(key) as unknown) ?? null),
  kvPutJSON: vi.fn(async (_event: unknown, key: string, value: unknown) => {
    kvStore.set(key, structuredClone(value));
  }),
  kvDelete: vi.fn(async (_event: unknown, key: string) => {
    kvStore.delete(key);
  }),
}));

import {
  baseProductId,
  computeBoughtTogether,
  getBoughtTogetherProducts,
} from '../../server/lib/boughtTogetherHelpers';
import type { Order } from '../../server/lib/orderHelpers';
import { readProducts, type Product } from '../../server/lib/productHelpers';

const event = {} as never;

/**
 * Минимальный заказ для чистой функции: computeBoughtTogether трогает
 * только status / items[].id / createdAt. Каст оправдан — остальные
 * поля Order (клиент, суммы, история статусов) функции не нужны.
 */
const order = (id: string, createdAt: string, lineIds: string[], status = 'new') =>
  ({
    id,
    status,
    createdAt,
    items: lineIds.map((lineId) => ({ id: lineId })),
  }) as unknown as Order;

const makeProduct = (id: string, overrides: Partial<Product> = {}): Product => ({
  id,
  slug: `slug-${id}`,
  name: `Товар ${id}`,
  description: 'Описание',
  price: 1000,
  image: `/images/products/p${id}.webp`,
  gallery: [],
  categories: ['cat'],
  inStock: true,
  stockQuantity: 5,
  characteristics: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  kvStore.clear();
});

describe('baseProductId', () => {
  it('простой id проходит как есть', () => {
    expect(baseProductId('42')).toBe('42');
  });

  it('составной id варианта «productId::variantId» → базовый товар', () => {
    expect(baseProductId('42::color-red')).toBe('42');
  });

  it('пустая строка → пустая строка', () => {
    expect(baseProductId('')).toBe('');
  });
});

describe('computeBoughtTogether', () => {
  it('пустой список заказов → пустой результат', () => {
    expect(computeBoughtTogether([], '1')).toEqual([]);
  });

  it('товар не участвует ни в одном заказе → пустой результат', () => {
    const orders = [order('o1', '2026-01-02T00:00:00.000Z', ['2', '3'])];
    expect(computeBoughtTogether(orders, '1')).toEqual([]);
  });

  it('считает совместные заказы, текущий товар в результат не попадает', () => {
    const orders = [
      order('o1', '2026-01-02T00:00:00.000Z', ['1', '2']),
      order('o2', '2026-01-03T00:00:00.000Z', ['1', '2', '3']),
    ];
    const result = computeBoughtTogether(orders, '1');
    expect(result.map((r) => r.productId)).toEqual(['2', '3']);
    expect(result[0]).toMatchObject({ productId: '2', count: 2 });
    expect(result[1]).toMatchObject({ productId: '3', count: 1 });
  });

  it('сортировка: больше совместных заказов — выше', () => {
    const orders = [
      order('o1', '2026-01-02T00:00:00.000Z', ['1', '2']),
      order('o2', '2026-01-03T00:00:00.000Z', ['1', '2']),
      order('o3', '2026-01-04T00:00:00.000Z', ['1', '3']),
    ];
    expect(computeBoughtTogether(orders, '1').map((r) => r.productId)).toEqual(['2', '3']);
  });

  it('тай-брейк по свежести последней совместной покупки', () => {
    const orders = [
      order('o1', '2026-01-02T00:00:00.000Z', ['1', '2']),
      order('o2', '2026-01-05T00:00:00.000Z', ['1', '3']),
    ];
    // оба по 1 совместному заказу; у «3» покупка свежее → первый
    expect(computeBoughtTogether(orders, '1').map((r) => r.productId)).toEqual(['3', '2']);
  });

  it('отменённые заказы не считаются покупкой', () => {
    const orders = [
      order('o1', '2026-01-02T00:00:00.000Z', ['1', '2']),
      order('o2', '2026-01-03T00:00:00.000Z', ['1', '3'], 'cancelled'),
    ];
    expect(computeBoughtTogether(orders, '1').map((r) => r.productId)).toEqual(['2']);
  });

  it('варианты товара схлопываются в базовый id, дубликат позиции = один заказ', () => {
    const orders = [
      // один заказ: два варианта «2» (два цвета) → «2» засчитан ОДИН раз
      order('o1', '2026-01-02T00:00:00.000Z', ['1', '2::color-red', '2::color-blue']),
    ];
    const result = computeBoughtTogether(orders, '1');
    expect(result.map((r) => r.productId)).toEqual(['2']);
    expect(result[0]?.count).toBe(1);
  });

  it('лимит результата', () => {
    const orders = [order('o1', '2026-01-02T00:00:00.000Z', ['1', '2', '3', '4', '5'])];
    expect(computeBoughtTogether(orders, '1', 2)).toHaveLength(2);
  });

  it('заказ без текущего товара не влияет на статистику', () => {
    const orders = [
      order('o1', '2026-01-02T00:00:00.000Z', ['1', '2']),
      order('o2', '2026-01-03T00:00:00.000Z', ['2', '3']),
    ];
    // «3» покупался с «2», но не с «1» — в блоке для «1» его нет
    expect(computeBoughtTogether(orders, '1').map((r) => r.productId)).toEqual(['2']);
  });
});

describe('getBoughtTogetherProducts', () => {
  it('возвращает карточки каталога по co-purchase id; удалённые товары пропускаются', async () => {
    kvStore.set('data:orders', [
      order('o1', '2026-01-02T00:00:00.000Z', ['1', '2', '99']),
      order('o2', '2026-01-03T00:00:00.000Z', ['1', '3']),
    ]);
    // «99» удалён из каталога — снапшот в заказе его пережил
    kvStore.set('data:products', [makeProduct('1'), makeProduct('2'), makeProduct('3')]);

    const result = await getBoughtTogetherProducts(event, makeProduct('1'));
    // у обоих count=1 → тай-брейк по свежести: «3» куплен позже (o2 01-03)
    expect(result.map((p) => p.id)).toEqual(['3', '2']);
  });

  it('нет совместных покупок → пустой массив (блок скрыт)', async () => {
    kvStore.set('data:orders', [order('o1', '2026-01-02T00:00:00.000Z', ['2', '3'])]);
    kvStore.set('data:products', [makeProduct('1'), makeProduct('2'), makeProduct('3')]);
    expect(await getBoughtTogetherProducts(event, makeProduct('1'))).toEqual([]);
  });

  it('читает из того же KV, что и витрина (readProducts видит то же хранилище)', async () => {
    kvStore.set('data:orders', [order('o1', '2026-01-02T00:00:00.000Z', ['1', '2'])]);
    kvStore.set('data:products', [makeProduct('1'), makeProduct('2')]);
    const products = await readProducts(event);
    expect(products).toHaveLength(2);
    const result = await getBoughtTogetherProducts(event, makeProduct('1'));
    expect(result.map((p) => p.id)).toEqual(['2']);
  });
});
