// server/middleware/security.ts
// Security-заголовки для всех ответов (SSR-страницы и /api/**).
// CSP с 'unsafe-inline' нужен для инлайн-скрипта темы в <head> и гидрации Vue.
//
// HSTS: сайт доступен только по HTTPS (*.workers.dev отдаёт http 301→https),
// поэтому браузеру можно запретить обращения по http на год.
// includeSubDomains безопасен: поддоменов у nuxt-shop.igordolgov1972.workers.dev
// нет (то же будет верно и для будущего кастомного домена витрины).
// preload сознательно НЕ ставим: домен не отправлен в HSTS-preload-список,
// а это почти невозвратное решение — сначала домен, потом отдельный шаг.

export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy':
      // static.cloudflareinsights.com — Cloudflare Web Analytics (бикон
      // в app.vue); без этого браузер блокирует скрипт аналитики
      // (Best Practices в Lighthouse = 0, данные RUM не собираются).
      "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; object-src 'none'; base-uri 'self'",
  });
});
