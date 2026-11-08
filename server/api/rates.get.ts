// server/api/rates.get.ts — GET /api/rates: курс CUP из «Tasas de elTOQUE»
// для кубинской витрины (эквивалент цен USD в песо под ценой и в корзине).
//
// Секрет: Worker env ELTOQUE_API_KEY (JWT из письма elTOQUE), задаётся
// `npx wrangler secret put ELTOQUE_API_KEY --name <worker>` — как Telegram-секреты
// (см. wrangler.jsonc): в коде/репозитории ключа нет. Локально (nuxt dev,
// node .output/server/index.mjs) читается process.env.ELTOQUE_API_KEY.
// Секрета нет → { available: false, reason: 'no_key' } — RU-магазин живёт
// с этим роутом без ключа, клиент строку CUP не показывает (флаг витрины).
//
// Кэш: elTOQUE обновляет ставку раз в несколько часов, лимиты API жёсткие
// (429), поэтому цена сети минимальна:
//   1. s-maxage/stale-while-revalidate — Cloudflare edge кэширует ответ,
//      подавляющее большинство запросов до воркера не доходит;
//   2. KV rates:eltoque (TTL 2ч) — между edge-кэшами и для SSR;
//   3. KV rates:eltoque:last (без TTL) — при сбое API отдаём последнюю
//      известную ставку (курс «замер», витрина работает, 429 не множим).
import { defineEventHandler, setHeader } from 'h3';
import { kvGetJSON, kvPutJSON } from '../lib/storage';
import { parseTrmiResponse, type RatesResponse } from '#shared/cupRates';

const TRMI_URL = 'https://tasas.eltoque.com/v1/trmi';
const KV_FRESH = 'rates:eltoque';
const KV_LAST = 'rates:eltoque:last';
// elTOQUE публикует ставки несколько раз в день: 2ч — свежесть без 429
const KV_TTL_SECONDS = 2 * 60 * 60;
const FETCH_TIMEOUT_MS = 10_000;

interface WorkerEnv {
  ELTOQUE_API_KEY?: string;
  KV?: unknown;
}

// Биндинги воркера: event.context.cloudflare.env на реальном запросе;
// globalThis.__env__ — для внутренних $fetch (паттерн server/lib/storage.ts)
const getWorkerEnv = (
  event: Parameters<Parameters<typeof defineEventHandler>[0]>[0],
): WorkerEnv | undefined =>
  event.context?.cloudflare?.env ?? (globalThis as { __env__?: WorkerEnv }).__env__;

export default defineEventHandler(async (event): Promise<RatesResponse> => {
  const env = getWorkerEnv(event);
  const apiKey = env?.ELTOQUE_API_KEY || process.env.ELTOQUE_API_KEY;

  // RU-магазин (и кубинский до настройки секрета): строка CUP скрыта
  if (!apiKey) {
    setHeader(event, 'Cache-Control', 'no-store');
    return { available: false, reason: 'no_key' };
  }

  // 1. Свежий KV-кэш (TTL 2ч)
  const fresh = await kvGetJSON<RatesResponse>(event, KV_FRESH);
  if (fresh?.available) {
    setHeader(event, 'Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');
    return fresh;
  }

  // 2. Запрос к TRMI. Заголовок Accept — как в примерах elTOQUE; 10с таймаут,
  //    чтобы сбой API не держал SSR воркера
  let payload: unknown = null;
  try {
    payload = await $fetch(TRMI_URL, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      timeout: FETCH_TIMEOUT_MS,
      retry: 0,
    });
  } catch {
    payload = null;
  }

  const parsed = payload ? parseTrmiResponse(payload) : null;
  if (parsed?.available) {
    await kvPutJSON(event, KV_FRESH, parsed, KV_TTL_SECONDS);
    // Страховка на сбой API: последняя успешная ставка живёт вечно
    await kvPutJSON(event, KV_LAST, parsed);
    setHeader(event, 'Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');
    return parsed;
  }

  // 3. Фолбэк: последняя известная ставка (возможно, устаревшая на часы)
  const last = await kvGetJSON<RatesResponse>(event, KV_LAST);
  if (last?.available) {
    // Клиент не кэширует неудачный ход — попробуем снова при следующем запросе
    setHeader(event, 'Cache-Control', 'no-store');
    return last;
  }

  setHeader(event, 'Cache-Control', 'no-store');
  return {
    available: false,
    reason: payload ? 'bad_payload' : 'upstream_error',
  };
});
