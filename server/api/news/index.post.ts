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
import { sendNewsPost } from '../../lib/telegram'
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

    // Telegram-постинг при публикации: best-effort. Сбой бота/сети
    // не ломает создание новости; без секретов — тихий no-op (false).
    // Ссылка — от origin запроса: на проде это домен воркера.
    let telegramPosted = false
    try {
      const env = event.context.cloudflare?.env
      telegramPosted = await sendNewsPost(env, item, getRequestURL(event).origin)
    } catch (e) {
      console.warn('news: telegram-постинг не удался', e)
    }

    return {
      success: true,
      news: item,
      telegramPosted,
      message: telegramPosted
        ? 'Новость добавлена и отправлена в Telegram'
        : 'Новость добавлена',
    }
  } catch (error) {
    if (error instanceof NewsValidationError) {
      throw createError({ statusCode: 400, message: error.message })
    }
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('Ошибка добавления новости:', error)
    throw createError({ statusCode: 500, message: 'Не удалось добавить новость' })
  }
})
