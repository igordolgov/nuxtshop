// Тесты server/lib/imageStorage.js — сохранение картинок:
// без биндингов (dev) — прежний data-URI; с KV — ключ img:products/…
// и короткий путь /api/images/<key>; с R2 — приоритет R2 над KV.
import { describe, expect, it, vi } from 'vitest';
import { processImage, processGallery, IMAGE_KV_PREFIX } from '../../server/lib/imageStorage';

const PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('processImage — fallback без биндингов (nuxt dev)', () => {
  it('нет event → data-URI, как раньше', async () => {
    const out = await processImage(undefined as never, PNG_DATA_URI, 'main');
    expect(out.startsWith('data:image/')).toBe(true);
  });

  it('не data-URI → возвращается как есть', async () => {
    const url = 'https://example.com/pic.png';
    expect(await processImage(undefined as never, url)).toBe(url);
    expect(await processImage(undefined as never, undefined as never)).toBeUndefined();
  });
});

describe('processImage — с KV-биндингом (прод без R2)', () => {
  it('кладёт объект в KV под img:<key> и возвращает /api/images/<key>', async () => {
    const put = vi.fn(async () => undefined);
    const event = {
      context: { cloudflare: { env: { KV: { put } } } },
    } as never;
    const out = await processImage(event, PNG_DATA_URI, 'main');

    expect(out).toMatch(/^\/api\/images\/products\/product-\d+-[a-f0-9]{8}\.png$/);
    expect(put).toHaveBeenCalledTimes(1);
    const [key, body, opts] = put.mock.calls[0];
    expect(key).toMatch(
      new RegExp(`^${IMAGE_KV_PREFIX}products/product-\\d+-[a-f0-9]{8}\\.png$`),
    );
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(opts.metadata.contentType).toBe('image/png');
  });

  it('ошибка KV → fallback на data-URI (загрузка не падает)', async () => {
    const event = {
      context: {
        cloudflare: {
          env: {
            KV: {
              put: async () => {
                throw new Error('kv offline');
              },
            },
          },
        },
      },
    } as never;
    const out = await processImage(event, PNG_DATA_URI, 'main');
    expect(out.startsWith('data:image/')).toBe(true);
  });
});

describe('processImage — с R2-биндингом (приоритет R2)', () => {
  it('объект идёт в бакет, а не в KV', async () => {
    const r2put = vi.fn(async () => undefined);
    const kvput = vi.fn(async () => undefined);
    const event = {
      context: {
        cloudflare: { env: { IMAGES_BUCKET: { put: r2put }, KV: { put: kvput } } },
      },
    } as never;
    const out = await processImage(event, PNG_DATA_URI, 'main');

    expect(out).toMatch(/^\/api\/images\/products\/product-\d+-[a-f0-9]{8}\.png$/);
    expect(r2put).toHaveBeenCalledTimes(1);
    const [key, body, opts] = r2put.mock.calls[0];
    expect(key).toMatch(/^products\/product-\d+-[a-f0-9]{8}\.png$/);
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(opts.httpMetadata.contentType).toBe('image/png');
    expect(kvput).not.toHaveBeenCalled();
  });

  it('ошибка R2 → fallback на data-URI (загрузка не падает)', async () => {
    const event = {
      context: {
        cloudflare: {
          env: {
            IMAGES_BUCKET: {
              put: async () => {
                throw new Error('bucket offline');
              },
            },
          },
        },
      },
    } as never;
    const out = await processImage(event, PNG_DATA_URI, 'main');
    expect(out.startsWith('data:image/')).toBe(true);
  });
});

describe('processGallery', () => {
  it('не data-URI пропускает, data-URI сохраняет в KV', async () => {
    const put = vi.fn(async () => undefined);
    const event = {
      context: { cloudflare: { env: { KV: { put } } } },
    } as never;
    const gallery = ['https://example.com/a.jpg', PNG_DATA_URI, ''];
    const out = await processGallery(event, gallery);
    expect(out[0]).toBe('https://example.com/a.jpg');
    expect(out[1]).toMatch(/^\/api\/images\/products\//);
    expect(out).toHaveLength(2); // пустой элемент отброшен
    expect(put).toHaveBeenCalledTimes(1);
  });
});
