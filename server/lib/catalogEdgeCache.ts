// server/lib/catalogEdgeCache.ts
// ============================================================================
// Edge-кэш витринной выдачи каталога (Cache API воркера, caches.default).
//
// Зачем: PageSpeed на витрине показывал нестабильный TTFB документа —
// на холодном изоляте чтение KV каталога (products + пачка отзывов для
// attachRatings) доходило до 1–2 с, и LCP главной уезжал за 4 с. Кэш в
// памяти изолята здесь не спасает: изолят умирает без трафика, и каждый
// «первый за час» посетитель снова платит полную цену.
//
// Cache API живёт на уровне датацентра (коло) и переживает смерть изолята:
// даже холодный воркер находит готовый ответ за ~10–50 мс. Полная цена
// чтения KV платится один раз за TTL на коло, а не каждым посетителем.
//
// Безопасность данных (инцидент с TTL-кэшем каталога в памяти изолята):
// кэшируется ТОЛЬКО ответ GET /api/products без query (витрина/SSR главной).
// Мутирующие сценарии (списание склада в заказах, админка, bulk, CSV)
// начинаются с readProducts → KV напрямую и в кэш не смотрят. Инвалидация
// — централизованно в writeProducts (единая точка записи каталога) и при
// смене approved отзыва (рейтинг в выдаче каталога) — purgeCatalogEdgeCache.
//
// Отказоустойчивость: Cache API недоступен (dev/тесты/странная среда) или
// любая операция упала — работаем как раньше, читаем KV. Кэш не может
// сломать ответ, максимум — не работать.
// ============================================================================

import type { H3Event } from 'h3';
import { getRequestHeader } from 'h3';

// Минимальный подмножество Cache API: в Workers есть caches.default,
// в Node/dev/тестах — нет (объявление только для типов).
interface MinimalCache {
  match(key: RequestInfo | URL): Promise<Response | undefined>;
  put(key: RequestInfo | URL, response: Response): Promise<void>;
  delete(key: RequestInfo | URL): Promise<boolean>;
}

/** Канонический путь витринной выдачи каталога (без query). */
export const CATALOG_CACHE_PATH = '/api/products';

/** TTL edge-кэша. KV глобально консистентен за ~60 c — 120 c не умножают
 *  расхождение сверх уже допустимого KV-окна; правки инвалидируются явно. */
export const CATALOG_CACHE_TTL_SECONDS = 120;

// caches.default читаем ЛЕНИВО, при каждом обращении: в Workers он есть
// всегда, в dev/тестах появляется динамически (и его мокают в тестах).
const cacheOrNull = (): MinimalCache | null =>
  (globalThis as { caches?: { default?: MinimalCache } }).caches?.default ?? null;

/** Host запроса; падение на «плоском» event (тесты) — undefined, не throw. */
const hostOf = (event: H3Event): string | undefined => {
  try {
    return getRequestHeader(event, 'host') || undefined;
  } catch {
    return undefined;
  }
};

/** Путь+query из event.path (h3 отдаёт URL вместе с query). Fallback на
 *  node.req.url — на «плоском» event (тесты) геттера event.path нет. */
const pathParts = (event: H3Event): { path: string; search: string } => {
  try {
    const raw =
      (event.path || (event.node as { req?: { url?: string } } | undefined)?.req?.url || '') + '';
    const [path = '', search = ''] = raw.split('?');
    return { path, search };
  } catch {
    return { path: '', search: '?' }; // '?' — заведомо не «чистый» путь
  }
};

/**
 * Ключ кэша: https://<host>/api/products — ТОЛЬКО для «чистого» запроса
 * каталога без query. Фильтры/поиск/сортировка витрина делает на клиенте,
 * поэтому query у горячего пути отсутствует; любой query (и под-пути)
 * в кэш не попадают — их ответы считаем индивидуальными.
 */
export const catalogCacheKey = (event: H3Event): string | null => {
  const host = hostOf(event);
  if (!host) return null;
  const { path, search } = pathParts(event);
  if (path !== CATALOG_CACHE_PATH || search) return null;
  return `https://${host}${CATALOG_CACHE_PATH}`;
};

/**
 * Ключ для инвалидации: хост важен, query — нет (правка каталога сбрасывает
 * витринную выдачу целиком, кем бы и с каким query она ни была прочитана).
 */
export const catalogCacheKeyForPurge = (event: H3Event): string | null => {
  const host = hostOf(event);
  if (!host) return null;
  return `https://${host}${CATALOG_CACHE_PATH}`;
};

/** Готовый ответ из edge-кэша или null (промах / нет Cache API). */
export async function readCatalogEdgeCache<T>(event: H3Event): Promise<T | null> {
  const cache = cacheOrNull();
  const key = catalogCacheKey(event);
  if (!cache || !key) return null;
  try {
    const hit = await cache.match(key);
    if (hit && hit.ok) return (await hit.json()) as T;
  } catch {
    // Cache API недоступен/не отдал — читаем как обычно
  }
  return null;
}

/** Кладёт список каталога в edge-кэш. Пустой список не кэшируем: пустая
 *  витрина — всегда признак нештатной выдачи (см. пересев в readProducts),
 *  кэшировать её нельзя. Ошибки записи молча игнорируются. */
export async function writeCatalogEdgeCache(event: H3Event, list: unknown): Promise<void> {
  const cache = cacheOrNull();
  const key = catalogCacheKey(event);
  if (!cache || !key || !Array.isArray(list) || list.length === 0) return;
  try {
    await cache.put(
      key,
      new Response(JSON.stringify(list), {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': `public, max-age=${CATALOG_CACHE_TTL_SECONDS}`,
        },
      }),
    );
  } catch {
    // Запись в кэш — оптимизация, не гарантия
  }
}

/** Инвалидация витринного edge-кэша: после любой записи каталога (KV) и
 *  смене approved отзыва. В другой коло устаревшая копия живёт не дольше TTL. */
export async function purgeCatalogEdgeCache(event: H3Event): Promise<void> {
  const cache = cacheOrNull();
  const key = catalogCacheKeyForPurge(event);
  if (!cache || !key) return;
  try {
    await cache.delete(key);
  } catch {
    // Нет кэша — нет и инвалидации
  }
}
