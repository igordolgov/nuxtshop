// server/middleware/redirect.js
// Серверный middleware: редиректы старых URL, товара с числовым ID на slug,
// срез trailing slash, приведение путей к нижнему регистру.
// Кроссплатформенно: без fs (на Cloudflare Workers его нет) —
// товары читаются из KV через productHelpers.

import { readProducts } from '../lib/productHelpers'

/**
 * Товары для редиректов /product/<id>. Раньше здесь был собственный
 * module-scope кэш с TTL — теперь общая логика живёт в cache.ts, а
 * readProducts уже кэширован (один запрос KV за TTL на изолят).
 */
async function getProductsForRedirect(event) {
  try {
    const products = await readProducts(event)
    return Array.isArray(products) ? products : []
  } catch (error) {
    // KV недоступен — редиректы товаров деградируют, запрос не ломаем
    console.error('❌ Ошибка чтения товаров для редиректов:', error.message)
    return []
  }
}

/**
 * Карта редиректов статических маршрутов.
 * ⚙️ НАСТРОЙКА: цель редиректа обязана существовать как страница!
 * Каталог в проекте — главная '/'; страниц /products, /checkout, /contact,
 * /promotions НЕТ (проверено по app/pages). Не возвращать их в карту.
 */
const STATIC_REDIRECTS = {
  // Старые категории → каталог (главная)
  '/catalog': '/',
  '/shop': '/',
  '/store': '/',

  // Старые страницы
  '/about-us': '/about',
  '/cart.php': '/cart',
  '/checkout.php': '/cart/checkout',

  // ⚠️ Умышленно удалены:
  // '/contacts': '/contact' — страница /contact не существует,
  //   редирект уводил пользователей с живой страницы /contacts в 404;
  // '/old-promo': '/promotions' — страницы /promotions не существует.
}

export default defineEventHandler(async (event) => {
  // event.path вместо event.node.req.url — работает на любом рантайме Nitro
  const pathname = event.path.split('?')[0].split('#')[0]

  // 1. Статические редиректы
  const staticRedirect = STATIC_REDIRECTS[pathname]
  if (staticRedirect) {
    console.log(`↗️ Редирект: ${pathname} → ${staticRedirect}`)
    return sendRedirect(event, staticRedirect, 301)
  }

  // 2. Старые URL товаров с числовым ID → slug из KV
  const oldProductMatch = pathname.match(/^\/product\/(\d+)$/)

  if (oldProductMatch) {
    const id = oldProductMatch[1]

    const products = await getProductsForRedirect(event)
    const product = products.find((p) => String(p.id) === id || p.id === Number(id))

    if (product?.slug) {
      const newUrl = `/product/${product.slug}`
      console.log(`↗️ Редирект товара: /product/${id} → ${newUrl}`)
      return sendRedirect(event, newUrl, 301)
    }

    // Товар не найден — на каталог (главную), 302: возможно, появится позже
    console.log(`↗️ Товар #${id} не найден, редирект на /`)
    return sendRedirect(event, '/', 302)
  }

  // 3. Срез trailing slash (кроме корня) — канонизация URL
  if (pathname !== '/' && pathname.endsWith('/')) {
    const newUrl = pathname.slice(0, -1) + event.path.slice(pathname.length)
    console.log(`↗️ Срез trailing slash: ${pathname} → ${newUrl}`)
    return sendRedirect(event, newUrl, 301)
  }

  // 4. Нижний регистр (кроме API, внутренних путей и файлов со статикой)
  if (
    pathname !== pathname.toLowerCase() &&
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/_') &&
    !pathname.includes('.')
  ) {
    const newUrl = pathname.toLowerCase() + event.path.slice(pathname.length)
    console.log(`↗️ Приведение к нижнему регистру: ${pathname} → ${newUrl}`)
    return sendRedirect(event, newUrl, 301)
  }

  // Продолжаем обработку обычным конвейером Nitro
  return
})