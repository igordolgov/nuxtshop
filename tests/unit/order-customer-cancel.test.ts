// Тесты отмены заказа покупателем (ЛК): canCustomerCancel (владение + статус
// «до отправки») и полный сценарий через updateOrderStatus — отмена
// подтверждённого заказа возвращает склад. Файл самодостаточный: свой мок KV
// и свои фикстуры — не зависит от структуры других тест-файлов.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Способы оплаты — из конфига витрины (тест не ломается при смене
// набора методов: кубинская копия включает transfer вместо card)
import { STORE_PAYMENT_METHODS, type StorePaymentMethod } from '../../store.config';

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
  canCustomerCancel,
  createOrder,
  CUSTOMER_CANCELLABLE_STATUSES,
  readOrders,
  updateOrderStatus,
  type CreateOrderInput,
  type Order,
} from '../../server/lib/orderHelpers';
import { writeProducts, type Product } from '../../server/lib/productHelpers';

const event = {} as never;

/** Фикстура каталога: один товар с известной ценой и складом (5 шт.) */
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

/** Валидный ввод заказа покупателя u1: курьер, без промокода */
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
      userId: 'u1',
    },
    ...overrides,
  };
}

/** Заказ из KV (createOrder пишет unshift — первый элемент). */
async function firstOrder(): Promise<Order> {
  const orders = await readOrders(event);
  return orders[0]!;
}

beforeEach(async () => {
  kvStore.clear();
  kvStore.set('data:products', structuredClone([product]));
  // writeProducts синхронизирует модульный кэш каталога productHelpers —
  // следующий readProducts обязан прочитать KV заново (см. order-stock.test.ts)
  await writeProducts(event, structuredClone([product]));
});

describe('canCustomerCancel', () => {
  it('владелец может отменить заказ в статусах до отправки', async () => {
    await createOrder(event, makeInput());
    const order = await firstOrder();
    expect(order.status).toBe('new');
    expect(canCustomerCancel(order, 'u1')).toBe(true);
    expect(CUSTOMER_CANCELLABLE_STATUSES).toEqual(['new', 'confirmed']);
  });

  it('чужому заказу отмена запрещена (владение проверяется по userId)', async () => {
    const created = await createOrder(event, makeInput());
    expect(created.customer.userId).toBe('u1');
    expect(canCustomerCancel(await firstOrder(), 'u2')).toBe(false);
  });

  it('гостевой заказ (userId null) не отменяется через ЛК', async () => {
    await createOrder(event, makeInput());
    const order = await firstOrder();
    expect(order.customer.userId).toBe('u1'); // фикстура с userId
    // Гостевой вариант: userId null — не совпадает ни с каким userId
    expect(
      canCustomerCancel({ ...order, customer: { ...order.customer, userId: null } }, 'u1'),
    ).toBe(false);
  });

  it('после передачи в доставку (shipped) отмена покупателем запрещена', async () => {
    await createOrder(event, makeInput());
    await updateOrderStatus(event, (await firstOrder()).id, 'shipped');
    const order = await firstOrder();
    expect(canCustomerCancel(order, 'u1')).toBe(false);
  });

  it('подтверждённый заказ ещё можно отменить (до отправки)', async () => {
    await createOrder(event, makeInput());
    await updateOrderStatus(event, (await firstOrder()).id, 'confirmed');
    expect(canCustomerCancel(await firstOrder(), 'u1')).toBe(true);
  });
});

describe('отмена покупателем через updateOrderStatus', () => {
  it('отмена нового заказа: склад не трогается, история содержит комментарий', async () => {
    const created = await createOrder(event, makeInput({ items: [{ id: '1', quantity: 2 }] }));
    const updated = await updateOrderStatus(event, created.id, 'cancelled', 'Отменён покупателем');
    expect(updated.status).toBe('cancelled');
    expect(updated.stockApplied).toBeUndefined();
    expect(updated.statusHistory.at(-1)).toMatchObject({
      status: 'cancelled',
      comment: 'Отменён покупателем',
    });
    const list = kvStore.get('data:products') as Array<Product>;
    expect(list.find((p) => p.id === '1')!.stockQuantity).toBe(5); // списания не было
  });

  it('отмена подтверждённого возвращает товар на склад (idempotent по stockApplied)', async () => {
    const created = await createOrder(event, makeInput({ items: [{ id: '1', quantity: 2 }] }));
    await updateOrderStatus(event, created.id, 'confirmed');
    const updated = await updateOrderStatus(event, created.id, 'cancelled', 'Отменён покупателем');
    expect(updated.stockApplied).toBe(false);
    const list = kvStore.get('data:products') as Array<Product>;
    expect(list.find((p) => p.id === '1')!.stockQuantity).toBe(5);
    expect(list.find((p) => p.id === '1')!.inStock).toBe(true);
  });
});
