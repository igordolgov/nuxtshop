// server/api/reviews/[id]/helpful.post.ts
// Переключение отметки «полезно» на отзыве (POST /api/reviews/:id/helpful).
// Только для авторизованных; toggleHelpful хранит id пользователя в
// helpfulBy отзыва — повторный клик снимает отметку. Отмечать можно
// только опубликованные отзывы (неотмодерированные покупатель не видит).
import {
  ReviewValidationError,
  helpfulCountOf,
  readReviews,
  toggleHelpful,
  writeReviews,
} from '../../../lib/reviewHelpers';
import { requireUser } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireUser(event);
    const id = getRouterParam(event, 'id');

    const reviews = await readReviews(event);
    const review = reviews.find((r) => String(r.id) === String(id));
    if (!review || !review.approved) {
      throw createError({ statusCode: 404, message: 'Отзыв не найден' });
    }

    let action: 'added' | 'removed';
    try {
      action = toggleHelpful(review, user.id);
    } catch (error) {
      if (error instanceof ReviewValidationError) {
        throw createError({ statusCode: 400, message: error.message });
      }
      throw error;
    }

    await writeReviews(event, reviews);

    return {
      success: true,
      action,
      liked: action === 'added',
      helpfulCount: helpfulCountOf(review),
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка отметки «полезно»:', error);
    throw createError({ statusCode: 500, message: 'Не удалось сохранить отметку' });
  }
});
