// tests/unit/analytics.test.ts — чистые функции analyticsHelpers:
// окно периода, исключение отменённых из выручки, дневные бакеты,
// AOV, топ товаров, разбивки по статусу/доставке/оплате.
import { describe, expect, it } from 'vitest';
import { computeAnalytics } from '../../server/lib/analyticsHelpers';
import type { Order } from '../../server/lib/orderHelpers';

// Фиксированное «сейчас» — детерминизм окна и бакетов (UTC)
const NOW = new Date('2026-11-18T12:00:00Z');

interface OrderFixture {
  id: string;
  createdAt: string;
  status?: string;
  total?: number;
  deliveryMethod?: string;
  paymentMethod?: string;
  items?: Array<{ id: string; name: string; price: number; quantity: number }>;
}

/** Минимальный заказ: в аналитике нужны только дата/статус/суммы/позиции */
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
    deliveryMethod: f.deliveryMethod ?? 'courier',
    paymentMethod: f.paymentMethod ?? 'card',
    createdAt: f.createdAt,
  } as unknown as Order;
}

describe('computeAnalytics — пустые данные', () => {
  it('без заказов: нули и полная серия пустых дней', () => {
    const r = computeAnalytics([], 30, NOW);
    expect(r.days).toBe(30);
    expect(r.series).toHaveLength(30);
    expect(r.summary).toMatchObject({
      orders: 0,
      paidOrders: 0,
      cancelled: 0,
      revenue: 0,
      aov: 0,
      units: 0,
    });
    expect(r.topProducts).toEqual([]);
    expect(r.byStatus.new).toBe(0);
    expect(r.byDelivery).toEqual({});
    expect(r.byPayment).toEqual({});
  });

  it('дни серии идут от старых к свежим, последний — сегодня (UTC)', () => {
    const r = computeAnalytics([], 7, NOW);
    expect(r.series[0].date).toBe('2026-11-12'); // 7-дневное окно: Nov 12..18
    expect(r.series[6].date).toBe('2026-11-18');
  });

  it('окно клампится: 0 → дефолт 30, гигантское → 365', () => {
    expect(computeAnalytics([], 0, NOW).days).toBe(30);
    expect(computeAnalytics([], 5000, NOW).days).toBe(365);
  });
});

describe('computeAnalytics — окно и фильтрация', () => {
  it('заказ сегодня попадает в серию, старше окна — исключается', () => {
    const orders = [
      order({ id: 'A', createdAt: '2026-11-18T09:30:00Z', total: 500 }),
      order({ id: 'B', createdAt: '2026-11-12T00:00:00Z', total: 300 }), // ровно граница — включён
      order({ id: 'C', createdAt: '2026-11-11T23:59:59Z', total: 9999 }), // день до окна — мимо
    ];
    const r = computeAnalytics(orders, 7, NOW);
    expect(r.summary.orders).toBe(2);
    expect(r.summary.revenue).toBe(800);
    const withRevenue = r.series.filter((d) => d.revenue > 0).map((d) => d.date);
    expect(withRevenue).toEqual(['2026-11-12', '2026-11-18']);
    expect(r.series.find((d) => d.date === '2026-11-18')).toMatchObject({
      orders: 1,
      revenue: 500,
    });
  });

  it('битая дата заказа не роняет расчёт', () => {
    const r = computeAnalytics([order({ id: 'X', createdAt: 'не-дата' })], 7, NOW);
    expect(r.summary.orders).toBe(0);
  });
});

describe('computeAnalytics — выручка и отмены', () => {
  const orders = [
    order({ id: 'A', createdAt: '2026-11-18T10:00:00Z', total: 1000 }),
    order({ id: 'B', createdAt: '2026-11-18T11:00:00Z', total: 2500, status: 'cancelled' }),
    order({ id: 'C', createdAt: '2026-11-17T11:00:00Z', total: 1500 }),
  ];

  it('отменённые не в выручке/единицах/чеке, но в счётчиках заказов', () => {
    const r = computeAnalytics(orders, 7, NOW);
    expect(r.summary.orders).toBe(3);
    expect(r.summary.cancelled).toBe(1);
    expect(r.summary.paidOrders).toBe(2);
    expect(r.summary.revenue).toBe(2500); // 1000 + 1500, без 2500 отменённого
    expect(r.byStatus.cancelled).toBe(1);
    expect(r.byStatus.new).toBe(2);
    // отменённый день: заказы +1, выручка 0
    const day18 = r.series.find((d) => d.date === '2026-11-18');
    expect(day18).toMatchObject({ orders: 2, revenue: 1000 });
  });

  it('AOV = выручка / не-отменённые заказы', () => {
    const r = computeAnalytics(orders, 7, NOW);
    expect(r.summary.aov).toBe(1250);
  });
});

describe('computeAnalytics — топ товаров', () => {
  const orders = [
    order({
      id: 'A',
      createdAt: '2026-11-18T10:00:00Z',
      items: [
        { id: 'p1', name: 'Телефон', price: 500, quantity: 2 },
        { id: 'p2', name: 'Чехол', price: 100, quantity: 1 },
      ],
    }),
    order({
      id: 'B',
      createdAt: '2026-11-18T11:00:00Z',
      items: [
        { id: 'p1', name: 'Телефон', price: 500, quantity: 1 }, // тот же товар — агрегация
        { id: 'p3', name: 'Наушники', price: 700, quantity: 2 },
      ],
    }),
    order({
      id: 'C',
      createdAt: '2026-11-18T12:00:00Z',
      status: 'cancelled',
      items: [{ id: 'p9', name: 'Отменённый', price: 900, quantity: 5 }],
    }),
  ];

  it('агрегация по товару, сортировка по единицам, отменённые не участвуют', () => {
    const r = computeAnalytics(orders, 7, NOW);
    // p1: 3 ед. (2+1 из двух заказов) → p3: 2 ед. → p2: 1 ед.
    expect(r.topProducts.map((p) => p.id)).toEqual(['p1', 'p3', 'p2']);
    const p1 = r.topProducts.find((p) => p.id === 'p1');
    expect(p1).toMatchObject({ units: 3, revenue: 1500 }); // (2+1) × 500
    expect(r.topProducts.some((p) => p.id === 'p9')).toBe(false);
  });

  it('тай-брейк по выручке при равных единицах', () => {
    const tie = [
      order({
        id: 'A',
        createdAt: '2026-11-18T10:00:00Z',
        items: [
          { id: 'x', name: 'Дорогой', price: 1000, quantity: 2 },
          { id: 'y', name: 'Дешёвый', price: 100, quantity: 2 },
        ],
      }),
    ];
    const r = computeAnalytics(tie, 7, NOW);
    expect(r.topProducts.map((p) => p.id)).toEqual(['x', 'y']);
  });

  it('лимит topLimit', () => {
    const many = order({
      id: 'A',
      createdAt: '2026-11-18T10:00:00Z',
      items: Array.from({ length: 15 }, (_, i) => ({
        id: `p${i}`,
        name: `T${i}`,
        price: 10,
        quantity: 1,
      })),
    });
    const r = computeAnalytics([many], 7, NOW, 8);
    expect(r.topProducts).toHaveLength(8);
  });
});

describe('computeAnalytics — разбивки', () => {
  const orders = [
    order({
      id: 'A',
      createdAt: '2026-11-18T10:00:00Z',
      deliveryMethod: 'courier',
      paymentMethod: 'card',
    }),
    order({
      id: 'B',
      createdAt: '2026-11-18T11:00:00Z',
      deliveryMethod: 'pickup',
      paymentMethod: 'cash',
      status: 'delivered',
    }),
    order({
      id: 'C',
      createdAt: '2026-11-18T12:00:00Z',
      deliveryMethod: 'courier',
      paymentMethod: 'card',
    }),
  ];

  it('доставка и оплата считаются по всем заказам периода', () => {
    const r = computeAnalytics(orders, 7, NOW);
    expect(r.byDelivery).toEqual({ courier: 2, pickup: 1 });
    expect(r.byPayment).toEqual({ card: 2, cash: 1 });
  });
});
