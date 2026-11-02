// Тесты server/lib/storage.ts — регрессия i18n (внутренние $fetch при SSR).
//
// Проблема: SSR-рендер страницы ходит на /api/** внутренним $fetch — h3
// создаёт событие БЕЗ event.context.cloudflare, биндинг KV в нём не виден.
// Раньше такой запрос уходил в пустой in-memory fallback, readProducts
// возвращал сид из бандла (русский каталог без переводных полей), и витрина
// на /en и /es рендерилась по-русски, а в проде — вообще со снапшотом
// каталога на момент сборки вместо живого KV.
// Фикс: globalThis.__env__ (Nitro cloudflare-module кладёт туда env воркера
// на каждом реальном запросе) + память о последнем реальном биндинге.
import { describe, expect, it } from 'vitest';
import type { H3Event } from 'h3';
import { kvGetJSON, kvPutJSON } from '../../server/lib/storage';

type Store = Record<string, unknown>;
type KVLike = {
  get: (key: string, type: 'json') => Promise<unknown>;
  put: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
  list: () => Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
};

function makeKV(data: Store): KVLike {
  return {
    get: async (key: string) => (key in data ? (structuredClone(data[key]) as unknown) : null),
    put: async (key: string, value: string) => {
      data[key] = JSON.parse(value) as unknown;
    },
    delete: async (key: string) => {
      delete data[key];
    },
    list: async () => ({ keys: [], list_complete: true, cursor: undefined }),
  };
}

const translatedCatalog = [{ id: '1', name: 'Смартфон', nameEn: 'Smartphone' }];
type GlobalWithEnv = typeof globalThis & { __env__?: unknown };

// Внутренний $fetch: событие без контекста cloudflare
const bareEvent = {} as H3Event;

describe('storage: KV доступен внутренним $fetch без event.context.cloudflare', () => {
  // Порядок тестов важен: lastKV — module-level состояние, первые тесты
  // должны идти при «чистом» модуле.

  it('без биндингов — in-memory fallback (nuxt dev, unit-тесты)', async () => {
    await kvPutJSON(bareEvent, 'mem-key', { a: 1 });
    expect(await kvGetJSON(bareEvent, 'mem-key')).toEqual({ a: 1 });
  });

  it('globalThis.__env__ от Nitro используется, когда контекста нет (SSR $fetch)', async () => {
    const kv = makeKV({ 'data:products': translatedCatalog });
    (globalThis as GlobalWithEnv).__env__ = { KV: kv };

    const list = await kvGetJSON<unknown>(bareEvent, 'data:products');
    expect(list).toEqual(translatedCatalog);

    delete (globalThis as GlobalWithEnv).__env__;
  });

  it('последний реальный биндинг (lastKV) переживает события без контекста', async () => {
    const kvA = makeKV({ 'data:products': translatedCatalog });
    const eventWithKV = {
      context: { cloudflare: { env: { KV: kvA } } },
    } as unknown as H3Event;

    // Внешний запрос: биндинг из контекста, запоминается в lastKV
    expect(await kvGetJSON<unknown>(eventWithKV, 'data:products')).toEqual(translatedCatalog);

    // Внутренний $fetch без контекста — тот же биндинг, не in-memory
    expect(await kvGetJSON<unknown>(bareEvent, 'data:products')).toEqual(translatedCatalog);
  });

  it('биндинг из контекста события приоритетнее глобального __env__', async () => {
    const kvGlobal = makeKV({ 'k': 'global' });
    const kvLocal = makeKV({ 'k': 'local' });
    (globalThis as GlobalWithEnv).__env__ = { KV: kvGlobal };

    const eventWithKV = {
      context: { cloudflare: { env: { KV: kvLocal } } },
    } as unknown as H3Event;

    expect(await kvGetJSON<unknown>(eventWithKV, 'k')).toBe('local');

    delete (globalThis as GlobalWithEnv).__env__;
  });
});
