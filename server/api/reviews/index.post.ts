// server/api/reviews/index.post.ts
// Новый отзыв с витрины (POST /api/reviews). Публично, но уходит на
// модерацию (approved:false) — публикация только из /admin/reviews.
// Товар проверяется на существование; админам уходит уведомление в Telegram
// (best-effort: без секретов/при сбое — тихий no-op).
import { readProducts } from '../../lib/productHelpers'
import { processImage } from '../../lib/imageStorage'
import {
  ReviewValidationError,
  nextReviewId,
  normalizeReviewInput,
  readReviews,
  writeReviews,
} from '../../lib/reviewHelpers'
import { getAdminChatIds, isTelegramConfigured, sendMessage } from '../../lib/telegram'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    // Honeypot: скрытое поле «website» заполняют только боты — тихо «успех»
    // без записи, чтобы не портить им метрику и не плодить мусор в KV.
    if (typeof body?.website === 'string' && body.website.trim() !== '') {
      return { success: true, message: 'Спасибо! Отзыв появится после модерации' }
    }

    const clean = normalizeReviewInput(body ?? {})

    const products = await readProducts(event)
    const product = products.find((p) => String(p?.id) === clean.productId)
    if (!product) {
      throw createError({ statusCode: 400, message: 'Товар не найден' })
    }

    const reviews = await readReviews(event)
    // photos кладём ниже отдельным полем — пустой массив в KV не пишем
    const { photos: rawPhotos, ...withoutPhotos } = clean
    const item = {
      id: nextReviewId(reviews),
      ...withoutPhotos,
      createdAt: new Date().toISOString(),
      approved: false,
    }

    // Фото покупателя: каждое data-URI уезжает в KV (img:reviews/…)
    // и заменяется коротким путём /api/images/reviews/… — чтобы отзывы
    // в одном KV-ключе не раздувались base64 (та же схема, что у новостей).
    if (rawPhotos.length > 0) {
      const photos = []
      for (const uri of rawPhotos) {
        photos.push(await processImage(event, uri, 'review-photo', 'reviews/review'))
      }
      item.photos = photos
    }

    reviews.push(item)
    await writeReviews(event, reviews)

    // Уведомление админам: новый отзыв ждёт модерации. Сбой сети/бота
    // не ломает отправку отзыва.
    let notified = false
    try {
      const env = event.context.cloudflare?.env
      if (isTelegramConfigured(env)) {
        const origin = getRequestURL(event).origin
        const text =
          `🗣️ Новый отзыв на «${product.name}»\n` +
          `⭐ ${item.rating}/5 — ${item.author}\n` +
          `${item.text}\n\n` +
          `Модерация: ${origin}/admin/reviews`
        for (const chatId of getAdminChatIds(env)) {
          notified = (await sendMessage(env, chatId, text)) || notified
        }
      }
    } catch (e) {
      console.warn('reviews: telegram-уведомление не удалось', e)
    }

    return { success: true, message: 'Спасибо! Отзыв появится после модерации' }
  } catch (error) {
    if (error instanceof ReviewValidationError) {
      throw createError({ statusCode: 400, message: error.message })
    }
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('Ошибка добавления отзыва:', error)
    throw createError({ statusCode: 500, message: 'Не удалось отправить отзыв' })
  }
})
