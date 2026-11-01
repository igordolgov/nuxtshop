// server/api/news/index.get.ts
// Список новостей (GET /api/news). Публичный: читает KV `data:news`,
// при пустом хранилище отдаёт и самоисцеляет сидом (см. newsHelpers).
// Каждая новость обогащается товарами из каталога (перелинковка):
// productIds → мини-карточки NewsProductCard (attachProducts).
// ?all=1 — только для админа (401 остальным): вернуть и черновики,
// это кормит список AdminNews (публичная витрина фильтрует их всегда).
import { attachProducts, publishedNews, readNews, sortNewsDesc } from '../../lib/newsHelpers'
import { readProducts } from '../../lib/productHelpers'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const wantAll = query.all === '1' || query.all === 'true'
  if (wantAll) {
    await requireAdmin(event)
  }

  const news = await readNews(event)
  const products = await readProducts(event)
  // Черновики (published === false) — только в админке (all=1), витрина их не видит
  const visible = wantAll ? news : publishedNews(news)
  return { success: true, news: sortNewsDesc(attachProducts(visible, products)) }
})
