// server/lib/seoHelpers.ts
// Единый источник SEO-логики: base URL сайта, robots.txt, sitemap.xml,
// JSON-LD для карточки товара (schema.org/Product).
// Чистые функции без зависимости от nitro-глобалей — покрыты юнит-тестами.
import { getRequestURL } from 'h3';
import type { H3Event } from 'h3';
import type { Product } from './productHelpers';
// Реестр локалей sitemap — из store.config (см. SITEMAP_LOCALES ниже)
import { STORE_DEFAULT_LOCALE, STORE_LOCALES } from '../../store.config';

// nitro объявляет useRuntimeConfig как глобаль; в vitest (окружение node)
// её нет — поэтому проверяем typeof и оборачиваем в try/catch.
declare function useRuntimeConfig(event?: unknown): { public?: { siteUrl?: string } } | undefined;

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

/** robots.txt: служебные разделы закрыты, остальное открыто + sitemap.
 *  Дубли со звёздочкой-шаблоном ("звезда-слэш-admin") закрывают локализованные
 *  префиксы (/en/admin, /es/cart …): в robots.txt шаблон поддерживается. */
export function buildRobotsTxt(siteUrl: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /admin/',
    'Disallow: /*/admin',
    'Disallow: /user',
    'Disallow: /cart',
    'Disallow: /favorites',
    'Disallow: /*/user',
    'Disallow: /*/cart',
    'Disallow: /*/favorites',
    'Disallow: /api/',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

// Локали витрины для hreflang-альтернатов в sitemap: код + URL-префикс.
// ВЫВОДИТСЯ из store.config (STORE_LOCALES/STORE_DEFAULT_LOCALE), а не
// захардкожено: кубинская копия объявляет STORE_LOCALES = ['es', 'en'] —
// в её sitemap русского нет вовсе (как и в i18n.locales nuxt.config —
// оба реестра из одного источника, разъехаться не могут).
const SITEMAP_LOCALES: Array<{ code: string; prefix: string }> = STORE_LOCALES.map((code) => ({
  code,
  // Дефолтная локаль без префикса (strategy prefix_except_default)
  prefix: code === STORE_DEFAULT_LOCALE ? '' : `/${code}`,
}));

/**
 * Блок <xhtml:link rel="alternate"> для одного пути: по записи на каждую
 * локаль + x-default (дефолтная локаль store.config). Путь — канонический
 * путь в дефолтной локали:
 * '/' → ru: site, en: site/en, es: site/es; '/product/x' → '/en/product/x' …
 */
export function sitemapAlternatesXml(siteUrl: string, path: string): string {
  const tail = path === '/' ? '' : path;
  const lines = [
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(`${siteUrl}${tail}`)}"/>`,
  ];
  for (const { code, prefix } of SITEMAP_LOCALES) {
    lines.push(
      `    <xhtml:link rel="alternate" hreflang="${code}" href="${escapeXml(`${siteUrl}${prefix}${tail}`)}"/>`,
    );
  }
  return lines.join('\n');
}

/** sitemap.xml: статические страницы + все товары с lastmod.
 *  Для каждого URL — hreflang-альтернаты по локалям store.config
 *  (RU-витрина: ru/en/es, x-default → ru; на копии ru нет вовсе). */
export function buildSitemapXml(siteUrl: string, products: Product[]): string {
  const staticPages = [
    { loc: '/', changefreq: 'daily', priority: '1.0' },
    { loc: '/news', changefreq: 'weekly', priority: '0.6' },
    { loc: '/about', changefreq: 'monthly', priority: '0.5' },
    { loc: '/contacts', changefreq: 'monthly', priority: '0.5' },
  ];

  const urls: string[] = staticPages.map(
    (p) =>
      `  <url>\n    <loc>${escapeXml(`${siteUrl}${p.loc}`)}</loc>\n${sitemapAlternatesXml(siteUrl, p.loc)}\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`,
  );

  for (const product of products) {
    if (!product?.slug) continue;
    const lastmod = (product.updatedAt || product.createdAt || '').slice(0, 10);
    const productPath = `/product/${product.slug}`;
    urls.push(
      `  <url>\n    <loc>${escapeXml(`${siteUrl}${productPath}`)}</loc>\n${sitemapAlternatesXml(siteUrl, productPath)}\n${
        lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''
      }    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    );
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
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
 * rating — сводка одобренных отзывов: при наличии добавляет aggregateRating
 * (звёзды rich-snippet в выдаче; без отзывов блок не ставится).
 */
export function buildProductJsonLd(
  product: Product,
  siteUrl: string,
  currency = 'RUB',
  rating?: { count: number; average: number } | null,
  // localePrefix: канонический URL offers.url строится с префиксом локали
  // (/en/product/…), чтобы canonical совпадал с языком SSR-HTML; ru — без
  // префикса (strategy prefix_except_default)
  opts?: { localePrefix?: string },
): Record<string, unknown> {
  const prefix = opts?.localePrefix && opts.localePrefix !== 'ru' ? `/${opts.localePrefix}` : '';
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
      url: `${siteUrl}${prefix}/product/${product.slug}`,
      priceCurrency: currency,
      price: String(product.price),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
    ...(rating && rating.count > 0 && rating.average > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: String(rating.average),
            reviewCount: rating.count,
            bestRating: '5',
            worstRating: '1',
          },
        }
      : {}),
  };
}
