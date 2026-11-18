// server/api/my/cart/index.put.ts
// Сохранение корзины ТЕКУЩЕГО пользователя (PUT /api/my/cart). Только авторизованные.
// Клиент шлёт { cart: { items, promo, deliveryMethod } } — валидация/белый список
// полей в cartHelpers (общий модуль с клиентом app/utils/cartSync.ts).
// Пустые items → ключ удаляется (корзина «очищена»).
import { writeUserCart } from '../../../lib/cartHelpers';
import { requireUser } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireUser(event);

    const body = await readBody<{ cart?: unknown }>(event);
    if (!body || typeof body !== 'object' || !body.cart || typeof body.cart !== 'object') {
      throw createError({
        statusCode: 400,
        message: 'Некорректное тело запроса',
        data: { code: 'cartInvalid' },
      });
    }

    const saved = await writeUserCart(event, user.id, body.cart);
    return { success: true, cart: saved };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка сохранения корзины пользователя:', error);
    throw createError({ statusCode: 500, message: 'Не удалось сохранить корзину' });
  }
});
