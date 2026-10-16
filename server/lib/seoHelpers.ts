// server/lib/seoHelpers.ts
// Единый источник SEO-логики: base URL сайта, robots.txt, sitemap.xml,
// JSON-LD для карточки товара (schema.org/Product).
// Чистые функции без зависимости от nitro-глобалей — покрыты юнит-тестами.
import { getRequestURL } from 'h3';
import type { H3Event } from 'h3';
import type { Product } from './productHelpers';

// nitro объявляет useRuntimeConfig как глобаль; в vitest (окружение node)
// её нет — поэтому проверяем typeof и оборачиваем в try/catch.
declare function useRuntimeConfig(event?: unknown):
  | { public?: { siteUrl?: string } }
  | undefined;

const DEV_FALLBACK = 'http://localhost:3000';

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Базовый URL сайта без завершающего слэша.
 * Приоритет:
 *  1. NUXT_PUBLIC_SITE_URL (env; nitro также маппит его в runtimeConfig.public.siteUrl)
 *  2. runtimeConfig.public.siteUrl (если доступен nitro-контекст)
 *  3. Домен входящего запроса (работает на Cloudflare, но за прокси может быть неточен)
 *  4. http://localhost:3000 (dev-фолбэк)
 * Явная настройка рекомендована: см. README → «SEO».
 */
export function resolveSiteUrl(event: H3Event): string {
  const fromEnv = process.env.NUXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return stripTrailingSlash(fromEnv);

  try {
    if (typeof useRuntimeConfig === 'function') {
      const fromConfig = useRuntimeConfig(event)?.public?.siteUrl?.trim();
      if (fromConfig) return stripTrailingSlash(fromConfig);
    }
  } catch {
    // вне nitro-контекста — идём дальше
  }

  try {
    return stripTrailingSlash(getRequestURL(event).origin);
  } catch {
    // фейковый/неполный event — dev-фолбэк
  }
  return DEV_FALLBACK;
}

/** XML-экранирование для текстовых узлов и атрибутов */
export function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** robots.txt: служебные разделы закрыты, остальное открыто + sitemap */
export function buildRobotsTxt(siteUrl: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /user',
    'Disallow: /cart',
    'Disallow: /favorites',
    'Disallow: /api/',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

/** sitemap.xml: статические страницы + все товары с lastmod */
export function buildSitemapXml(siteUrl: string, products: Product[]): string {
  const staticPages = [
    { loc: '/', changefreq: 'daily', priority: '1.0' },
    { loc: '/news', changefreq: 'weekly', priority: '0.6' },
    { loc: '/about', changefreq: 'monthly', priority: '0.5' },
    { loc: '/contacts', changefreq: 'monthly', priority: '0.5' },
  ];

  const urls: string[] = staticPages.map(
    (p) =>
      `  <url>\n    <loc>${escapeXml(`${siteUrl}${p.loc}`)}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`,
  );

  for (const product of products) {
    if (!product?.slug) continue;
    const lastmod = (product.updatedAt || product.createdAt || '').slice(0, 10);
    urls.push(
      `  <url>\n    <loc>${escapeXml(`${siteUrl}/product/${product.slug}`)}</loc>\n${
        lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''
      }    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    );
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

/** Абсолютный URL изображения: относительные пути склеиваются с siteUrl */
function absoluteImageUrl(src: string | undefined | null, siteUrl: string): string | null {
  if (!src || typeof src !== 'string') return null;
  const trimmed = src.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!trimmed.startsWith('/')) return null; // сторонние схемы (data:, blob:) не годятся для JSON-LD
  return `${siteUrl}${trimmed}`;
}

/**
 * JSON-LD schema.org/Product для карточки товара.
 * Изображения — абсолютные URL, максимум 10 (ограничение Google на массив image).
 * availability: InStock/OutOfStock — с учётом и флага, и остатка на складе.
 */
export function buildProductJsonLd(
  product: Product,
  siteUrl: string,
  currency = 'RUB',
): Record<string, unknown> {
  const images = [product.image, ...(product.gallery ?? [])]
    .map((src) => absoluteImageUrl(src, siteUrl))
    .filter((url): url is string => Boolean(url))
    .slice(0, 10);

  const inStock = product.inStock !== false && (product.stockQuantity ?? 1) > 0;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(product.id != null ? { sku: String(product.id) } : {}),
    ...(images.length ? { image: images } : {}),
    ...(product.categories?.length ? { category: product.categories[0] } : {}),
    offers: {
      '@type': 'Offer',
      url: `${siteUrl}/product/${product.slug}`,
      priceCurrency: currency,
      price: String(product.price),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };
}
