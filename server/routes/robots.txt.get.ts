// server/routes/robots.txt.get.ts
// Отдаётся как файл на корне сайта. Кэшируется на фронте Cloudflare
// (swr 86400), но пересобирается сервером — sitemap-ссылка всегда актуальна.
import { buildRobotsTxt, resolveSiteUrl } from '../lib/seoHelpers';

export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8');
  return buildRobotsTxt(resolveSiteUrl(event));
});
