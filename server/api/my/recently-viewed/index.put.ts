// server/api/my/recently-viewed/index.put.ts
// Сохранение истории просмотров ТЕКУЩЕГО пользователя (PUT /api/my/recently-viewed).
// Только авторизованные. Клиент шлёт { recentlyViewed: [slug, ...] } — валидация
// в recentlyViewedHelpers (общий модуль с клиентом app/utils/recentlyViewedSync.ts).
// Пустой список → ключ удаляется (история «очищена»).
import { writeUserRecentlyViewed } from '../../../lib/recentlyViewedHelpers';
import { requireUser } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireUser(event);

    const body = await readBody<{ recentlyViewed?: unknown }>(event);
    if (!body || typeof body !== 'object' || !Array.isArray(body.recentlyViewed)) {
      throw createError({
        statusCode: 400,
        message: 'Некорректное тело запроса',
        data: { code: 'recentlyViewedInvalid' },
      });
    }

    const saved = await writeUserRecentlyViewed(event, user.id, body.recentlyViewed);
    return { success: true, recentlyViewed: saved };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка сохранения истории просмотров пользователя:', error);
    throw createError({ statusCode: 500, message: 'Не удалось сохранить историю просмотров' });
  }
});
