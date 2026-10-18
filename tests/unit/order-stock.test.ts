// Тесты списания склада (feat orders): подтверждение списывает, отмена возвращает.
// Файл самодостаточный: свой мок KV и свои фикстуры — не зависит от структуры
// других тест-файлов, применяется отдельным патчем без привязки к их строкам.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Мок KV: data:orders / data:products в обычной Map ──────────────
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
  readOrders,
  updateOrderStatus,
  type CreateOrderInput,
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

/** Валидный ввод заказа: курьер, без промокода */
function makeInput(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    items: [{ id: '1', quantity: 1 }],
    deliveryMethod: 'courier',
    paymentMethod: 'card',
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

beforeEach(async () => {
  kvStore.clear();
  kvStore.set('data:products', structuredClone([product]));
  // KV мы почистили напрямую, но модульный кэш каталога
  // внутри productHelpers (readProducts) об этом не знает и переживает тесты:
  // после 409 в тесте «нехватка» кэш остался со старым остатком, и проверка
  // в createOrder видела stock=1 вместо 5. writeProducts синхронизирует кэш —
  // следующий readProducts обязан прочитать KV заново.
  await writeProducts(event, structuredClone([product]));
});

/** Текущее состояние товара '1' в KV (writeProducts сбрасывает кэш каталога) */
function stock() {
  const list = kvStore.get('data:products') as Array<Product>;
  return list.find((p) => p.id === '1')!;
}

describe('склад: подтверждение списывает, отмена возвращает', () => {
  it('confirmed списывает заказанное количество, inStock пересчитывается', async () => {
    const created = await createOrder(event, makeInput({ items: [{ id: '1', quantity: 2 }] }));
    const updated = await updateOrderStatus(event, created.id, 'confirmed');
    expect(updated.stockApplied).toBe(true);
    expect(stock().stockQuantity).toBe(3); // было 5
    expect(stock().inStock).toBe(true);

    // Идемпотентность: повторное подтверждение не списывает второй раз
    await updateOrderStatus(event, created.id, 'confirmed');
    const orders = await readOrders(event);
    expect(orders[0]!.statusHistory).toHaveLength(2);
    expect(stock().stockQuantity).toBe(3);
  });

  it('списание в ноль снимает товар с продажи (inStock=false)', async () => {
    const created = await createOrder(event, makeInput({ items: [{ id: '1', quantity: 5 }] }));
    await updateOrderStatus(event, created.id, 'confirmed');
    expect(stock().stockQuantity).toBe(0);
    expect(stock().inStock).toBe(false);
  });

  it('нехватка на складе — 409, статус и склад не тронуты', async () => {
    const created = await createOrder(event, makeInput({ items: [{ id: '1', quantity: 2 }] }));
    // Пока заказ лежал новым, остаток уменьшили вручную (writeProducts
    // заодно сбрасывает кэш каталога там, где он есть — readProducts
    // обязан увидеть новое значение)
    await writeProducts(event, [{ ...structuredClone(product), stockQuantity: 1 }]);
    await expect(updateOrderStatus(event, created.id, 'confirmed')).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('Тестовый товар'),
    });
    const orders = await readOrders(event);
    expect(orders[0]!.status).toBe('new');
    expect(orders[0]!.stockApplied).toBeUndefined();
    expect(stock().stockQuantity).toBe(1);
  });

  it('отмена подтверждённого возвращает количество на склад', async () => {
    const created = await createOrder(event, makeInput({ items: [{ id: '1', quantity: 2 }] }));
    await updateOrderStatus(event, created.id, 'confirmed');
    await updateOrderStatus(event, created.id, 'cancelled');
    expect(stock().stockQuantity).toBe(5);
    expect(stock().inStock).toBe(true);
    const orders = await readOrders(event);
    expect(orders[0]!.stockApplied).toBe(false); // повторное подтверждение спишет заново
  });

  it('отмена нового (не подтверждённого) заказа склад не трогает', async () => {
    const created = await createOrder(event, makeInput());
    await updateOrderStatus(event, created.id, 'cancelled');
    expect(stock().stockQuantity).toBe(5);
    const orders = await readOrders(event);
    expect(orders[0]!.stockApplied).toBeUndefined();
  });

  it('после отмены можно подтвердить снова — спишет заново', async () => {
    const created = await createOrder(event, makeInput({ items: [{ id: '1', quantity: 2 }] }));
    await updateOrderStatus(event, created.id, 'confirmed');
    await updateOrderStatus(event, created.id, 'cancelled');
    await updateOrderStatus(event, created.id, 'confirmed');
    expect(stock().stockQuantity).toBe(3);
  });

  it('товар, удалённый из каталога, не блокирует подтверждение', async () => {
    const created = await createOrder(event, makeInput());
    await writeProducts(event, []);
    const updated = await updateOrderStatus(event, created.id, 'confirmed');
    expect(updated.status).toBe('confirmed');
    expect(updated.stockApplied).toBe(true);
  });
});
