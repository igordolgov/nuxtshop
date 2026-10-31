// server/api/news/[id].delete.ts
// Удаление новости (DELETE /api/news/:id). Только админ.
import { readNews, writeNews } from '../../lib/newsHelpers'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const id = getRouterParam(event, 'id')
    const news = await readNews(event)
    const idx = news.findIndex((n) => String(n.id) === String(id))
    if (idx === -1) {
      throw createError({ statusCode: 404, message: 'Новость не найдена' })
    }

    news.splice(idx, 1)
    await writeNews(event, news)

    return { success: true, message: 'Новость удалена' }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('Ошибка удаления новости:', error)
    throw createError({ statusCode: 500, message: 'Не удалось удалить новость' })
  }
})
