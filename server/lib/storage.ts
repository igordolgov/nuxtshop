// server/lib/storage.ts
/**
 * Доступ к Workers KV через event.context.cloudflare.env.
 * В `nuxt dev` биндингов нет — in-memory fallback.
 *
 * ⚠️ ВНУТРЕННИЕ $fetch (SSR-рендер страницы сам ходит на /api/**) создают
 * новое h3-событие БЕЗ event.context.cloudflare — биндинг KV в нём не виден.
 * Раньше такой запрос уходил в пустой in-memory fallback, и readProducts
 * возвращал СИД из бандла: SSR рендерил русские товары без переводных
 * полей (i18n витрины на /en и /es был сломан), а в проде — вообще
 * снапшот каталога на момент сборки, а не живой KV.
 * Лечение: биндинг KV одного изолята воркера один и тот же на всё время
 * его жизни — запоминаем последний реальный биндинг и отдаём его
 * внутренним запросам. Для честного «биндингов нет» (unit-тесты, nuxt dev
 * без wrangler) остаётся in-memory fallback.
 */

import type { H3Event } from 'h3';

interface KVStore {
  get<T>(key: string, type: 'json'): Promise<T | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

const mem = new Map<string, unknown>();

// Последний реальный биндинг KV этого изолята (страховка на случай, если
// globalThis.__env__ ещё не установлен: любой внешний запрос к /api/**
// через storage.ts его запомнит).
let lastKV: KVStore | null = null;

// Nitro (preset cloudflare-module) на каждом РЕАЛЬНОМ запросе воркера кладёт
// env в globalThis.__env__ (runtime/entries/cloudflare-module). Внутренние
// $fetch (SSR-рендер страницы ходит на /api/**) создают событие без
// event.context.cloudflare, но env воркера в глобале уже есть — читаем его.
const globalRef = globalThis as typeof globalThis & { __env__?: { KV?: KVStore } };

function getKV(event: H3Event): KVStore | null {
  const env = (event.context?.cloudflare?.env ?? globalRef.__env__) as
    | { KV?: KVStore }
    | undefined;
  if (env?.KV) {
    lastKV = env.KV;
    return env.KV;
  }
  return lastKV;
}

export async function kvGetJSON<T>(event: H3Event, key: string): Promise<T | null> {
  const kv = getKV(event);
  if (kv) return kv.get<T>(key, 'json');
  return (mem.get(key) as T) ?? null;
}

export async function kvPutJSON(event: H3Event, key: string, value: unknown, ttl?: number) {
  const kv = getKV(event);
  if (kv) await kv.put(key, JSON.stringify(value), ttl ? { expirationTtl: ttl } : {});
  else mem.set(key, value);
}

export async function kvDelete(event: H3Event, key: string) {
  const kv = getKV(event);
  if (kv) await kv.delete(key);
  else mem.delete(key);
}

/**
 * Все ключи с префиксом (постранично — KV листит по 1000 за раз).
 * Fallback в dev — фильтр по in-memory Map.
 */
export async function kvListKeys(event: H3Event, prefix: string): Promise<string[]> {
  const kv = getKV(event);
  if (kv) {
    const out: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await kv.list({ prefix, cursor });
      out.push(...page.keys.map((k) => k.name));
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return out;
  }
  return [...mem.keys()].filter((k) => k.startsWith(prefix));
}
