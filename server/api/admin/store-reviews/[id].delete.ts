// server/api/admin/store-reviews/[id].delete.ts
// Удаление отзыва о магазине (DELETE /api/admin/store-reviews/:id). Менеджер или админ (staff).
import { readStoreReviews, writeStoreReviews } from '../../../lib/storeReviewHelpers';
import { requireStaff } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireStaff(event);

  const id = getRouterParam(event, 'id');
  const reviews = await readStoreReviews(event);
  const next = reviews.filter((r) => String(r.id) !== String(id));
  if (next.length === reviews.length) {
    throw createError({ statusCode: 404, message: 'Отзыв не найден' });
  }

  await writeStoreReviews(event, next);
  return { success: true, message: 'Отзыв удалён' };
});
