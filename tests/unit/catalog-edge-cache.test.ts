// tests/unit/catalog-edge-cache.test.ts
// Edge-кэш витринной выдачи /api/products (Cache API воркера):
// ключ строится только для «чистого» запроса без query, чтение/запись/
// инвалидация молча деградируют без caches.default и на пустом списке.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CATALOG_CACHE_PATH,
  catalogCacheKey,
  catalogCacheKeyForPurge,
  purgeCatalogEdgeCache,
  readCatalogEdgeCache,
  writeCatalogEdgeCache,
  CATALOG_CACHE_TTL_SECONDS,
} from '../../server/lib/catalogEdgeCache';

// ─── Мок Cache API воркера ──────────────────────────────────────────
type Stored = { body: string; cacheControl: string | undefined };
const cacheStore = new Map<string, Stored>();
const fakeCache = {
  match: vi.fn(async (key: string) => {
    const hit = cacheStore.get(String(key));
    if (!hit) return undefined;
    return new Response(hit.body, {
      headers: { 'content-type': 'application/json', 'cache-control': hit.cacheControl ?? '' },
    });
  }),
  put: vi.fn(async (key: string, res: Response) => {
    cacheStore.set(String(key), {
      body: await res.text(),
      cacheControl: res.headers.get('cache-control') ?? undefined,
    });
  }),
  delete: vi.fn(async (key: string) => cacheStore.delete(String(key))),
};

/** Фейковый H3Event: h3 читает event.node.req.headers и event.path. */
function makeEvent(url = '/api/products', host = 'nuxt-shop.example.workers.dev') {
  return {
    node: { req: { url, headers: { host } } },
  } as unknown as Parameters<typeof catalogCacheKey>[0];
}

const installCache = () => {
  (globalThis as { caches?: unknown }).caches = { default: fakeCache };
};
const removeCache = () => {
  delete (globalThis as { caches?: unknown }).caches;
};

beforeEach(() => {
  cacheStore.clear();
  vi.clearAllMocks();
  installCache();
});
afterEach(() => {
  removeCache();
});

describe('catalogCacheKey', () => {
  it('строит канонический ключ для чистого запроса каталога', () => {
    expect(catalogCacheKey(makeEvent('/api/products'))).toBe(
      'https://nuxt-shop.example.workers.dev/api/products',
    );
  });

  it('null при query-параметрах (фильтры/поиск не кэшируем)', () => {
    expect(catalogCacheKey(makeEvent('/api/products?category=cat'))).toBeNull();
    expect(catalogCacheKey(makeEvent('/api/products?limit=20'))).toBeNull();
  });

  it('null для под-путей и других путей', () => {
    expect(catalogCacheKey(makeEvent('/api/products/1'))).toBeNull();
    expect(catalogCacheKey(makeEvent('/api/news'))).toBeNull();
  });

  it('null без host (dev/тест-окружение без заголовка)', () => {
    const ev = { node: { req: { url: '/api/products', headers: {} } } } as unknown as Parameters<
      typeof catalogCacheKey
    >[0];
    expect(catalogCacheKey(ev)).toBeNull();
  });
});

describe('catalogCacheKeyForPurge', () => {
  it('инвалидация сбрасывает выдачу целиком: query не мешает', () => {
    expect(catalogCacheKeyForPurge(makeEvent('/api/products?anything=1'))).toBe(
      'https://nuxt-shop.example.workers.dev/api/products',
    );
    expect(catalogCacheKeyForPurge(makeEvent('/api/products'))).toBe(
      'https://nuxt-shop.example.workers.dev/api/products',
    );
  });
});

describe('readCatalogEdgeCache', () => {
  it('возвращает распарсенный список при попадании', async () => {
    cacheStore.set('https://nuxt-shop.example.workers.dev/api/products', {
      body: JSON.stringify([{ id: '1', price: 100 }]),
      cacheControl: `public, max-age=${CATALOG_CACHE_TTL_SECONDS}`,
    });
    const list = await readCatalogEdgeCache<{ id: string }[]>(makeEvent());
    expect(list).toEqual([{ id: '1', price: 100 }]);
  });

  it('null при промахе', async () => {
    expect(await readCatalogEdgeCache(makeEvent())).toBeNull();
  });

  it('null без Cache API (dev/Node) — деградация в прямой запрос', async () => {
    removeCache();
    expect(await readCatalogEdgeCache(makeEvent())).toBeNull();
  });

  it('null для запроса с query — кэш не читаем', async () => {
    expect(await readCatalogEdgeCache(makeEvent('/api/products?search=x'))).toBeNull();
  });
});

describe('writeCatalogEdgeCache', () => {
  it('кладёт список с TTL в заголовке кэша', async () => {
    await writeCatalogEdgeCache(makeEvent(), [{ id: '1' }, { id: '2' }]);
    expect(fakeCache.put).toHaveBeenCalledTimes(1);
    const stored = cacheStore.get('https://nuxt-shop.example.workers.dev/api/products');
    expect(stored?.body).toBe(JSON.stringify([{ id: '1' }, { id: '2' }]));
    expect(stored?.cacheControl).toBe(`public, max-age=${CATALOG_CACHE_TTL_SECONDS}`);
  });

  it('пустой список не кэшируется (пустая витрина — нештатная выдача)', async () => {
    await writeCatalogEdgeCache(makeEvent(), []);
    expect(fakeCache.put).not.toHaveBeenCalled();
  });

  it('не-массив не кэшируется', async () => {
    await writeCatalogEdgeCache(makeEvent(), { products: [] });
    expect(fakeCache.put).not.toHaveBeenCalled();
  });

  it('с query ничего не кладём', async () => {
    await writeCatalogEdgeCache(makeEvent('/api/products?limit=5'), [{ id: '1' }]);
    expect(fakeCache.put).not.toHaveBeenCalled();
  });
});

describe('purgeCatalogEdgeCache', () => {
  it('удаляет канонический ключ', async () => {
    cacheStore.set('https://nuxt-shop.example.workers.dev/api/products', {
      body: '[]',
      cacheControl: undefined,
    });
    await purgeCatalogEdgeCache(makeEvent('/api/products?any=1'));
    expect(fakeCache.delete).toHaveBeenCalledWith(
      'https://nuxt-shop.example.workers.dev/api/products',
    );
    expect(cacheStore.has('https://nuxt-shop.example.workers.dev/api/products')).toBe(false);
  });
});

describe('константы', () => {
  it('путь кэша — витринная выдача каталога', () => {
    expect(CATALOG_CACHE_PATH).toBe('/api/products');
  });
});
