// server/api/my/cart/index.get.ts
// Серверная корзина ТЕКУЩЕГО пользователя (GET /api/my/cart). Только авторизованные.
// cart: null — на сервере ничего нет (первый вход с этого устройства).
import { readUserCart } from '../../../lib/cartHelpers';
import { requireUser } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireUser(event);
    const cart = await readUserCart(event, user.id);
    return { success: true, cart };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка получения корзины пользователя:', error);
    throw createError({ statusCode: 500, message: 'Не удалось получить корзину' });
  }
});
