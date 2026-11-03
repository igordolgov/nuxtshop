// Тесты заказа с вариантами: составной id «productId::variantId»,
// серверная цена/склад варианта, ошибки неизвестного варианта и нехватки.
// Файл самодостаточный (свой мок KV и фикстуры) — по образцу order-stock.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const kvStore = new Map<string, unknown>();

vi.mock('../../server/lib/storage', () => ({
  kvGetJSON: vi.fn(async (_event: unknown, key: string) =>
    (kvStore.get(key) as unknown) ?? null,
  ),
  kvPutJSON: vi.fn(async (_event: unknown, key: string, value: unknown) => {
    kvStore.set(key, structuredClone(value));
  }),
  kvDelete: vi.fn(async (_event: unknown, key: string) => {
    kvStore.delete(key);
  }),
}));

import {
  createOrder,
  type CreateOrderInput,
} from '../../server/lib/orderHelpers';
import { writeProducts, type Product } from '../../server/lib/productHelpers';

const event = {} as never;

/** Товар с вариантами: база 249990 (512 ГБ), 1 ТБ дороже, 2 ТБ мало */
const product: Product = {
  id: '12',
  slug: 'noutbuk-test',
  name: 'Ноутбук Тест',
  description: 'Описание',
  price: 249990,
  image: '/images/noutbuk.png',
  gallery: [],
  categories: ['cat'],
  inStock: true,
  stockQuantity: 10,
  characteristics: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  variantName: 'Память',
  variants: [
    { id: 'mbp-512', name: '512 ГБ', price: 249990, stockQuantity: 10 },
    { id: 'mbp-1tb', name: '1 ТБ', price: 279990, stockQuantity: 4 },
    { id: 'mbp-2tb', name: '2 ТБ', price: 319990, stockQuantity: 1 },
  ],
};

function makeInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    items: [{ id: '12::mbp-512', quantity: 1 }],
    deliveryMethod: 'pickup',
    paymentMethod: 'card',
    customer: {
      name: 'Иван Петров',
      email: 'ivan@example.com',
      phone: '+7 999 123-45-67',
    },
    ...overrides,
  };
}

beforeEach(async () => {
  kvStore.clear();
  await writeProducts(event, structuredClone([product]));
});

describe('заказ с вариантами', () => {
  it('вариантная позиция: цена и название варианта из KV', async () => {
    const order = await createOrder(event, makeInput({
      items: [{ id: '12::mbp-1tb', quantity: 2 }],
    }));
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      id: '12',
      variantId: 'mbp-1tb',
      variantName: '1 ТБ',
      price: 279990, // не базовая 249990!
      quantity: 2,
    });
    // сервер считает сам: 279990 × 2 (pickup — без доставки)
    expect(order.subtotal).toBe(559980);
  });

  it('позиция без варианта — базовая цена и variantId: null', async () => {
    const order = await createOrder(event, makeInput({ items: [{ id: '12', quantity: 1 }] }));
    expect(order.items[0]).toMatchObject({
      price: 249990,
      variantId: null,
      variantName: null,
    });
  });

  it('быстрый «+» из списков: первый вариант = базовая цена', async () => {
    // addToCart без варианта подставляет variants[0] → id «12::mbp-512»
    const order = await createOrder(event, makeInput({ items: [{ id: '12::mbp-512', quantity: 1 }] }));
    expect(order.items[0]).toMatchObject({
      variantId: 'mbp-512',
      variantName: '512 ГБ',
      price: 249990,
    });
  });

  it('неизвестный вариант — 400', async () => {
    await expect(
      createOrder(event, makeInput({ items: [{ id: '12::nope', quantity: 1 }] })),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('нехватка склада варианта — 409 (у 2 ТБ остаток 1)', async () => {
    await expect(
      createOrder(event, makeInput({ items: [{ id: '12::mbp-2tb', quantity: 2 }] })),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('склад варианта не задан → наследуется от товара', async () => {
    const list = structuredClone([product]);
    delete (list[0].variants![2] as Record<string, unknown>).stockQuantity;
    await writeProducts(event, list);
    // 12::mbp-2tb без своего склада → склад товара 10 → 2 шт. проходит
    const order = await createOrder(event, makeInput({ items: [{ id: '12::mbp-2tb', quantity: 2 }] }));
    expect(order.items[0]!.price).toBe(319990);
  });

  it('два варианта одного товара — две позиции в заказе', async () => {
    const order = await createOrder(event, makeInput({
      items: [
        { id: '12::mbp-512', quantity: 1 },
        { id: '12::mbp-1tb', quantity: 1 },
      ],
    }));
    expect(order.items).toHaveLength(2);
    expect(order.items.map((i) => i.variantId)).toEqual(['mbp-512', 'mbp-1tb']);
    expect(order.subtotal).toBe(249990 + 279990);
  });
});
