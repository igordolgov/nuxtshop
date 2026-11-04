// server/api/reviews/index.get.ts
// Одобренные отзывы товара (GET /api/reviews?product=<id>). Публично.
// publicReviewView: helpfulBy (id пользователей) не утекает — наружу
// helpfulCount и likedByMe текущей сессии (null у гостей).
import {
  approvedReviews,
  publicReviewView,
  ratingSummary,
  readReviews,
} from '../../lib/reviewHelpers';
import { getSessionUser } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const productId = String(getQuery(event).product ?? '').trim();
  if (!productId) {
    throw createError({ statusCode: 400, message: 'Не указан товар' });
  }

  const sessionUser = await getSessionUser(event);
  const reviews = await readReviews(event);
  const list = approvedReviews(reviews, productId).map((r) =>
    publicReviewView(r, sessionUser?.id ?? null),
  );
  return { success: true, reviews: list, summary: ratingSummary(list) };
});
