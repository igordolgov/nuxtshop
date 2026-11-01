// server/api/news/[id].put.ts
// Редактирование новости (PUT /api/news/:id). Только админ.
// sanitizeNewsItem — общая с POST (newsHelpers); id из маршрута.
import {
  NewsValidationError,
  readNews,
  sanitizeNewsItem,
  writeNews,
} from '../../lib/newsHelpers'
import { processImage } from '../../lib/imageStorage'
import { sendNewsPost } from '../../lib/telegram'
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

    // Черновик → публикация: единственный момент, когда PUT шлёт пост в Telegram
    // (правка уже опубликованной новости повторный пост не делает)
    const wasDraft = item.published === false

    const body = await readBody(event)
    const clean = sanitizeNewsItem(body ?? {})
    // Фото: data-URI из админки → KV img:news/…, пути/URL — насквозь
    const image = await processImage(event, clean.image, 'main', 'news/news')
    Object.assign(item, clean, { image })
    await writeNews(event, news)

    let telegramPosted = false
    if (wasDraft && item.published !== false) {
      try {
        const env = event.context.cloudflare?.env
        telegramPosted = await sendNewsPost(env, item, getRequestURL(event).origin)
      } catch (e) {
        console.warn('news: telegram-постинг не удался', e)
      }
    }

    const message = item.published === false
      ? 'Черновик сохранён — на витрине не виден'
      : telegramPosted
        ? 'Новость опубликована и отправлена в Telegram'
        : wasDraft
          ? 'Новость опубликована'
          : 'Новость обновлена'
    return { success: true, news: item, telegramPosted, message }
  } catch (error) {
    if (error instanceof NewsValidationError) {
      throw createError({ statusCode: 400, message: error.message })
    }
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('Ошибка обновления новости:', error)
    throw createError({ statusCode: 500, message: 'Не удалось обновить новость' })
  }
})
