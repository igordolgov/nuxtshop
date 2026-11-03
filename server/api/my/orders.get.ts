// server/api/my/orders.get.ts
// Заказы ТЕКУЩЕГО пользователя (GET /api/my/orders). Только авторизованные.
// Возвращает НЕ все заказы, а отфильтрованные по userId из сессии —
// чужие заказы недоступны в принципе (фильтрация на сервере).
import { readOrders } from '../../lib/orderHelpers';
import { requireUser } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireUser(event);

    const orders = await readOrders(event);
    const my = orders
      .filter((o) => o.customer?.userId === user.id)
      // Свежие сверху; server уже сортирует при создании (unshift),
      // но не полагаемся на порядок хранения
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { success: true, total: my.length, orders: my };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка получения заказов пользователя:', error);
    throw createError({ statusCode: 500, message: 'Не удалось получить заказы' });
  }
});
