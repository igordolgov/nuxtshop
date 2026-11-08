/**
 * shared/cupRates.ts — курс CUP (кубинское песо) из API «Tasas de elTOQUE».
 *
 * Общая чистая логика для клиента и сервера (тесты vitest импортируют её же):
 *  - парс ответа GET https://tasas.eltoque.com/v1/trmi;
 *  - форматирование эквивалента цены в CUP.
 *
 * Ключ API (JWT) — секрет воркера ELTOQUE_API_KEY (wrangler secret put),
 * в коде/репозитории его нет. Регистрация: https://tasas.eltoque.com
 * (API возвращает медианы купли-продажи неформального рынка — «tasa oficial
 * informal», ту самую, по которой на Кубе считают цены в CUP).
 *
 * Пример ответа TRMI (2026-11):
 * { "date":"2026-11-08","hour":17,"minutes":45,"seconds":22,
 *   "tasas":{ "USD":930.0, "MLC":726.72, "ECU":1015.0, ... } }
 *
 * Набор валют в ответе плавающий (EUR отсутствует, когда по ней нет сделок) —
 * не полагаемся ни на одну, кроме USD: витрина кубинской копии стоит в USD.
 */

/** Ключ ставки USD в ответе TRMI — единственный обязательный. */
const REQUIRED_CURRENCY = 'USD' as const;

/** Страница курса — источник правды для покупателя (ссылка «Tasa elTOQUE»). */
export const CUP_RATE_SOURCE_URL = 'https://eltoque.com/tasas-de-cambio-hoy';

/** Сырой ответ TRMI без валидации (формат полей даты/времени — строка и числа). */
export interface TrmiRaw {
  date?: unknown;
  hour?: unknown;
  minutes?: unknown;
  seconds?: unknown;
  tasas?: unknown;
}

export interface RatesPayload {
  available: true;
  /** Ставка USD→CUP — под неё рендерится эквивалент цен витрины (USD). */
  usd: number;
  /** Все ставки ответа как есть (MLC, ECU, USDT_TRC20, … — что отдал API). */
  rates: Record<string, number>;
  /** Момент ставки в ISO-8601 UTC (время API — Ла-Гавана, UTC−5, сдвинуто). */
  updatedAt: string;
  /** Как время выглядит на сайте elTOQUE («2026-11-08 17:45:22», Ла-Гавана). */
  updatedAtText: string;
}

export interface RatesUnavailable {
  available: false;
  /** no_key — секрета нет (RU-магазин); upstream_error — API недоступен;
   *  bad_payload — ответ не разобрался (нет tasas/USD). */
  reason: 'no_key' | 'upstream_error' | 'bad_payload';
}

export type RatesResponse = RatesPayload | RatesUnavailable;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Парс ответа /v1/trmi. USD обязателен и должен быть конечным числом > 0:
 * без него эквивалент не показать (остальные валюты — опциональный довесок).
 * Время API — Ла-Гавана (UTC−5): собираем ISO в UTC и текст «как на сайте».
 */
export function parseTrmiResponse(raw: unknown): RatesResponse {
  const body = (raw ?? {}) as TrmiRaw;
  const tasas = (body.tasas ?? null) as Record<string, unknown> | null;
  if (!tasas || typeof tasas !== 'object') {
    return { available: false, reason: 'bad_payload' };
  }

  const rates: Record<string, number> = {};
  for (const [code, value] of Object.entries(tasas)) {
    const n = Number(value);
    if (typeof code === 'string' && code.length > 0 && Number.isFinite(n) && n > 0) {
      rates[code] = n;
    }
  }

  const usd = rates[REQUIRED_CURRENCY];
  if (!usd) return { available: false, reason: 'bad_payload' };

  // date/hour/... — опциональны: если API не отдал время, живём без него
  // (строка времени — пустая, ISO не строим)
  const ymd = typeof body.date === 'string' ? body.date : '';
  const h = Number(body.hour);
  const m = Number(body.minutes);
  const s = Number(body.seconds);
  const hasTime =
    ymd.length > 0 &&
    Number.isInteger(h) &&
    h >= 0 &&
    h <= 23 &&
    Number.isInteger(m) &&
    m >= 0 &&
    m <= 59 &&
    Number.isInteger(s) &&
    s >= 0 &&
    s <= 59;

  // Время API — Ла-Гавана (круглогодично UTC−5, проверено живым вызовом:
  // в 22:45 UTC API отдал hour=17): текст «как на сайте», ISO — в UTC.
  // Суффикс часового пояса для показа добавляет i18n
  const updatedAtText = hasTime ? `${ymd} ${pad2(h)}:${pad2(m)}:${pad2(s)}` : '';
  const updatedAt = hasTime
    ? new Date(`${ymd}T${pad2(h)}:${pad2(m)}:${pad2(s)}-05:00`)
        .toISOString()
        .replace(/\.\d{3}Z$/, 'Z')
    : '';

  return {
    available: true,
    usd,
    rates,
    updatedAt,
    updatedAtText,
  };
}

/**
 * Эквивалент цены в CUP одной строкой: '≈ 465 000 CUP'.
 * Формат es-дестятых локалей без дробной части — песо-цены целые;
 * ведущий '≈' подчёркивает, что это пересчёт по рыночной ставке.
 */
export function formatCupAmount(usd: number, usdRate: number): string {
  const cup = Math.round((Number(usd) || 0) * (Number(usdRate) || 0));
  const n = new Intl.NumberFormat('es-CU', { maximumFractionDigits: 0 }).format(cup);
  return `≈ ${n} CUP`;
}
