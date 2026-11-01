// server/lib/storage.ts
/**
 * Доступ к Workers KV через event.context.cloudflare.env.
 * В `nuxt dev` биндингов нет — in-memory fallback.
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

function getKV(event: H3Event): KVStore | null {
  return (event.context.cloudflare?.env as { KV?: KVStore } | undefined)?.KV ?? null;
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
