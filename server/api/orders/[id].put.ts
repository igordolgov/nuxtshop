// server/api/orders/[id].put.ts
// Смена статуса заказа (PUT /api/orders/:id). Менеджер или админ (staff).
// Body: { status: 'confirmed' | ..., comment?: string }
// Идемпотентно: повторная установка того же статуса не дублирует историю —
// критично для повторных вызовов из Telegram-вебхука (этап 1).
import {
  updateOrderStatus,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from '../../lib/orderHelpers';
import { requireStaff } from '../../utils/auth';
import { adminActionLog } from '../../lib/logger';

export default defineEventHandler(async (event) => {
  try {
    const staff = await requireStaff(event);

    const id = getRouterParam(event, 'id');
    if (!id) {
      throw createError({ statusCode: 400, message: 'ID заказа не указан' });
    }

    const body = await readBody<{ status?: OrderStatus; comment?: string }>(event);
    if (!body?.status || !ORDER_STATUSES.includes(body.status)) {
      throw createError({
        statusCode: 400,
        message: `Недопустимый статус. Допустимо: ${ORDER_STATUSES.join(', ')}`,
      });
    }

    const order = await updateOrderStatus(event, id, body.status, body.comment);

    // Кто и какой статус поставил — журнал действий staff (см. шапку logger.ts):
    // без этого спорные заказы не разобрать (кто перевёл в «отменён» и когда)
    adminActionLog.add({
      action: 'ORDER_STATUS_CHANGED',
      actor: { id: staff.id, email: staff.email, role: staff.role },
      order: { id: order.id },
      status: body.status,
    });

    return {
      success: true,
      order,
      message: `Заказ ${order.id}: статус «${ORDER_STATUS_LABELS[body.status]}»`,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка смены статуса заказа:', error);
    throw createError({ statusCode: 500, message: 'Не удалось изменить статус' });
  }
});
