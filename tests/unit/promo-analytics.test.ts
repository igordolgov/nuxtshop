// tests/unit/promo-analytics.test.ts — computePromoAnalytics: окно периода,
// агрегация по кодам (выручка/скидки/единицы), отменённые заказы, коды,
// удалённые из справочника, статусы (promoIssue), сортировка.
import { describe, expect, it } from 'vitest';
import { computePromoAnalytics } from '../../server/lib/analyticsHelpers';
import type { Order } from '../../server/lib/orderHelpers';
import type { PromoCode } from '../../server/lib/promoHelpers';

// Фиксированное «сейчас» — детерминизм окна и статусов (UTC)
const NOW = new Date('2026-11-18T12:00:00Z');

/** Полный промокод: переопределяется только то, что нужно тесту */
function promo(f: Partial<PromoCode> & { code: string }): PromoCode {
  return {
    id: '1',
    type: 'percent',
    value: 10,
    active: true,
    expiresAt: null,
    usageLimit: null,
    usedCount: 0,
    description: '',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...f,
  };
}

interface OrderFixture {
  id: string;
  createdAt: string;
  status?: string;
  total?: number;
  discount?: number;
  promoCode?: string | null;
  items?: Array<{ id: string; name: string; price: number; quantity: number }>;
}

/** Минимальный заказ: в промо-аналитике нужны дата/статус/код/суммы/позиции */
function order(f: OrderFixture): Order {
  return {
    id: f.id,
    status: f.status ?? 'new',
    items: (f.items ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
    })),
    total: f.total ?? 1000,
    deliveryMethod: 'courier',
    paymentMethod: 'card',
    discount: f.discount ?? 0,
    promoCode: f.promoCode ?? null,
    createdAt: f.createdAt,
  } as unknown as Order;
}

describe('computePromoAnalytics — пустые данные', () => {
  it('без заказов и промокодов — пустой результат', () => {
    expect(computePromoAnalytics([], [], 30, NOW)).toEqual([]);
  });

  it('известный код без применений — строка с нулями, статус «активен»', () => {
    const r = computePromoAnalytics([], [promo({ code: 'SUMMER15' })], 30, NOW);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      code: 'SUMMER15',
      type: 'percent',
      value: 10,
      active: true,
      issue: null,
      orders: 0,
      cancelled: 0,
      revenue: 0,
      discount: 0,
      units: 0,
      lastUsedAt: null,
    });
  });
});

describe('computePromoAnalytics — агрегация', () => {
  it('два заказа с одним кодом: суммы, lastUsedAt — свежий заказ', () => {
    const orders = [
      order({
        id: 'A',
        createdAt: '2026-11-18T10:00:00Z',
        promoCode: 'SALE10',
        total: 900,
        discount: 100,
        items: [{ id: 'p1', name: 'Кружка', price: 500, quantity: 2 }],
      }),
      order({
        id: 'B',
        createdAt: '2026-11-17T09:00:00Z',
        promoCode: 'sale10', // регистр заказа не важен — код нормализуется
        total: 1350,
        discount: 150,
        items: [{ id: 'p2', name: 'Тарелка', price: 450, quantity: 1 }],
      }),
    ];
    const r = computePromoAnalytics(orders, [promo({ code: 'SALE10' })], 7, NOW);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      code: 'SALE10',
      orders: 2,
      revenue: 2250,
      discount: 250,
      units: 3,
      cancelled: 0,
    });
    expect(r[0].lastUsedAt).toBe('2026-11-18T10:00:00Z');
  });

  it('отменённый заказ: +1 к orders/cancelled, но не в revenue/discount/units', () => {
    const orders = [
      order({
        id: 'A',
        createdAt: '2026-11-18T10:00:00Z',
        promoCode: 'SALE10',
        total: 900,
        discount: 100,
      }),
      order({
        id: 'B',
        createdAt: '2026-11-18T11:00:00Z',
        status: 'cancelled',
        promoCode: 'SALE10',
        total: 5000,
        discount: 500,
        items: [{ id: 'p9', name: 'Телевизор', price: 5000, quantity: 1 }],
      }),
    ];
    const r = computePromoAnalytics(orders, [promo({ code: 'SALE10' })], 7, NOW);
    expect(r[0]).toMatchObject({ orders: 2, cancelled: 1, revenue: 900, discount: 100, units: 0 });
  });

  it('заказ без промокода игнорируется', () => {
    const r = computePromoAnalytics(
      [order({ id: 'A', createdAt: '2026-11-18T10:00:00Z' })],
      [promo({ code: 'SALE10' })],
      7,
      NOW,
    );
    expect(r[0].orders).toBe(0);
  });
});

describe('computePromoAnalytics — окно периода', () => {
  it('заказ за окном не учитывается, граница включена', () => {
    const orders = [
      order({ id: 'A', createdAt: '2026-11-12T00:00:00Z', promoCode: 'SALE10', total: 500 }), // ровно граница 7-дневного окна
      order({ id: 'B', createdAt: '2026-11-11T23:59:59Z', promoCode: 'SALE10', total: 9999 }), // день до окна
    ];
    const r = computePromoAnalytics(orders, [promo({ code: 'SALE10' })], 7, NOW);
    expect(r[0]).toMatchObject({ orders: 1, revenue: 500 });
  });

  it('окно клампится: 0 → дефолт 30, гигантское → 365 — как в computeAnalytics', () => {
    const old = order({
      id: 'A',
      createdAt: '2026-05-01T10:00:00Z',
      promoCode: 'SALE10',
      total: 300,
    });
    expect(computePromoAnalytics([old], [promo({ code: 'SALE10' })], 0, NOW)[0].orders).toBe(0); // дефолт 30: май мимо
    expect(computePromoAnalytics([old], [promo({ code: 'SALE10' })], 5000, NOW)[0].orders).toBe(1); // кламп 365: май в окне
  });
});

describe('computePromoAnalytics — справочник', () => {
  it('код из заказа, удалённый из справочника: type/active = null', () => {
    const orders = [
      order({
        id: 'A',
        createdAt: '2026-11-18T10:00:00Z',
        promoCode: 'GONE',
        total: 700,
        discount: 70,
      }),
    ];
    const r = computePromoAnalytics(orders, [promo({ code: 'SALE10' })], 7, NOW);
    expect(r).toHaveLength(2); // SALE10 (нули) + GONE
    const gone = r.find((p) => p.code === 'GONE');
    expect(gone).toMatchObject({
      type: null,
      value: null,
      active: null,
      issue: null,
      orders: 1,
      revenue: 700,
      discount: 70,
    });
    // код с выручкой — выше нулевого SALE10
    expect(r[0].code).toBe('GONE');
  });

  it('статусы из promoIssue: выключен / истёк / лимит', () => {
    const promos = [
      promo({ code: 'OFF', active: false }),
      promo({ code: 'OLD', expiresAt: '2026-11-01T23:59:59.999Z' }),
      promo({ code: 'LIMIT', usageLimit: 2, usedCount: 2 }),
    ];
    const r = computePromoAnalytics([], promos, 30, NOW);
    const byCode = Object.fromEntries(r.map((p) => [p.code, p.issue]));
    expect(byCode).toEqual({ OFF: 'inactive', OLD: 'expired', LIMIT: 'limit' });
  });
});

describe('computePromoAnalytics — сортировка', () => {
  it('по выручке ↓, тай-брейк — заказы ↓, затем код по алфавиту', () => {
    const promos = [promo({ code: 'AAA' }), promo({ code: 'BBB' }), promo({ code: 'CCC' })];
    const orders = [
      order({ id: '1', createdAt: '2026-11-18T09:00:00Z', promoCode: 'AAA', total: 500 }),
      order({ id: '2', createdAt: '2026-11-18T10:00:00Z', promoCode: 'BBB', total: 500 }),
      order({ id: '3', createdAt: '2026-11-18T11:00:00Z', promoCode: 'BBB', total: 200 }),
      order({ id: '4', createdAt: '2026-11-18T12:00:00Z', promoCode: 'CCC', total: 900 }),
    ];
    const r = computePromoAnalytics(orders, promos, 7, NOW);
    expect(r.map((p) => p.code)).toEqual(['CCC', 'BBB', 'AAA']);
  });
});
