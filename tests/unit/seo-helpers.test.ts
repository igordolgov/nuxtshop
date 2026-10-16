// Тесты server/lib/seoHelpers.ts — чистые функции без nitro-глобалей.
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildProductJsonLd,
  buildRobotsTxt,
  buildSitemapXml,
  escapeXml,
  resolveSiteUrl,
} from '../../server/lib/seoHelpers';
import type { Product } from '../../server/lib/productHelpers';

const ENV_BACKUP = process.env.NUXT_PUBLIC_SITE_URL;

afterEach(() => {
  delete (globalThis as Record<string, unknown>).useRuntimeConfig;
  if (ENV_BACKUP === undefined) delete process.env.NUXT_PUBLIC_SITE_URL;
  else process.env.NUXT_PUBLIC_SITE_URL = ENV_BACKUP;
});

const product: Product = {
  id: '7',
  slug: 'kruzhka',
  name: 'Кружка «Космос»',
  description: 'Красная кружка <с сюрпризом>',
  price: 490,
  image: '/images/kruzhka.png',
  gallery: ['/images/kruzhka-2.png', 'https://cdn.example.com/x.png', 'data:image/gif;base64,x'],
  categories: ['посуда'],
  inStock: true,
  stockQuantity: 12,
  characteristics: {},
  createdAt: '2026-01-05T10:00:00.000Z',
  updatedAt: '2026-03-20T10:00:00.000Z',
};

describe('resolveSiteUrl — приоритеты источника', () => {
  it('1) env NUXT_PUBLIC_SITE_URL побеждает всё', () => {
    process.env.NUXT_PUBLIC_SITE_URL = 'https://shop.ru/';
    (globalThis as Record<string, unknown>).useRuntimeConfig = () => ({
      public: { siteUrl: 'https://cfg.example' },
    });
    expect(resolveSiteUrl({} as never)).toBe('https://shop.ru');
  });

  it('2) runtimeConfig.public.siteUrl — если env не задан', () => {
    (globalThis as Record<string, unknown>).useRuntimeConfig = () => ({
      public: { siteUrl: 'https://cfg.example/' },
    });
    expect(resolveSiteUrl({} as never)).toBe('https://cfg.example');
  });

  it('3) домен запроса — из host-заголовка фейкового event', () => {
    const fakeEvent = {
      path: '/',
      node: { req: { headers: { host: 'shop.example' }, originalUrl: '/' } },
    } as never;
    expect(resolveSiteUrl(fakeEvent)).toBe('http://shop.example');
  });

  it('4) полный фолбэк localhost, если ничего не доступно', () => {
    expect(resolveSiteUrl({} as never)).toBe('http://localhost:3000');
  });

  it('завершающие слэши срезаются у любого источника', () => {
    process.env.NUXT_PUBLIC_SITE_URL = 'https://shop.ru///';
    expect(resolveSiteUrl({} as never)).toBe('https://shop.ru');
  });
});

describe('buildRobotsTxt', () => {
  it('закрывает служебные разделы и открывает остальное', () => {
    const robots = buildRobotsTxt('https://shop.ru');
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Disallow: /user');
    expect(robots).toContain('Disallow: /cart');
    expect(robots).toContain('Disallow: /api/');
  });

  it('ссылается на sitemap по базовому URL', () => {
    expect(buildRobotsTxt('https://shop.ru')).toContain('Sitemap: https://shop.ru/sitemap.xml');
  });
});

describe('buildSitemapXml', () => {
  it('валидная шапка и статические страницы', () => {
    const xml = buildSitemapXml('https://shop.ru', []);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain('<loc>https://shop.ru/</loc>');
    expect(xml).toContain('<loc>https://shop.ru/about</loc>');
    expect(xml).toContain('<loc>https://shop.ru/contacts</loc>');
    expect(xml).toContain('<loc>https://shop.ru/news</loc>');
  });

  it('товары со slug и lastmod из updatedAt', () => {
    const xml = buildSitemapXml('https://shop.ru', [product]);
    expect(xml).toContain('<loc>https://shop.ru/product/kruzhka</loc>');
    expect(xml).toContain('<lastmod>2026-03-20</lastmod>');
  });

  it('товар без slug пропускается; lastmod падает на createdAt', () => {
    const xml = buildSitemapXml('https://shop.ru', [
      { ...product, slug: '', updatedAt: '' },
      { ...product, slug: 'drugoy', updatedAt: '' },
    ]);
    expect(xml).not.toContain('product/kruzhka'); // пустой slug пропущен
    expect(xml).toContain('<loc>https://shop.ru/product/drugoy</loc>');
    expect(xml).toContain('<lastmod>2026-01-05</lastmod>');
  });

  it('XML-экранирование: & в URL превращается в &amp;', () => {
    const xml = buildSitemapXml('https://shop.ru/utm?a=1&b=2', []);
    expect(xml).toContain('https://shop.ru/utm?a=1&amp;b=2');
  });
});

describe('buildProductJsonLd', () => {
  it('базовая структура Product + Offer', () => {
    const ld = buildProductJsonLd(product, 'https://shop.ru');
    expect(ld['@context']).toBe('https://schema.org');
    expect(ld['@type']).toBe('Product');
    expect(ld.name).toBe('Кружка «Космос»');
    expect(ld.sku).toBe('7');
    const offers = ld.offers as Record<string, unknown>;
    expect(offers['@type']).toBe('Offer');
    expect(offers.url).toBe('https://shop.ru/product/kruzhka');
    expect(offers.priceCurrency).toBe('RUB');
    expect(offers.price).toBe('490'); // строка, как требует schema.org
  });

  it('изображения становятся абсолютными; data:-схемы отбрасываются', () => {
    const ld = buildProductJsonLd(product, 'https://shop.ru');
    expect(ld.image).toEqual([
      'https://shop.ru/images/kruzhka.png',
      'https://shop.ru/images/kruzhka-2.png',
      'https://cdn.example.com/x.png',
    ]);
  });

  it('лимит 10 изображений (ограничение Google)', () => {
    const many = buildProductJsonLd(
      { ...product, gallery: Array.from({ length: 15 }, (_, i) => `/img/${i}.png`) },
      'https://shop.ru',
    );
    expect((many.image as string[]).length).toBe(10);
  });

  it('наличие: inStock + остаток > 0 → InStock', () => {
    const offers = buildProductJsonLd(product, 'https://shop.ru').offers as Record<string, unknown>;
    expect(offers.availability).toBe('https://schema.org/InStock');
  });

  it('наличие: inStock=false ИЛИ остаток 0 → OutOfStock', () => {
    const off = buildProductJsonLd({ ...product, inStock: false }, 'https://shop.ru')
      .offers as Record<string, unknown>;
    expect(off.availability).toBe('https://schema.org/OutOfStock');

    const empty = buildProductJsonLd({ ...product, stockQuantity: 0 }, 'https://shop.ru')
      .offers as Record<string, unknown>;
    expect(empty.availability).toBe('https://schema.org/OutOfStock');
  });
});

describe('escapeXml', () => {
  it('экранирует все пять спецсимволов XML', () => {
    expect(escapeXml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&apos;');
  });
});
