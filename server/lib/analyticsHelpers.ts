// server/lib/analyticsHelpers.ts
// Чистые функции аналитики заказов — без доступа к KV, покрыты юнит-тестами.
// Используется эндпоинтом /api/admin/analytics (страница /admin/analytics).
//
// Семантика выручки: НЕ-отменённые заказы (status !== 'cancelled').
// Отменённые заказы считаются отдельно (byStatus/summary.cancelled) —
// админ видит и спрос, и отмены, но деньги от отменённых в выручку не идут.
//
// Границы дней — UTC: заказы хранят ISO-строки в UTC, воркер работает в UTC,
// тесты передают фиксированный now — всё в одной системе координат.
// Клиент рисует подписи дней из строки «YYYY-MM-DD» без Date-парсинга,
// поэтому таймзона браузера на разбивку не влияет.

import type { Order, OrderStatus } from './orderHelpers';

/** Bucket дня: «YYYY-MM-DD» + заказы/выручка за этот день */
export interface DayBucket {
  date: string;
  orders: number;
  revenue: number;
}

export interface TopProductEntry {
  id: string;
  name: string;
  units: number;
  revenue: number;
}

export interface AnalyticsSummary {
  /** Все заказы за период (включая отменённые) */
  orders: number;
  /** Не-отменённые заказы — по ним считается выручка и AOV */
  paidOrders: number;
  cancelled: number;
  revenue: number;
  /** Средний чек: revenue / paidOrders, округлён до целого */
  aov: number;
  /** Продано единиц товара (не-отменённые заказы) */
  units: number;
}

export interface AnalyticsResult {
  days: number;
  summary: AnalyticsSummary;
  /** Ровно days бакетов, дни без продаж — нули (график без пропусков) */
  series: DayBucket[];
  topProducts: TopProductEntry[];
  byStatus: Record<OrderStatus, number>;
  byDelivery: Record<string, number>;
  byPayment: Record<string, number>;
}

/** «YYYY-MM-DD» для timestamp в UTC */
function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Полночь UTC дня, к которому принадлежит timestamp */
function utcDayStart(ms: number): number {
  return Math.floor(ms / 86_400_000) * 86_400_000;
}

/**
 * Считает аналитику заказов за последние days дней (включая сегодня).
 *
 * @param orders  все заказы магазина (без предварительной фильтрации)
 * @param days    окно в днях, 1..365 (клампится)
 * @param now     «сейчас» — инъектится для детерминизма тестов
 * @param topLimit сколько позиций держать в topProducts
 */
export function computeAnalytics(
  orders: Order[],
  days = 30,
  now: Date = new Date(),
  topLimit = 8,
): AnalyticsResult {
  const windowDays = Math.min(Math.max(Math.floor(days) || 30, 1), 365);

  // Окно: от полуночи UTC первого дня до конца текущего дня (включительно)
  const todayStart = utcDayStart(now.getTime());
  const windowStart = todayStart - (windowDays - 1) * 86_400_000;
  const windowEnd = todayStart + 86_400_000;

  // Заранее заготовленные бакеты: дни без заказов дают нули, а не пропуски
  const buckets = new Map<string, DayBucket>();
  for (let i = 0; i < windowDays; i++) {
    const date = utcDayKey(windowStart + i * 86_400_000);
    buckets.set(date, { date, orders: 0, revenue: 0 });
  }

  const summary: AnalyticsSummary = {
    orders: 0,
    paidOrders: 0,
    cancelled: 0,
    revenue: 0,
    aov: 0,
    units: 0,
  };
  const byStatus: Record<OrderStatus, number> = {
    new: 0,
    confirmed: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };
  const byDelivery: Record<string, number> = {};
  const byPayment: Record<string, number> = {};

  // Топ товаров: группировка по id ТОВАРА (OrderItem.id — базовый id,
  // вариант живёт в отдельном поле variantId — см. orderHelpers.createOrder).
  // Удалённые из каталога товары НЕ теряем: снапшот имени в позиции заказа.
  const productAgg = new Map<string, TopProductEntry>();

  for (const order of orders ?? []) {
    const createdAtMs = new Date(order.createdAt).getTime();
    if (!Number.isFinite(createdAtMs)) continue; // битая дата — не падаем
    if (createdAtMs < windowStart || createdAtMs >= windowEnd) continue;

    // Счётчики: все заказы периода, включая отменённые
    summary.orders++;
    if (byStatus[order.status] !== undefined) byStatus[order.status]++;
    byDelivery[order.deliveryMethod] = (byDelivery[order.deliveryMethod] ?? 0) + 1;
    byPayment[order.paymentMethod] = (byPayment[order.paymentMethod] ?? 0) + 1;

    const bucket = buckets.get(utcDayKey(createdAtMs));
    if (bucket) bucket.orders++;

    if (order.status === 'cancelled') {
      summary.cancelled++;
      continue; // деньги и единицы отменённых в выручку не идут
    }

    summary.paidOrders++;
    summary.revenue += order.total;
    if (bucket) bucket.revenue += order.total;

    for (const item of order.items ?? []) {
      const qty = item.quantity || 0;
      summary.units += qty;
      const agg = productAgg.get(String(item.id));
      if (agg) {
        agg.units += qty;
        agg.revenue += item.price * qty;
      } else {
        productAgg.set(String(item.id), {
          id: String(item.id),
          name: item.name,
          units: qty,
          revenue: item.price * qty,
        });
      }
    }
  }

  summary.aov = summary.paidOrders > 0 ? Math.round(summary.revenue / summary.paidOrders) : 0;

  // Сортировка топа: сначала по проданным единицам, тай-брейк — по выручке
  const topProducts = [...productAgg.values()]
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
    .slice(0, topLimit);

  return {
    days: windowDays,
    summary,
    series: [...buckets.values()], // Map сохраняет порядок вставки: от старых к свежим
    topProducts,
    byStatus,
    byDelivery,
    byPayment,
  };
}
