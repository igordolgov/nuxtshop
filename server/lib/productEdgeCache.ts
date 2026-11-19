// server/lib/productEdgeCache.ts
// ============================================================================
// Edge-кэш витринного ответа карточки товара (Cache API воркера,
// caches.default) — тот же паттерн безопасности, что и catalogEdgeCache
// для списка /api/products.
//
// Зачем: GET /api/product/[slug] на каждый запрос читает из KV каталог
// (сам товар, «Похожие», «Часто покупают вместе»), заказы и отзывы — до
// 5 чтений. На холодном изоляте это давало TTFB корневого документа до
// ~1,8 с (Lighthouse mobile, карточка товара): изолят умирает без
// трафика, и каждый «первый за полчаса» посетитель снова платил полную
// цену.
//
// Почему НЕ кэш в памяти изолята (TTL-кэш каталога удалён после
// инцидента со списанием склада — см. productHelpers.ts): память изолята
// пуста именно на холодном изоляте, то есть не спасает того, ради кого
// всё затевалось. Cache API живёт на уровне коло и переживает смерть
// изолята: холодный воркер находит готовый ответ за ~10–50 мс. Полная
// цена чтения KV платится один раз за TTL на коло, а не каждым
// посетителем.
//
// Безопасность данных:
// - кэшируется ТОЛЬКО ответ GET /api/product/<slug> для АНОНИМНЫХ
//   посетителей. У залогиненных (кука user_session) ответ персональный
//   (likedByMe в отзывах) — они мимо кэша, чтение KV как раньше.
// - мутирующие сценарии (админка, bulk, списание склада заказом,
//   модерация отзывов) начинаются с readProducts/readOrders/readReviews
//   → KV напрямую и в кэш не смотрят — read-modify-write по устаревшей
//   копии невозможен (главный урок инцидента с TTL-кэшем каталога).
// - инвалидация: точечную НЕ делаем. Cache API не умеет «удалить по
//   префиксу», а обход slugs на каждый writeProducts — это сотни
//   cache.delete в горячем пути подтверждения заказа. Договорённость о
//   свежести: TTL 30 с. Правка каталога мгновенно видна в списке
//   (purgeCatalogEdgeCache в writeProducts), на карточке — не позже
//   TTL; оформление заказа всё равно валидирует остатки на сервере,
//   устаревание затрагивает только витринное отображение.
// - ключ включает host (RU/CU воркеры не смешиваются) и канонизированный
//   ?lang (en/es — свой JSON-LD на локали; ru/нет/неверное → одна копия).
//
// Отказоустойчивость: без Cache API (dev/тесты/странная среда) или при
// любой ошибке — работаем как раньше, читаем KV. Кэш не может сломать
// ответ, максимум — не работать.
// ============================================================================

import type { H3Event } from 'h3';
import { getCookie, getRequestHeader } from 'h3';
import { SESSION_COOKIE } from '../utils/auth';

/** Префикс пути карточки в API. */
export const PRODUCT_CARD_CACHE_PATH = '/api/product/';

/** TTL edge-кэша карточки, секунд. Окно устаревания склада/правок на
 *  витрине; заведомо уже допустимого окна глобальной консистентности
 *  KV (~60 c), поэтому не умножает расхождение сверх него. */
export const PRODUCT_CARD_CACHE_TTL_SECONDS = 30;

/** Локали с собственным локализованным JSON-LD карточки (name,
 *  description, canonical offers.url с префиксом). Общий источник истины
 *  для ключа кэша и для endpoint'а — ключ и содержимое ответа не могут
 *  разойтись. ru — дефолт (и для битых значений), отдельной копии не
 *  получает: канонизация «?lang=ru» → без суффикса. */
export const PRODUCT_CARD_JSON_LD_LOCALES: ReadonlySet<string> = new Set(['en', 'es']);

// Минимальное подмножество Cache API: в Workers есть caches.default,
// в Node/dev/тестах — нет (объявление только для типов).
interface MinimalCache {
  match(key: RequestInfo | URL): Promise<Response | undefined>;
  put(key: RequestInfo | URL, response: Response): Promise<void>;
  delete(key: RequestInfo | URL): Promise<boolean>;
}

// caches.default читаем ЛЕНИВО, при каждом обращении: в Workers он есть
// всегда, в dev/тестах появляется динамически (и его мокают в тестах).
// Тот же приём, что в catalogEdgeCache.
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

/** Сырой URL запроса: event.path на настоящем h3-event, node.req.url —
 *  на «плоском» event тестов. Fallback '' — заведомо мимо префикса. */
const rawUrlOf = (event: H3Event): string => {
  try {
    return (
      (event as { path?: string }).path ||
      (event.node as { req?: { url?: string } } | undefined)?.req?.url ||
      ''
    );
  } catch {
    return '';
  }
};

/** Канонизированный суффикс локали: en/es → «?lang=xx», прочее → ''. */
const langSuffixOf = (event: H3Event): string => {
  const raw = rawUrlOf(event);
  const search = raw.slice(raw.indexOf('?') + 1);
  if (!raw.includes('?') || !search) return '';
  for (const pair of search.split('&')) {
    const [key = '', value = ''] = pair.split('=');
    if (key !== 'lang') continue;
    const lang = decodeURIComponent(value);
    return PRODUCT_CARD_JSON_LD_LOCALES.has(lang) ? `?lang=${lang}` : '';
  }
  return '';
};

/** Кэш работает только для анонимов: есть кука сессии → мимо кэша.
 *  «Плоский» event (тесты) без заголовков — считаем анонимом. */
const isAnonymous = (event: H3Event): boolean => {
  try {
    return !getCookie(event, SESSION_COOKIE);
  } catch {
    return true;
  }
};

/**
 * Ключ кэша карточки: https://<host>/api/product/<slug> [+ ?lang=en|es].
 * slugOrId берётся из роутера и доверяется ему (encodeURIComponent — для
 * консистентности ключа, витринные слуги ascii). null — не карточечный
 * путь / нет host / пустой slug: кэш не читаем и не пишем.
 */
export const productCardCacheKey = (event: H3Event, slugOrId: string): string | null => {
  const host = hostOf(event);
  if (!host || !slugOrId) return null;
  if (!rawUrlOf(event).split('?')[0]?.startsWith(PRODUCT_CARD_CACHE_PATH)) return null;
  return `https://${host}${PRODUCT_CARD_CACHE_PATH}${encodeURIComponent(slugOrId)}${langSuffixOf(event)}`;
};

/** Готовый ответ карточки из edge-кэша или null (промах, залогиненный
 *  посетитель, нет Cache API). */
export async function readProductCardEdgeCache<T>(
  event: H3Event,
  slugOrId: string,
): Promise<T | null> {
  const cache = cacheOrNull();
  if (!cache || !isAnonymous(event)) return null;
  const key = productCardCacheKey(event, slugOrId);
  if (!key) return null;
  try {
    const hit = await cache.match(key);
    if (hit && hit.ok) return (await hit.json()) as T;
  } catch {
    // Cache API недоступен/не отдал — читаем как обычно
  }
  return null;
}

/** Кладёт витринный ответ карточки в edge-кэш. Ответы без товара
 *  (404-путь) не кэшируем — как и пустой список в catalogEdgeCache.
 *  Ошибки записи молча игнорируются. */
export async function writeProductCardEdgeCache(
  event: H3Event,
  slugOrId: string,
  payload: unknown,
): Promise<void> {
  const cache = cacheOrNull();
  if (!cache || !isAnonymous(event)) return;
  const key = productCardCacheKey(event, slugOrId);
  if (!key) return;
  if (!payload || typeof payload !== 'object') return;
  if (!(payload as { product?: unknown }).product) return;
  try {
    await cache.put(
      key,
      new Response(JSON.stringify(payload), {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': `public, max-age=${PRODUCT_CARD_CACHE_TTL_SECONDS}`,
        },
      }),
    );
  } catch {
    // Запись в кэш — оптимизация, не гарантия
  }
}
