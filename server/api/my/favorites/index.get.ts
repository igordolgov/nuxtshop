// server/api/my/favorites/index.get.ts
// Серверное избранное ТЕКУЩЕГО пользователя (GET /api/my/favorites). Только авторизованные.
// favorites: null — на сервере ничего нет (первый вход с этого устройства).
import { readUserFavorites } from '../../../lib/favoritesHelpers';
import { requireUser } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireUser(event);
    const favorites = await readUserFavorites(event, user.id);
    return { success: true, favorites };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка получения избранного пользователя:', error);
    throw createError({ statusCode: 500, message: 'Не удалось получить избранное' });
  }
});
