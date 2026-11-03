// server/api/admin/reviews/[id].delete.ts
// Удаление отзыва (DELETE /api/admin/reviews/:id). Только админ, необратимо.
// Вместе с отзывом удаляем его фото из KV (img:reviews/…), чтобы в хранилище
// не копились осиротевшие картинки, которые больше никто не отдаёт.
import { IMAGE_KV_PREFIX } from '../../../lib/imageStorage';
import { readReviews, writeReviews } from '../../../lib/reviewHelpers';
import { kvDelete } from '../../../lib/storage';
import { requireAdmin } from '../../../utils/auth';

/** Путь фото из отзыва → ключ в KV («/api/images/reviews/x.webp» → «img:reviews/x.webp»). */
function photoKVKey(url) {
  const prefix = '/api/images/';
  return url?.startsWith(prefix) ? IMAGE_KV_PREFIX + url.slice(prefix.length) : null;
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = getRouterParam(event, 'id');
  const reviews = await readReviews(event);
  const removed = reviews.find((r) => String(r.id) === String(id));
  if (!removed) {
    throw createError({ statusCode: 404, message: 'Отзыв не найден' });
  }

  await writeReviews(
    event,
    reviews.filter((r) => r !== removed),
  );

  // Осиротевшие фото чистим best-effort: сбой KV-удаления не отменяет отзыв
  let deletedPhotos = 0;
  for (const url of removed.photos ?? []) {
    const key = photoKVKey(url);
    if (!key) continue;
    try {
      await kvDelete(event, key);
      deletedPhotos += 1;
    } catch (e) {
      console.warn(`reviews: не удалось удалить фото ${key}`, e);
    }
  }

  return {
    success: true,
    message: deletedPhotos > 0 ? `Отзыв удалён (фото: ${deletedPhotos})` : 'Отзыв удалён',
  };
});
