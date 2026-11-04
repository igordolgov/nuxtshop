// Тесты server/utils/imgTransform.ts — валидация query роута-трансформатора
// /img и построение опций cf.image. Роут на Cloudflare недоступен в тестах,
// поэтому проверяется чистая логика: SSRF-защита, белый список параметров,
// маппинг fit в термины cf.image.
import { describe, expect, it } from 'vitest';
import { buildCfImageOptions, parseImageTransformQuery } from '../../server/utils/imgTransform';

describe('parseImageTransformQuery — валидные запросы', () => {
  it('минимальный запрос: только src, quality по умолчанию 75', () => {
    const parsed = parseImageTransformQuery({ src: '/images/products/photo-1-abc.webp' });
    expect(parsed).toEqual({
      ok: true,
      params: { src: '/images/products/photo-1-abc.webp', quality: 75 },
    });
  });

  it('полный запрос: все параметры на месте', () => {
    const parsed = parseImageTransformQuery({
      src: '/api/images/products/product-1-2.webp',
      w: '400',
      h: '300',
      q: '80',
      f: 'avif',
      fit: 'cover',
    });
    expect(parsed).toEqual({
      ok: true,
      params: {
        src: '/api/images/products/product-1-2.webp',
        width: 400,
        height: 300,
        quality: 80,
        format: 'avif',
        fit: 'cover',
      },
    });
  });

  it('массив вместо строки: берётся первое значение (query h3)', () => {
    const parsed = parseImageTransformQuery({ src: ['/images/products/a.webp'], w: ['200'] });
    expect(parsed).toEqual({
      ok: true,
      params: { src: '/images/products/a.webp', width: 200, quality: 75 },
    });
  });

  it('fit маппится в термины cf.image: fill→scale-down, outside→crop, inside→pad', () => {
    for (const [nuxt, cf] of [
      ['fill', 'scale-down'],
      ['outside', 'crop'],
      ['inside', 'pad'],
      ['contain', 'contain'],
      ['scale-down', 'scale-down'],
    ] as const) {
      const parsed = parseImageTransformQuery({ src: '/images/products/a.webp', fit: nuxt });
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(parsed.params.fit).toBe(cf);
    }
  });
});

describe('parseImageTransformQuery — SSRF и мусор в src', () => {
  it.each([
    ['отсутствует', {}],
    ['внешний URL', { src: 'https://evil.example/x.webp' }],
    ['protocol-relative', { src: '//evil.example/x.webp' }],
    ['не начинается со слэша', { src: 'images/products/a.webp' }],
    ['процент-энкодинг', { src: '/images/products/%2e%2e/a.webp' }],
    ['подъём по пути', { src: '/images/products/../.env' }],
    ['запрещённый префикс', { src: '/api/orders/list' }],
    ['служебный префикс бандла', { src: '/_nuxt/entry.abc.js' }],
    ['недопустимые символы', { src: '/images/products/a b.webp' }],
    ['слишком длинный', { src: `/${'a'.repeat(600)}.webp` }],
  ])('%s — отклоняется', (_name, query) => {
    const parsed = parseImageTransformQuery(query);
    expect(parsed.ok).toBe(false);
  });

  it('корень и выход за префиксы картинок не проходят', () => {
    expect(parseImageTransformQuery({ src: '/' }).ok).toBe(false);
    expect(parseImageTransformQuery({ src: '/images/products/' }).ok).toBe(true);
  });
});

describe('parseImageTransformQuery — лимиты и белый список параметров', () => {
  it.each([
    ['w = 0', { w: '0' }],
    ['w = 2001', { w: '2001' }],
    ['w не число', { w: '4oo' }],
    ['h = 0', { h: '0' }],
    ['q = 0', { q: '0' }],
    ['q = 101', { q: '101' }],
    ['f = gif', { f: 'gif' }],
    ['f = auto', { f: 'auto' }],
    ['fit = zoom', { fit: 'zoom' }],
    ['неизвестный параметр', { format: 'webp' }],
  ])('%s — отклоняется', (_name, extra) => {
    const parsed = parseImageTransformQuery({ src: '/images/products/a.webp', ...extra });
    expect(parsed.ok).toBe(false);
  });
});

describe('buildCfImageOptions', () => {
  it('передаёт только заданное, quality всегда присутствует', () => {
    expect(buildCfImageOptions({ src: '/a.webp', quality: 75 })).toEqual({ quality: 75 });
    expect(
      buildCfImageOptions({
        src: '/a.webp',
        quality: 80,
        width: 400,
        height: 300,
        format: 'webp',
        fit: 'cover',
      }),
    ).toEqual({ quality: 80, width: 400, height: 300, format: 'webp', fit: 'cover' });
  });
});
