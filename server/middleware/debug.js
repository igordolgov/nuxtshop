// server/middleware/debug.js
export default defineEventHandler((event) => {
  console.log('🛣️  [MIDDLEWARE] Запрос:', event.node.req.url)
  console.log('🛣️  [MIDDLEWARE] Метод:', event.node.req.method)
  
  // Для запросов к товарам
  if (event.node.req.url.startsWith('/api/products/')) {
    console.log('🛣️  [MIDDLEWARE] Запрос товара:', event.node.req.url)
  }
})