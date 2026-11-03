// server/api/store-reviews/index.post.ts
// Отзыв о магазине с витрины (POST /api/store-reviews). Публично, уходит на
// модерацию (approved:false) — публикация из /admin/reviews (вкладка
// «О магазине»). Админам — уведомление в Telegram (best-effort).
import {
  StoreReviewValidationError,
  nextStoreReviewId,
  normalizeStoreReviewInput,
  readStoreReviews,
  writeStoreReviews,
} from '../../lib/storeReviewHelpers';
import { getAdminChatIds, isTelegramConfigured, sendMessage } from '../../lib/telegram';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    // Honeypot: скрытое поле «website» заполняют только боты — тихо «успех»
    if (typeof body?.website === 'string' && body.website.trim() !== '') {
      return { success: true, message: 'Спасибо! Отзыв появится после модерации' };
    }

    const clean = normalizeStoreReviewInput(body ?? {});

    const reviews = await readStoreReviews(event);
    const item = {
      id: nextStoreReviewId(reviews),
      ...clean,
      createdAt: new Date().toISOString(),
      approved: false,
    };
    reviews.push(item);
    await writeStoreReviews(event, reviews);

    try {
      const env = event.context.cloudflare?.env;
      if (isTelegramConfigured(env)) {
        const origin = getRequestURL(event).origin;
        const text =
          `💬 Новый отзыв о магазине\n` +
          `⭐ ${item.rating}/5 — ${item.author}\n` +
          `${item.text}\n\n` +
          `Модерация: ${origin}/admin/reviews`;
        for (const chatId of getAdminChatIds(env)) {
          await sendMessage(env, chatId, text);
        }
      }
    } catch (e) {
      console.warn('store-reviews: telegram-уведомление не удалось', e);
    }

    return { success: true, message: 'Спасибо! Отзыв появится после модерации' };
  } catch (error) {
    if (error instanceof StoreReviewValidationError) {
      throw createError({ statusCode: 400, message: error.message });
    }
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка добавления отзыва о магазине:', error);
    throw createError({ statusCode: 500, message: 'Не удалось отправить отзыв' });
  }
});
