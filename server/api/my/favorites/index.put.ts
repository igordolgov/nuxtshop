// server/api/my/favorites/index.put.ts
// Сохранение избранного ТЕКУЩЕГО пользователя (PUT /api/my/favorites). Только авторизованные.
// Клиент шлёт { favorites: [снапшоты] } — валидация/белый список полей
// в favoritesHelpers (общий модуль с клиентом app/utils/favoritesSync.ts).
// Пустой список → ключ удаляется (избранное «очищено»).
import { writeUserFavorites } from '../../../lib/favoritesHelpers';
import { requireUser } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireUser(event);

    const body = await readBody<{ favorites?: unknown }>(event);
    if (!body || typeof body !== 'object' || !Array.isArray(body.favorites)) {
      throw createError({
        statusCode: 400,
        message: 'Некорректное тело запроса',
        data: { code: 'favoritesInvalid' },
      });
    }

    const saved = await writeUserFavorites(event, user.id, body.favorites);
    return { success: true, favorites: saved };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка сохранения избранного пользователя:', error);
    throw createError({ statusCode: 500, message: 'Не удалось сохранить избранное' });
  }
});
