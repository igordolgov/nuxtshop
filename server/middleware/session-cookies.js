// server/middleware/cors.js
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://192.168.1.1:3000', // Для тестирования в локальной сети
  process.env.SITE_URL,
  process.env.NUXT_PUBLIC_SITE_URL
].filter(Boolean)

const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, PATCH, OPTIONS'
const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Accept, Origin'
const EXPOSED_HEADERS = 'Set-Cookie'
const MAX_AGE = 86400 // 24 часа для preflight кэша

export default defineEventHandler((event) => {
  const origin = getRequestHeader(event, 'origin') || getRequestHeader(event, 'referer')
  
  // Определяем разрешённый origin
  let allowedOrigin = null
  
  if (origin) {
    // Проверяем, есть ли origin в списке разрешённых
    const originUrl = origin.split('/').slice(0, 3).join('/') // Базовый URL без пути
    
    for (const allowed of ALLOWED_ORIGINS) {
      if (allowed === originUrl || originUrl.startsWith(allowed)) {
        allowedOrigin = originUrl
        break
      }
    }
    
    // В development разрешаем все localhost
    if (process.env.NODE_ENV !== 'production') {
      if (originUrl.includes('localhost') || originUrl.includes('127.0.0.1')) {
        allowedOrigin = originUrl
      }
    }
  }
  
  // Если origin не определён (например, прямой запрос), разрешаем
  if (!allowedOrigin && !origin) {
    allowedOrigin = ALLOWED_ORIGINS[0] || '*'
  }
  
  // Устанавливаем CORS заголовки
  const headers = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Expose-Headers': EXPOSED_HEADERS,
    'Access-Control-Max-Age': String(MAX_AGE),
    'Vary': 'Origin' // Важно для кэширования
  }
  
  // Устанавливаем origin только если он определён
  if (allowedOrigin && allowedOrigin !== '*') {
    headers['Access-Control-Allow-Origin'] = allowedOrigin
  }
  
  setResponseHeaders(event, headers)
  
  // Обрабатываем OPTIONS (preflight) запросы
  if (getMethod(event) === 'OPTIONS') {
    setResponseStatus(event, 204, 'No Content')
    return ''
  }
  
  // Продолжаем обработку для других методов
  return
})