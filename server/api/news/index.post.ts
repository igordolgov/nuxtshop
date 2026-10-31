// server/api/news/index.post.ts
// Создание новости (POST /api/news). Только админ.
// Валидация в sanitizeNewsItem (newsHelpers — общая с PUT, покрыта тестами):
// кидает NewsValidationError с сообщением на русском → отдаём как 400.
import {
  NewsValidationError,
  nextNewsId,
  readNews,
  sanitizeNewsItem,
  writeNews,
} from '../../lib/newsHelpers'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const body = await readBody(event)
    const clean = sanitizeNewsItem(body ?? {})

    const news = await readNews(event)
    const item = { id: nextNewsId(news), ...clean }
    news.push(item)
    await writeNews(event, news)

    return { success: true, news: item, message: 'Новость добавлена' }
  } catch (error) {
    if (error instanceof NewsValidationError) {
      throw createError({ statusCode: 400, message: error.message })
    }
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('Ошибка добавления новости:', error)
    throw createError({ statusCode: 500, message: 'Не удалось добавить новость' })
  }
})
