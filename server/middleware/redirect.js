// server/middleware/redirect.js
import { readFileSync } from 'fs'
import { join } from 'path'

// Кэш продуктов для редиректов (обновляется каждые N секунд)
let productsCache = null
let cacheTime = 0
const CACHE_TTL = 60000 // 1 минута

/**
 * Получает продукты с кэшированием
 */
function getProductsForRedirect() {
  const now = Date.now()
  
  if (productsCache && (now - cacheTime < CACHE_TTL)) {
    return productsCache
  }
  
  try {
    const productsPath = join(process.cwd(), 'server', 'data', 'products.json')
    const data = readFileSync(productsPath, 'utf-8')
    productsCache = JSON.parse(data) || []
    cacheTime = now
    return productsCache
  } catch (error) {
    console.error('❌ Ошибка чтения products.json:', error.message)
    return []
  }
}

/**
 * Карта редиректов для статических маршрутов
 */
const STATIC_REDIRECTS = {
  // Старые категории
  '/catalog': '/products',
  '/shop': '/products',
  '/store': '/products',
  
  // Старые страницы
  '/about-us': '/about',
  '/contacts': '/contact',
  '/cart.php': '/cart',
  '/checkout.php': '/checkout',
  
  // Удалённые страницы
  '/old-promo': '/promotions'
}

export default defineEventHandler(async (event) => {
  const url = event.node.req.url
  const pathname = url.split('?')[0].split('#')[0]
  
  // 1. Проверяем статические редиректы
  const staticRedirect = STATIC_REDIRECTS[pathname]
  if (staticRedirect) {
    console.log(`↗️ Редирект: ${pathname} → ${staticRedirect}`)
    return sendRedirect(event, staticRedirect, 301)
  }
  
  // 2. Редирект со старых URL товаров с числовым ID
  const oldProductMatch = pathname.match(/^\/product\/(\d+)$/)
  
  if (oldProductMatch) {
    const id = oldProductMatch[1]
    
    try {
      const products = getProductsForRedirect()
      
      // Ищем по ID (строка или число)
      const product = products.find(p => 
        String(p.id) === id || p.id === Number(id)
      )
      
      if (product?.slug) {
        const newUrl = `/product/${product.slug}`
        console.log(`↗️ Редирект товара: /product/${id} → ${newUrl}`)
        return sendRedirect(event, newUrl, 301)
      }
      
      // Товар не найден - редирект на каталог
      console.log(`↗️ Товар #${id} не найден, редирект на /products`)
      return sendRedirect(event, '/products', 302)
      
    } catch (error) {
      console.error('❌ Ошибка редиректа:', error.message)
    }
  }
  
  // 3. Редирект со старых URL категорий (если были числовые)
  const oldCategoryMatch = pathname.match(/^\/category\/(\d+)$/)
  
  if (oldCategoryMatch) {
    // Можно добавить логику для категорий
    console.log(`↗️ Редирект категории: ${pathname} → /products`)
    return sendRedirect(event, '/products', 301)
  }
  
  // 4. Убираем trailing slash (кроме корня)
  if (pathname !== '/' && pathname.endsWith('/')) {
    const newUrl = pathname.slice(0, -1) + url.slice(pathname.length)
    console.log(`↗️ Убираем trailing slash: ${pathname} → ${newUrl}`)
    return sendRedirect(event, newUrl, 301)
  }
  
  // 5. Редирект на нижний регистр (кроме API и статики)
  if (pathname !== pathname.toLowerCase() && 
      !pathname.startsWith('/api/') && 
      !pathname.startsWith('/_') &&
      !pathname.includes('.')) {
    const newUrl = pathname.toLowerCase() + url.slice(pathname.length)
    console.log(`↗️ Редирект в нижний регистр: ${pathname} → ${newUrl}`)
    return sendRedirect(event, newUrl, 301)
  }
  
  // Продолжаем обработку
  return
})