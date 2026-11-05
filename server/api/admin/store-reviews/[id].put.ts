// server/api/admin/store-reviews/[id].put.ts
// Модерация отзыва о магазине (PUT /api/admin/store-reviews/:id, body { approved }).
// true — показать в блоке на /about, false — скрыть.
import { readStoreReviews, writeStoreReviews } from '../../../lib/storeReviewHelpers';
import { requireStaff } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireStaff(event);

  const id = getRouterParam(event, 'id');
  const body = await readBody(event);
  if (typeof body?.approved !== 'boolean') {
    throw createError({ statusCode: 400, message: 'Поле approved обязательно (true/false)' });
  }

  const reviews = await readStoreReviews(event);
  const item = reviews.find((r) => String(r.id) === String(id));
  if (!item) {
    throw createError({ statusCode: 404, message: 'Отзыв не найден' });
  }

  item.approved = body.approved;
  await writeStoreReviews(event, reviews);

  return {
    success: true,
    review: item,
    message: body.approved ? 'Отзыв опубликован' : 'Отзыв скрыт с витрины',
  };
});
