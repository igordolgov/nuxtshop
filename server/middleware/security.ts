
// server/middleware/security.ts/**
//  * Security-заголовки для всех ответов.
//  * CSP с 'unsafe-inline' нужен для инлайн-скрипта темы в <head> и гидрации Vue.
//  */

export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy':
      "script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'",
  })
})