// tests/unit/promo-integration.test.ts
// ── Интеграция: витринный срез каталога с акциями (readSellableProducts) ──
//
// Весь серверный путь одним прогоном: KV (data:news + data:products) →
// readSellableProducts → промо-цены. Это то, что видит GET /api/products,
// /api/product/:slug и расчёт заказа (createOrder), минус HTTP-слой.
// Мок KV — тот же паттерн, что в news-helpers.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const kvStore = new Map<string, unknown>();

vi.mock('../../server/lib/storage', () => ({
  kvGetJSON: vi.fn(async (_event: unknown, key: string) => {
    const stored = kvStore.get(key);
    return stored === undefined ? null : (structuredClone(stored) as unknown);
  }),
  kvPutJSON: vi.fn(async (_event: unknown, key: string, value: unknown) => {
    kvStore.set(key, structuredClone(value));
  }),
  kvDelete: vi.fn(async (_event: unknown, key: string) => {
    kvStore.delete(key);
  }),
}));

import { readSellableProducts } from '../../server/lib/promoDiscount';
import { writeNews } from '../../server/lib/newsHelpers';
import { writeProducts } from '../../server/lib/productHelpers';
import { newsSeed } from '../../server/lib/newsSeed';

const EVENT = {} as never;

const baseProduct = {
  id: '10',
  slug: 'smartfon-samsung-galaxy-a55',
  name: 'Смартфон Samsung Galaxy A55',
  description: '',
  price: 30000,
  image: '',
  gallery: [],
  categories: ['Смартфоны'],
  inStock: true,
  stockQuantity: 3,
  characteristics: {},
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  variants: [{ id: 'v1', name: '128 ГБ', price: 30000 }],
};
const otherProduct = {
  ...baseProduct,
  id: '11',
  slug: 'dzhinsi-klasicheskie',
  name: 'Джинсы классические',
  categories: ['Одежда'],
};

beforeEach(() => {
  kvStore.clear();
});

describe('readSellableProducts — витринные цены с активной акцией', () => {
  it('акция на товары: цена со скидкой, oldPrice = база, вариант пропорционально', async () => {
    await writeProducts(EVENT, [structuredClone(baseProduct), structuredClone(otherProduct)]);
    await writeNews(EVENT, [
      {
        id: '1',
        date: '2026-11-01',
        category: 'Акции',
        title: 'Скидка 15% на Samsung',
        excerpt: '',
        body: ['Условия'],
        image: '',
        updatedAt: '2026-11-01T00:00:00.000Z',
        promoDiscount: 15,
        productIds: ['10'],
        // Окно вокруг «сегодня»: активна
        startsAt: '2026-01-01',
        endsAt: '2099-12-31',
      } as never,
    ]);

    const out = await readSellableProducts(EVENT);
    const promoProduct = out.find((p) => p.id === '10');
    const untouched = out.find((p) => p.id === '11');
    expect(promoProduct?.price).toBe(25500); // 30000 × 0.85
    expect(promoProduct?.oldPrice).toBe(30000);
    expect(promoProduct?.promoPercent).toBe(15);
    expect(promoProduct?.promoEndsAt).toBe('2099-12-31');
    expect(promoProduct?.variants?.[0]?.price).toBe(25500);
    // Не под акцией — объект как есть
    expect(untouched?.price).toBe(30000);
  });

  it('истёкшая акция — цены базовые (автоаннулирование), KV не переписан', async () => {
    await writeProducts(EVENT, [structuredClone(baseProduct)]);
    await writeNews(EVENT, [
      {
        id: '1',
        date: '2020-01-01',
        category: 'Акции',
        title: 'Старая акция',
        excerpt: '',
        body: ['Условия'],
        image: '',
        updatedAt: '2020-01-01T00:00:00.000Z',
        promoDiscount: 50,
        promoCategory: 'Смартфоны',
        endsAt: '2020-12-31',
      } as never,
    ]);

    const out = await readSellableProducts(EVENT);
    expect(out[0]?.price).toBe(30000);
    expect(out[0]?.promoPercent).toBeUndefined();
    // KV не мутирован резолвером: следующий рид — снова базовые цены
    const again = await readSellableProducts(EVENT);
    expect(again[0]?.price).toBe(30000);
  });

  it('запланированная акция — скидки ещё нет', async () => {
    await writeProducts(EVENT, [structuredClone(baseProduct)]);
    await writeNews(EVENT, [
      {
        id: '1',
        date: '2026-11-01',
        category: 'Акции',
        title: 'Будущая акция',
        excerpt: '',
        body: ['Условия'],
        image: '',
        updatedAt: '2026-11-01T00:00:00.000Z',
        promoDiscount: 30,
        productIds: ['10'],
        startsAt: '2099-01-01',
      } as never,
    ]);
    const out = await readSellableProducts(EVENT);
    expect(out[0]?.price).toBe(30000);
  });

  it('битая новость в KV не роняет выдачу (фолбэк: без скидок)', async () => {
    await writeProducts(EVENT, [structuredClone(baseProduct)]);
    kvStore.set('data:news', { broken: true }); // не массив
    const out = await readSellableProducts(EVENT);
    expect(out).toHaveLength(1);
    expect(out[0]?.price).toBe(30000);
  });

  it('сид новостей (без промо-полей) не даёт скидок — витрина не меняется', async () => {
    await writeProducts(EVENT, [structuredClone(baseProduct)]);
    kvStore.delete('data:news'); // пусто → readNews отдаст сид
    const out = await readSellableProducts(EVENT);
    expect(out[0]?.price).toBe(30000);
    // Сид реален (самоисцеление сработало — newsSeed не пустой)
    expect(newsSeed.length).toBeGreaterThan(0);
  });
});
