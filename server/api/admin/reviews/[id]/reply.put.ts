// server/api/admin/reviews/[id]/reply.put.ts
// Ответ магазина на отзыв (PUT /api/admin/reviews/:id/reply, body { text }).
// Непустой text — сохранить/обновить ответ (дата выставляется сервером),
// пустой — удалить существующий. Ответ виден покупателям на карточке
// товара (publicReviewView отдаёт shopReply вместе с одобренным отзывом).
import {
  ReviewValidationError,
  applyShopReply,
  normalizeShopReplyText,
  readReviews,
  writeReviews,
} from '../../../../lib/reviewHelpers';
import { requireStaff } from '../../../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    await requireStaff(event);

    const id = getRouterParam(event, 'id');
    const body = await readBody(event);

    let text: string;
    try {
      text = normalizeShopReplyText(body?.text);
    } catch (error) {
      if (error instanceof ReviewValidationError) {
        throw createError({ statusCode: 400, message: error.message });
      }
      throw error;
    }

    const reviews = await readReviews(event);
    const item = reviews.find((r) => String(r.id) === String(id));
    if (!item) {
      throw createError({ statusCode: 404, message: 'Отзыв не найден' });
    }

    applyShopReply(item, text);
    await writeReviews(event, reviews);

    return {
      success: true,
      review: item,
      message: text ? 'Ответ сохранён' : 'Ответ удалён',
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка ответа магазина на отзыв:', error);
    throw createError({ statusCode: 500, message: 'Не удалось сохранить ответ' });
  }
});
