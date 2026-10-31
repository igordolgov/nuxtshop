// server/api/news/index.get.ts
// Список новостей (GET /api/news). Публичный: читает KV `data:news`,
// при пустом хранилище отдаёт и самоисцеляет сидом (см. newsHelpers).
// Каждая новость обогащается товарами из каталога (перелинковка):
// productIds → мини-карточки NewsProductCard (attachProducts).
import { attachProducts, readNews, sortNewsDesc } from '../../lib/newsHelpers'
import { readProducts } from '../../lib/productHelpers'

export default defineEventHandler(async (event) => {
  const news = await readNews(event)
  const products = await readProducts(event)
  return { success: true, news: sortNewsDesc(attachProducts(news, products)) }
})
