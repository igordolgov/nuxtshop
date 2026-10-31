// server/api/news/[id].put.ts
// Редактирование новости (PUT /api/news/:id). Только админ.
// sanitizeNewsItem — общая с POST (newsHelpers); id из маршрута.
import {
  NewsValidationError,
  readNews,
  sanitizeNewsItem,
  writeNews,
} from '../../lib/newsHelpers'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const id = getRouterParam(event, 'id')
    const news = await readNews(event)
    const item = news.find((n) => String(n.id) === String(id))
    if (!item) {
      throw createError({ statusCode: 404, message: 'Новость не найдена' })
    }

    const body = await readBody(event)
    const clean = sanitizeNewsItem(body ?? {})
    Object.assign(item, clean)
    await writeNews(event, news)

    return { success: true, news: item, message: 'Новость обновлена' }
  } catch (error) {
    if (error instanceof NewsValidationError) {
      throw createError({ statusCode: 400, message: error.message })
    }
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('Ошибка обновления новости:', error)
    throw createError({ statusCode: 500, message: 'Не удалось обновить новость' })
  }
})
