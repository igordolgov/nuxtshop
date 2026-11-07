// server/api/my/orders/[id]/cancel.post.ts
// Отмена заказа покупателем (POST /api/my/orders/:id/cancel).
// Разрешена только до передачи в доставку (new/confirmed —
// CUSTOMER_CANCELLABLE_STATUSES). Отмена подтверждённого заказа
// автоматически возвращает товары на склад (updateOrderStatus:
// status 'cancelled' + stockApplied → restore).
import { canCustomerCancel, readOrders, updateOrderStatus } from '../../../../lib/orderHelpers';
import { requireUser } from '../../../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireUser(event);
    const id = String(getRouterParam(event, 'id') ?? '');

    // Чужой и несуществующий заказ — одна и та же 404:
    // не раскрываем существование чужих заказов
    const orders = await readOrders(event);
    const order = orders.find((o) => o.id === id);
    if (!order || order.customer?.userId !== user.id) {
      throw createError({
        statusCode: 404,
        message: 'Заказ не найден',
        data: { code: 'orderNotFound' },
      });
    }
    if (!canCustomerCancel(order, user.id)) {
      throw createError({
        statusCode: 409,
        message: 'Заказ уже передан в доставку — отменить его нельзя',
        data: { code: 'orderCancelShipped' },
      });
    }

    const updated = await updateOrderStatus(event, id, 'cancelled', 'Отменён покупателем');
    return { success: true, order: updated };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка отмены заказа покупателем:', error);
    throw createError({
      statusCode: 500,
      message: 'Не удалось отменить заказ',
      data: { code: 'orderCancelFailed' },
    });
  }
});
