// server/lib/analyticsExport.ts
// CSV-выгрузки страницы /admin/analytics (GET /api/admin/analytics/export):
// топ товаров, продажи по дням, статистика промокодов.
//
// Тот же диалект «Excel RU», что и выгрузка заказов (server/lib/csvHelpers.ts):
// BOM + разделитель «;» + CRLF — файл открывается двойным кликом в русском
// Excel без мастера импорта. Экранирование и защита от формульной инъекции —
// общие csvEscape/csvRow/toCsv.
//
// Числа в денежных колонках — «сырые» (без formatMoney), чтобы Excel считал
// по ним формулы; валюта указана в заголовке колонки (₽ / $ из конфига витрины).
import type { DayBucket, PromoAnalyticsEntry, TopProductEntry } from './analyticsHelpers';
import { formatOrderDateTime, toCsv } from './csvHelpers';
import { promoValueLabel } from './promoHelpers';
import { currencySymbol } from '../../store.config';

// ─── Топ товаров ──────────────────────────────────────────────────────────

export const TOP_PRODUCTS_CSV_HEADERS = [
  'Место',
  'Товар',
  'Продано, шт',
  `Выручка, ${currencySymbol()}`,
];

/** Топ товаров → CSV (место проставляется по порядку массива). */
export function topProductsToCsv(entries: TopProductEntry[]): string {
  return toCsv(
    TOP_PRODUCTS_CSV_HEADERS,
    entries.map((p, i) => [i + 1, p.name, p.units, p.revenue]),
  );
}

// ─── Продажи по дням ──────────────────────────────────────────────────────

export const SERIES_CSV_HEADERS = ['Дата', 'Заказы', `Выручка, ${currencySymbol()}`];

/** Дневная серия → CSV (включая нулевые дни — как на графике страницы). */
export function analyticsSeriesToCsv(series: DayBucket[]): string {
  return toCsv(
    SERIES_CSV_HEADERS,
    series.map((d) => [d.date, d.orders, d.revenue]),
  );
}

// ─── Промокоды ────────────────────────────────────────────────────────────

export const PROMO_CSV_HEADERS = [
  'Промокод',
  'Скидка',
  'Заказов',
  'Отменено',
  `Выручка, ${currencySymbol()}`,
  `Скидок выдано, ${currencySymbol()}`,
  'Продано, шт',
  'Последнее применение (UTC)',
];

/**
 * Статистика промокодов → CSV.
 * Колонка «Скидка» — человекочитаемый ярлык («10%» / «500 ₽»); у кода,
 * удалённого из справочника, — пустая ячейка. Дата последнего применения —
 * DD.MM.YYYY HH:mm UTC (formatOrderDateTime, как в выгрузке заказов).
 */
export function promoAnalyticsToCsv(entries: PromoAnalyticsEntry[]): string {
  return toCsv(
    PROMO_CSV_HEADERS,
    entries.map((p) => [
      p.code,
      p.type ? promoValueLabel({ type: p.type, value: p.value ?? 0 }) : '',
      p.orders,
      p.cancelled,
      p.revenue,
      p.discount,
      p.units,
      formatOrderDateTime(p.lastUsedAt),
    ]),
  );
}
