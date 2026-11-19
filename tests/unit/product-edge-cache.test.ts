// tests/unit/product-edge-cache.test.ts
// Edge-кэш витринного ответа карточки /api/product/<slug> (Cache API
// воркера): ключ для анонимов с канонизацией ?lang (en/es), залогиненные
// мимо кэша, ответы без товара не кэшируются, деградация без caches.default.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PRODUCT_CARD_CACHE_PATH,
  PRODUCT_CARD_CACHE_TTL_SECONDS,
  productCardCacheKey,
  readProductCardEdgeCache,
  writeProductCardEdgeCache,
} from '../../server/lib/productEdgeCache';

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
function makeEvent(
  url = '/api/product/smartfon-x',
  host = 'nuxt-shop.example.workers.dev',
  cookie?: string,
) {
  return {
    node: { req: { url, headers: { host, ...(cookie ? { cookie } : {}) } } },
  } as unknown as Parameters<typeof productCardCacheKey>[0];
}

const installCache = () => {
  (globalThis as { caches?: unknown }).caches = { default: fakeCache };
};
const removeCache = () => {
  delete (globalThis as { caches?: unknown }).caches;
};

const payload = () => ({
  success: true,
  product: { id: '1', slug: 'smartfon-x', price: 999 },
  boughtTogether: [],
  similarProducts: [],
  reviews: [],
  ratingSummary: { count: 0, average: 0 },
  jsonLd: {},
});

beforeEach(() => {
  cacheStore.clear();
  vi.clearAllMocks();
  installCache();
});
afterEach(() => {
  removeCache();
});

describe('productCardCacheKey', () => {
  it('строит канонический ключ по slug', () => {
    expect(productCardCacheKey(makeEvent(), 'smartfon-x')).toBe(
      'https://nuxt-shop.example.workers.dev/api/product/smartfon-x',
    );
  });

  it('?lang=en|es — своя копия (локализованный JSON-LD)', () => {
    expect(productCardCacheKey(makeEvent('/api/product/x?lang=en'), 'x')).toBe(
      'https://nuxt-shop.example.workers.dev/api/product/x?lang=en',
    );
    expect(productCardCacheKey(makeEvent('/api/product/x?lang=es'), 'x')).toBe(
      'https://nuxt-shop.example.workers.dev/api/product/x?lang=es',
    );
  });

  it('?lang=ru и прочие значения канонизируются в одну копию без суффикса', () => {
    expect(productCardCacheKey(makeEvent('/api/product/x?lang=ru'), 'x')).toBe(
      'https://nuxt-shop.example.workers.dev/api/product/x',
    );
    expect(productCardCacheKey(makeEvent('/api/product/x?lang=zz'), 'x')).toBe(
      'https://nuxt-shop.example.workers.dev/api/product/x',
    );
  });

  it('посторонний query не попадает в ключ (ответ от него не зависит)', () => {
    expect(productCardCacheKey(makeEvent('/api/product/x?utm=1'), 'x')).toBe(
      'https://nuxt-shop.example.workers.dev/api/product/x',
    );
  });

  it('null для не-карточечных путей', () => {
    expect(productCardCacheKey(makeEvent('/api/products'), 'x')).toBeNull();
    expect(productCardCacheKey(makeEvent('/api/news'), 'x')).toBeNull();
  });

  it('null без host или без slug (dev/тест-окружение)', () => {
    const noHost = {
      node: { req: { url: '/api/product/x', headers: {} } },
    } as unknown as Parameters<typeof productCardCacheKey>[0];
    expect(productCardCacheKey(noHost, 'x')).toBeNull();
    expect(productCardCacheKey(makeEvent(), '')).toBeNull();
  });
});

describe('readProductCardEdgeCache', () => {
  it('возвращает распарсенный ответ при попадании', async () => {
    cacheStore.set('https://nuxt-shop.example.workers.dev/api/product/smartfon-x', {
      body: JSON.stringify(payload()),
      cacheControl: `public, max-age=${PRODUCT_CARD_CACHE_TTL_SECONDS}`,
    });
    const card = await readProductCardEdgeCache<{ product: { slug: string } }>(
      makeEvent(),
      'smartfon-x',
    );
    expect(card?.product.slug).toBe('smartfon-x');
  });

  it('null при промахе', async () => {
    expect(await readProductCardEdgeCache(makeEvent(), 'net-takogo')).toBeNull();
  });

  it('null без Cache API (dev/Node) — деградация в прямой запрос', async () => {
    removeCache();
    expect(await readProductCardEdgeCache(makeEvent(), 'smartfon-x')).toBeNull();
  });

  it('залогиненный (кука user_session) мимо кэша — ответ персональный', async () => {
    cacheStore.set('https://nuxt-shop.example.workers.dev/api/product/smartfon-x', {
      body: JSON.stringify(payload()),
      cacheControl: undefined,
    });
    const ev = makeEvent(
      '/api/product/smartfon-x',
      'nuxt-shop.example.workers.dev',
      'user_session=t',
    );
    expect(await readProductCardEdgeCache(ev, 'smartfon-x')).toBeNull();
  });

  it('с ?lang=en читается своя копия, а не каноническая', async () => {
    cacheStore.set('https://nuxt-shop.example.workers.dev/api/product/x?lang=en', {
      body: JSON.stringify({ ...payload(), product: { id: '1', slug: 'x', price: 1 } }),
      cacheControl: undefined,
    });
    const card = await readProductCardEdgeCache<{ product: { price: number } }>(
      makeEvent('/api/product/x?lang=en'),
      'x',
    );
    expect(card?.product.price).toBe(1);
  });
});

describe('writeProductCardEdgeCache', () => {
  it('кладёт ответ с TTL в заголовке кэша', async () => {
    await writeProductCardEdgeCache(makeEvent(), 'smartfon-x', payload());
    expect(fakeCache.put).toHaveBeenCalledTimes(1);
    const stored = cacheStore.get('https://nuxt-shop.example.workers.dev/api/product/smartfon-x');
    expect(stored?.cacheControl).toBe(`public, max-age=${PRODUCT_CARD_CACHE_TTL_SECONDS}`);
    expect(JSON.parse(stored?.body ?? '{}').product.slug).toBe('smartfon-x');
  });

  it('ответ без товара (404-путь) не кэшируется', async () => {
    await writeProductCardEdgeCache(makeEvent(), 'net-takogo', { success: false });
    expect(fakeCache.put).not.toHaveBeenCalled();
  });

  it('не-объект не кэшируется', async () => {
    await writeProductCardEdgeCache(makeEvent(), 'smartfon-x', 'garbage');
    expect(fakeCache.put).not.toHaveBeenCalled();
  });

  it('залогиненный (кука user_session) не пишется в кэш', async () => {
    const ev = makeEvent(
      '/api/product/smartfon-x',
      'nuxt-shop.example.workers.dev',
      'user_session=t',
    );
    await writeProductCardEdgeCache(ev, 'smartfon-x', payload());
    expect(fakeCache.put).not.toHaveBeenCalled();
    expect(cacheStore.size).toBe(0);
  });
});

describe('константы', () => {
  it('путь кэша — префикс карточки товара', () => {
    expect(PRODUCT_CARD_CACHE_PATH).toBe('/api/product/');
  });

  it('TTL — окно устаревания витрины не больше KV-окна консистентности', () => {
    expect(PRODUCT_CARD_CACHE_TTL_SECONDS).toBe(30);
    expect(PRODUCT_CARD_CACHE_TTL_SECONDS).toBeLessThanOrEqual(60);
  });
});
