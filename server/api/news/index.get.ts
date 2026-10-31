// server/api/news/index.get.ts
// Список новостей (GET /api/news). Публичный: читает KV `data:news`,
// при пустом хранилище отдаёт и самоисцеляет сидом (см. newsHelpers).
import { readNews, sortNewsDesc } from '../../lib/newsHelpers'

export default defineEventHandler(async (event) => {
  const news = await readNews(event)
  return { success: true, news: sortNewsDesc(news) }
})
