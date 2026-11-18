// tests/unit/analytics-export.test.ts — CSV-билдеры выгрузок аналитики:
// заголовки, экранирование, «сырые» суммы, формат дат, удалённые промокоды.
import { describe, expect, it } from 'vitest';
import {
  PROMO_CSV_HEADERS,
  SERIES_CSV_HEADERS,
  TOP_PRODUCTS_CSV_HEADERS,
  analyticsSeriesToCsv,
  promoAnalyticsToCsv,
  topProductsToCsv,
} from '../../server/lib/analyticsExport';
import type { PromoAnalyticsEntry } from '../../server/lib/analyticsHelpers';
import { CSV_BOM, csvRow } from '../../server/lib/csvHelpers';
import { formatMoney } from '../../store.config';

const promoEntry = (f: Partial<PromoAnalyticsEntry> & { code: string }): PromoAnalyticsEntry => ({
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
  ...f,
});

describe('topProductsToCsv', () => {
  it('BOM, заголовки, места по порядку, суммы без форматирования', () => {
    const doc = topProductsToCsv([
      { id: 'p1', name: 'Кружка', units: 3, revenue: 1500 },
      { id: 'p2', name: 'Тарелка', units: 1, revenue: 300 },
    ]);
    expect(doc.startsWith(CSV_BOM)).toBe(true);
    expect(doc.endsWith('\r\n')).toBe(true);
    const lines = doc.split('\r\n').filter(Boolean);
    expect(lines[0].replace(CSV_BOM, '')).toBe(csvRow(TOP_PRODUCTS_CSV_HEADERS));
    expect(lines[1]).toBe(csvRow([1, 'Кружка', 3, 1500]));
    expect(lines[2]).toBe(csvRow([2, 'Тарелка', 1, 300]));
  });

  it('название с разделителем/кавычками экранируется', () => {
    const doc = topProductsToCsv([{ id: 'p1', name: 'Стакан "Л;Д"', units: 1, revenue: 100 }]);
    expect(doc).toContain('"Стакан ""Л;Д"""');
  });
});

describe('analyticsSeriesToCsv', () => {
  it('дни без продаж — нулевые строки (серия без пропусков)', () => {
    const doc = analyticsSeriesToCsv([
      { date: '2026-11-17', orders: 0, revenue: 0 },
      { date: '2026-11-18', orders: 2, revenue: 1200 },
    ]);
    const lines = doc.split('\r\n').filter(Boolean);
    expect(lines[0].replace(CSV_BOM, '')).toBe(csvRow(SERIES_CSV_HEADERS));
    expect(lines[1]).toBe(csvRow(['2026-11-17', 0, 0]));
    expect(lines[2]).toBe(csvRow(['2026-11-18', 2, 1200]));
  });
});

describe('promoAnalyticsToCsv', () => {
  it('percent/fixed в «Скидке», деньги сырые, дата DD.MM.YYYY HH:mm UTC', () => {
    const doc = promoAnalyticsToCsv([
      promoEntry({
        code: 'PERCENT10',
        type: 'percent',
        value: 10,
        orders: 2,
        revenue: 2250,
        discount: 250,
        units: 3,
        lastUsedAt: '2026-11-18T10:07:00.000Z',
      }),
      promoEntry({
        code: 'FIXED500',
        type: 'fixed',
        value: 500,
        orders: 1,
        revenue: 800,
        discount: 500,
        units: 2,
      }),
    ]);
    const lines = doc.split('\r\n').filter(Boolean);
    expect(lines[0].replace(CSV_BOM, '')).toBe(csvRow(PROMO_CSV_HEADERS));
    expect(lines[1]).toBe(csvRow(['PERCENT10', '10%', 2, 0, 2250, 250, 3, '18.11.2026 10:07']));
    expect(lines[2]).toBe(csvRow(['FIXED500', formatMoney(500), 1, 0, 800, 500, 2, '']));
  });

  it('код, удалённый из справочника: пустая «Скидка»', () => {
    const doc = promoAnalyticsToCsv([
      promoEntry({
        code: 'GONE',
        type: null,
        value: null,
        active: null,
        orders: 1,
        revenue: 700,
        discount: 70,
      }),
    ]);
    expect(doc).toContain(csvRow(['GONE', '', 1, 0, 700, 70, 0, '']));
  });
});
