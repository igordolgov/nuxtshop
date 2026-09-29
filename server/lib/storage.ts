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
