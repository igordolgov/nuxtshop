// server/api/reviews/index.get.ts
// Одобренные отзывы товара (GET /api/reviews?product=<id>). Публично.
import { approvedReviews, ratingSummary, readReviews } from '../../lib/reviewHelpers';

export default defineEventHandler(async (event) => {
  const productId = String(getQuery(event).product ?? '').trim();
  if (!productId) {
    throw createError({ statusCode: 400, message: 'Не указан товар' });
  }

  const reviews = await readReviews(event);
  const list = approvedReviews(reviews, productId);
  return { success: true, reviews: list, summary: ratingSummary(list) };
});
