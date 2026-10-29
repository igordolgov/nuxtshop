// Тесты server/lib/imageStorage.js — сохранение картинок:
// без R2-биндинга (dev) — прежний data-URI; с R2 — ключ в бакете и
// короткий путь /api/images/<key>.
import { describe, expect, it, vi } from 'vitest';
import { processImage, processGallery } from '../../server/lib/imageStorage';

const PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('processImage — fallback без R2 (nuxt dev)', () => {
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

describe('processImage — с R2-биндингом', () => {
  it('кладёт объект в бакет и возвращает /api/images/<key>', async () => {
    const put = vi.fn(async () => undefined);
    const event = {
      context: { cloudflare: { env: { IMAGES_BUCKET: { put } } } },
    } as never;
    const out = await processImage(event, PNG_DATA_URI, 'main');

    expect(out).toMatch(/^\/api\/images\/products\/product-\d+-[a-f0-9]{8}\.png$/);
    expect(put).toHaveBeenCalledTimes(1);
    const [key, body, opts] = put.mock.calls[0];
    expect(key).toMatch(/^products\/product-\d+-[a-f0-9]{8}\.png$/);
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(opts.httpMetadata.contentType).toBe('image/png');
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
  it('не data-URI пропускает, data-URI сохраняет', async () => {
    const gallery = ['https://example.com/a.jpg', PNG_DATA_URI, ''];
    const out = await processGallery(undefined as never, gallery);
    expect(out[0]).toBe('https://example.com/a.jpg');
    expect(out[1].startsWith('data:image/')).toBe(true);
    expect(out).toHaveLength(2); // пустой элемент отброшен
  });
});
