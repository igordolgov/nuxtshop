// server/api/my/recently-viewed/index.get.ts
// История просмотров ТЕКУЩЕГО пользователя (GET /api/my/recently-viewed).
// Только авторизованные. recentlyViewed: null — на сервере ничего нет
// (первый вход с этого устройства).
import { readUserRecentlyViewed } from '../../../lib/recentlyViewedHelpers';
import { requireUser } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireUser(event);
    const recentlyViewed = await readUserRecentlyViewed(event, user.id);
    return { success: true, recentlyViewed };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка получения истории просмотров пользователя:', error);
    throw createError({ statusCode: 500, message: 'Не удалось получить историю просмотров' });
  }
});
