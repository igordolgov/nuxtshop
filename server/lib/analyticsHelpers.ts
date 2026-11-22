// server/lib/analyticsHelpers.ts
// Чистые функции аналитики заказов — без доступа к KV, покрыты юнит-тестами.
// Используется эндпоинтом /api/admin/analytics (страница /admin/analytics)
// и CSV-выгрузкой /api/admin/analytics/export.
// computePromoAnalytics — статистика промокодов за тот же период:
// применяемость, выручка и «цена» промо (сумма выданных скидок).
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
import type { PromoCode, PromoType } from './promoHelpers';
import { promoIssue } from './promoHelpers';

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

// ─── Промокоды за период ─────────────────────────────────────────────────

/** Статистика одного промокода за окно (см. computePromoAnalytics). */
export interface PromoAnalyticsEntry {
  /** UPPERCASE-код — как в справочнике и в заказах. */
  code: string;
  /** null — код удалён из справочника (остался только в истории заказов). */
  type: PromoType | null;
  value: number | null;
  /** null — код удалён; false — временно выключен админом. */
  active: boolean | null;
  /** Почему код нельзя применить сейчас (promoIssue); null — применим или удалён. */
  issue: 'inactive' | 'scheduled' | 'expired' | 'limit' | null;
  /** Все заказы с кодом за окно, включая отменённые. */
  orders: number;
  /** Из них отменённых — деньги от них в revenue/discount не идут. */
  cancelled: number;
  /** Выручка по не-отменённым заказам с кодом (сумма total). */
  revenue: number;
  /** «Цена промо»: сумма скидок по не-отменённым заказам (сумма discount). */
  discount: number;
  /** Продано единиц в не-отменённых заказах с кодом. */
  units: number;
  /** ISO-момент последнего применения в окне. */
  lastUsedAt: string | null;
}

/**
 * Статистика промокодов за последние days дней (то же окно, что в
 * computeAnalytics: от полуночи UTC первого дня до конца текущего дня).
 *
 * Известные коды (справочник data:promocodes) попадают в результат даже
 * без применений — с нулями; коды из заказов, которых в справочнике
 * уже нет (удалён/переименован), не теряются: type/active = null.
 * Сортировка: по выручке ↓, тай-брейк — заказы ↓, затем код по алфавиту.
 */
export function computePromoAnalytics(
  orders: Order[],
  promos: PromoCode[],
  days = 30,
  now: Date = new Date(),
): PromoAnalyticsEntry[] {
  const windowDays = Math.min(Math.max(Math.floor(days) || 30, 1), 365);
  const todayStart = utcDayStart(now.getTime());
  const windowStart = todayStart - (windowDays - 1) * 86_400_000;
  const windowEnd = todayStart + 86_400_000;

  // Справочник кодов: известные промокоды с нулевой статистикой
  const agg = new Map<string, PromoAnalyticsEntry>();
  for (const promo of promos ?? []) {
    if (!promo?.code) continue;
    const code = String(promo.code).toUpperCase();
    agg.set(code, {
      code,
      type: promo.type,
      value: promo.value,
      active: promo.active,
      issue: promoIssue(promo, now),
      orders: 0,
      cancelled: 0,
      revenue: 0,
      discount: 0,
      units: 0,
      lastUsedAt: null,
    });
  }

  for (const order of orders ?? []) {
    const createdAtMs = new Date(order.createdAt).getTime();
    if (!Number.isFinite(createdAtMs)) continue; // битая дата — не падаем
    if (createdAtMs < windowStart || createdAtMs >= windowEnd) continue;

    const code = order.promoCode ? String(order.promoCode).trim().toUpperCase() : '';
    if (!code) continue;

    let entry = agg.get(code);
    if (!entry) {
      // Код удалён из справочника, но живёт в истории заказов — не теряем
      entry = {
        code,
        type: null,
        value: null,
        active: null,
        issue: null,
        orders: 0,
        cancelled: 0,
        revenue: 0,
        discount: 0,
        units: 0,
        lastUsedAt: null,
      };
      agg.set(code, entry);
    }

    entry.orders++;
    if (entry.lastUsedAt == null || createdAtMs > new Date(entry.lastUsedAt).getTime()) {
      entry.lastUsedAt = order.createdAt;
    }

    if (order.status === 'cancelled') {
      entry.cancelled++;
      continue; // деньги и скидки отменённых не считаем
    }

    entry.revenue += order.total ?? 0;
    entry.discount += order.discount ?? 0;
    for (const item of order.items ?? []) {
      entry.units += item.quantity || 0;
    }
  }

  return [...agg.values()].sort(
    (a, b) => b.revenue - a.revenue || b.orders - a.orders || a.code.localeCompare(b.code),
  );
}
