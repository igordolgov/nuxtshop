// server/api/orders/[id].put.js
// Смена статуса заказа (PUT /api/orders/:id). Только админ.
// Body: { status: 'confirmed' | ..., comment?: string }
// Идемпотентно: повторная установка того же статуса не дублирует историю —
// критично для повторных вызовов из Telegram-вебхука (этап 1).
import { updateOrderStatus, ORDER_STATUSES, ORDER_STATUS_LABELS } from '../../lib/orderHelpers'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, message: 'ID заказа не указан' })
    }

    const body = await readBody(event)
    if (!body?.status || !ORDER_STATUSES.includes(body.status)) {
      throw createError({
        statusCode: 400,
        message: `Недопустимый статус. Допустимо: ${ORDER_STATUSES.join(', ')}`,
      })
    }

    const order = await updateOrderStatus(event, id, body.status, body.comment)

    // TODO(этап 2, Telegram): кнопки «Подтвердить/Отменить» будут вызывать
    // эту же логику через внутреннюю функцию, минуя HTTP

    return {
      success: true,
      order,
      message: `Заказ ${order.id}: статус «${ORDER_STATUS_LABELS[body.status]}»`,
    }
  } catch (error) {
    if (error.statusCode) throw error
    console.error('Ошибка смены статуса заказа:', error)
    throw createError({ statusCode: 500, message: 'Не удалось изменить статус' })
  }
})