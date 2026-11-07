// Тесты server/lib/orderHelpers.ts — деньги, доставка, промокод, статусы.
// storage мокируется на Map в памяти: заказы и каталог живут как в KV,
// но безWorkers-окружения. Серверная логика — реальная.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Деньги/оплата/доставка — из конфига витрины (тест не ломается при смене
// набора методов и тарифов: кубинская копия — transfer/cash и USD-цифры)
import {
  DELIVERY_PRICE_COURIER,
  DELIVERY_PRICE_POST,
  FREE_DELIVERY_FROM,
  STORE_PAYMENT_METHODS,
  type StorePaymentMethod,
} from '../../store.config';

// ─── Мок KV: data:orders / data:products в обычной Map ──────────────
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
  createOrder,
  readOrders,
  updateOrderStatus,
  writeOrders,
  type CreateOrderInput,
} from '../../server/lib/orderHelpers';
import type { Product } from '../../server/lib/productHelpers';
import type { PromoCode } from '../../server/lib/promoHelpers';
import { cacheClear } from '../../server/lib/cache';

const event = {} as never;

/** Фикстура каталога: один товар с известной ценой и складом */
const product: Product = {
  id: '1',
  slug: 'tovar',
  name: 'Тестовый товар',
  description: 'Описание',
  price: 1000,
  image: '/images/tovar.png',
  gallery: [],
  categories: ['cat'],
  inStock: true,
  stockQuantity: 5,
  characteristics: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/** Валидный ввод заказа: курьер, без промокода */
function makeInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    items: [{ id: '1', quantity: 1 }],
    deliveryMethod: 'courier',
    paymentMethod: STORE_PAYMENT_METHODS[0] as StorePaymentMethod,
    customer: {
      name: 'Иван Петров',
      email: 'ivan@example.com',
      phone: '+7 999 123-45-67',
      address: 'ул. Ленина, 1',
      city: 'Москва',
    },
    ...overrides,
  };
}

/** Фикстура промокода в KV: SALE10 = 10% */
const promo: PromoCode = {
  id: '1',
  code: 'SALE10',
  type: 'percent',
  value: 10,
  active: true,
  expiresAt: null,
  usageLimit: null,
  usedCount: 0,
  description: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  kvStore.clear();
  cacheClear(); // readProducts кэшируется module-scope — между тестами сбрасываем
  kvStore.set('data:products', structuredClone([product]));
  kvStore.set('data:promocodes', structuredClone([promo]));
});

describe('createOrder — деньги считает сервер', () => {
  it('subtotal/total из цен KV; клиентские суммы не учитываются', async () => {
    const order = await createOrder(event, makeInput({ items: [{ id: '1', quantity: 2 }] }));
    expect(order.subtotal).toBe(2000);
    // 2000 выше порога бесплатной доставки — курьер бесплатный
    expect(order.deliveryPrice).toBe(0);
    expect(order.total).toBe(2000);
    expect(order.items[0]!.price).toBe(1000); // цена из KV, не из ввода
  });

  it('промокод из KV даёт скидку 10%, регистронезависимо', async () => {
    const order = await createOrder(event, makeInput({ promoCode: 'sale10' }));
    expect(order.promoCode).toBe('SALE10');
    expect(order.discount).toBe(100); // 10% от 1000
    expect(order.total).toBe(900); // 1000 - 100 (доставка бесплатная)
    // счётчик применений увеличен после заказа
    const promos = (await kvStore.get('data:promocodes')) as PromoCode[];
    expect(promos[0]!.usedCount).toBe(1);
  });

  it('фиксированный промокод не превышает сумму корзины', async () => {
    kvStore.set('data:promocodes', [
      structuredClone(promo),
      { ...promo, id: '2', code: 'MINUS500', type: 'fixed', value: 500 },
    ]);
    const order = await createOrder(event, makeInput({ promoCode: 'minus500' }));
    expect(order.discount).toBe(500); // 1000 - 500
    expect(order.total).toBe(500);
  });

  it('истёкший / неактивный / исчерпанный промокод — скидка 0, код не фиксируется', async () => {
    const cases: PromoCode[] = [
      { ...promo, expiresAt: '2000-01-01T00:00:00.000Z' },
      { ...promo, active: false },
      { ...promo, usageLimit: 2, usedCount: 2 },
    ];
    for (const bad of cases) {
      kvStore.set('data:promocodes', [structuredClone(bad)]);
      const order = await createOrder(event, makeInput({ promoCode: 'sale10' }));
      expect(order.discount).toBe(0);
      expect(order.promoCode).toBeNull();
    }
  });

  it('неизвестный промокод игнорируется (скидка 0, код не фиксируется)', async () => {
    const order = await createOrder(event, makeInput({ promoCode: 'HACK200' }));
    expect(order.discount).toBe(0);
    expect(order.promoCode).toBeNull();
  });

  it('бесплатная доставка курьером строго больше порога', async () => {
    // Ровно порог — ещё платно (товар с ценой = FREE_DELIVERY_FROM)
    kvStore.set('data:products', structuredClone([{ ...product, price: FREE_DELIVERY_FROM }]));
    const exactly = await createOrder(event, makeInput({ items: [{ id: '1', quantity: 1 }] }));
    expect(exactly.deliveryPrice).toBe(DELIVERY_PRICE_COURIER);

    // Чуть выше порога — уже бесплатно
    const above = await createOrder(event, makeInput({ items: [{ id: '1', quantity: 2 }] }));
    expect(above.deliveryPrice).toBe(0);
    expect(above.total).toBe(FREE_DELIVERY_FROM * 2);
  });

  it('почта всегда платная, самовывоз всегда бесплатный', async () => {
    const post = await createOrder(
      event,
      makeInput({
        deliveryMethod: 'post',
        items: [{ id: '1', quantity: 5 }], // сумма выше порога, но почта всегда платная
        customer: { ...makeInput().customer, postalCode: '123456' },
      }),
    );
    expect(post.deliveryPrice).toBe(DELIVERY_PRICE_POST);

    const pickup = await createOrder(event, makeInput({ deliveryMethod: 'pickup' }));
    expect(pickup.deliveryPrice).toBe(0);
  });
});

describe('createOrder — корзина и склад', () => {
  it('дубликаты корзины схлопываются по id (2+3 = 5 шт.)', async () => {
    const order = await createOrder(
      event,
      makeInput({
        items: [
          { id: '1', quantity: 2 },
          { id: '1', quantity: 3 },
        ],
      }),
    );
    expect(order.items).toHaveLength(1);
    expect(order.items[0]!.quantity).toBe(5);
  });

  it('пустая корзина — 400', async () => {
    await expect(createOrder(event, makeInput({ items: [] }))).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('мусорные позиции отбрасываются (qty 0 / не-целое)', async () => {
    const order = await createOrder(
      event,
      makeInput({
        items: [
          { id: '1', quantity: 1 },
          { id: '1', quantity: 0 },
          { id: '1', quantity: 1.5 },
          { id: '', quantity: 2 },
        ],
      }),
    );
    expect(order.items[0]!.quantity).toBe(1);
  });

  it('запрос больше склада — 409 с названием товара', async () => {
    await expect(
      createOrder(event, makeInput({ items: [{ id: '1', quantity: 6 }] })),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('Тестовый товар'),
    });
  });

  it('неизвестный товар — 400', async () => {
    await expect(
      createOrder(event, makeInput({ items: [{ id: '999', quantity: 1 }] })),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('недопустимый способ доставки/оплаты — 400', async () => {
    await expect(createOrder(event, makeInput({ deliveryMethod: 'дрон' }))).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(createOrder(event, makeInput({ paymentMethod: 'крипта' }))).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('валидный идентификатор способа оплаты вне store.config — 400', async () => {
    // Сервер валидирует по STORE_PAYMENT_METHODS: известный метод, выключенный
    // в конфиге (card в кубинской копии, transfer в российской), тоже 400
    const ALL: StorePaymentMethod[] = ['card', 'cash', 'transfer'];
    const disabled = ALL.find((m) => !STORE_PAYMENT_METHODS.includes(m));
    if (!disabled) return; // в конфиге включены все — проверять нечего
    await expect(createOrder(event, makeInput({ paymentMethod: disabled }))).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('createOrder — валидация контактов', () => {
  it('короткое имя — 400', async () => {
    await expect(
      createOrder(event, makeInput({ customer: { ...makeInput().customer, name: 'Я' } })),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('кривой email — 400', async () => {
    await expect(
      createOrder(event, makeInput({ customer: { ...makeInput().customer, email: 'не-почта' } })),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('телефон короче 10 цифр — 400', async () => {
    await expect(
      createOrder(event, makeInput({ customer: { ...makeInput().customer, phone: '999' } })),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('courier без адреса — 400', async () => {
    await expect(
      createOrder(event, makeInput({ customer: { ...makeInput().customer, address: '' } })),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('post без индекса из 6 цифр — 400', async () => {
    await expect(
      createOrder(
        event,
        makeInput({
          deliveryMethod: 'post',
          customer: { ...makeInput().customer, postalCode: '123' },
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('email нормализуется (trim + lowercase)', async () => {
    const order = await createOrder(
      event,
      makeInput({ customer: { ...makeInput().customer, email: '  IVAN@Example.COM ' } }),
    );
    expect(order.customer.email).toBe('ivan@example.com');
    expect(order.notify.email).toBe('ivan@example.com');
  });
});

describe('персистентность и статусы', () => {
  it('заказ сохраняется в KV, новые сверху', async () => {
    await createOrder(event, makeInput());
    await createOrder(event, makeInput({ items: [{ id: '1', quantity: 2 }] }));
    const orders = await readOrders(event);
    expect(orders).toHaveLength(2);
    expect(orders[0]!.items[0]!.quantity).toBe(2); // последний созданный — первый в списке
    expect(orders[0]!.status).toBe('new');
    expect(orders[0]!.statusHistory).toEqual([{ status: 'new', at: expect.any(String) }]);
  });

  it('комментарий обрезается до 500 символов', async () => {
    const order = await createOrder(event, makeInput({ comment: 'x'.repeat(600) }));
    expect(order.comment).toHaveLength(500);
  });

  it('смена статуса пишет историю; повтор той же смены — идемпотентна', async () => {
    const created = await createOrder(event, makeInput());
    const id = created.id;

    await updateOrderStatus(event, id, 'confirmed', 'позвонили');
    await updateOrderStatus(event, id, 'confirmed', 'повторный вызов');
    const orders = await readOrders(event);
    expect(orders[0]!.status).toBe('confirmed');
    expect(orders[0]!.statusHistory).toHaveLength(2); // new + confirmed, дубля нет

    await updateOrderStatus(event, id, 'shipped');
    const again = await readOrders(event);
    expect(again[0]!.statusHistory).toHaveLength(3);
    expect(again[0]!.statusHistory.at(-1)).toMatchObject({ status: 'shipped' });
  });

  it('несуществующий заказ — 404, недопустимый статус — 400', async () => {
    await expect(updateOrderStatus(event, 'ORD-нет', 'confirmed')).rejects.toMatchObject({
      statusCode: 404,
    });
    const created = await createOrder(event, makeInput());
    await expect(updateOrderStatus(event, created.id, 'взломан' as never)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('writeOrders отклоняет не-массив', async () => {
    await expect(writeOrders(event, {} as never)).rejects.toThrow(/array/i);
  });
});
