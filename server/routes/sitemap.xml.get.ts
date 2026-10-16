// server/routes/sitemap.xml.get.ts
// Динамическая карта сайта: статические страницы + все товары из KV.
// swr 3600: Cloudflare отдаёт кэш и раз в час обновляет в фоне.
import { readProducts } from '../lib/productHelpers';
import { buildSitemapXml, resolveSiteUrl } from '../lib/seoHelpers';

export default defineEventHandler(async (event) => {
  const products = await readProducts(event);
  setHeader(event, 'content-type', 'application/xml; charset=utf-8');
  return buildSitemapXml(resolveSiteUrl(event), products);
});
