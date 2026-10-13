// server/api/orders/index.get.js
// Список заказов (GET /api/orders). Только админ.
// Query: ?status=new — фильтр по статусу; ?limit=50 — ограничение выборки.
import { readOrders, ORDER_STATUSES } from '../../lib/orderHelpers'
import { requireAdmin } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)

    const query = getQuery(event)
    let orders = await readOrders(event)

    // Фильтр по статусу (значение валидируется — чужие просто игнорируются)
    if (query.status && ORDER_STATUSES.includes(query.status)) {
      orders = orders.filter((o) => o.status === query.status)
    }

    // Явная сортировка новые→старые: не полагаемся на порядок в KV
    orders = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    // ⚙️ НАСТРОЙКА: лимит выборки по умолчанию (защита от гигантских ответов)
    const limit = Math.min(Math.max(parseInt(query.limit) || 100, 1), 500)

    return { success: true, total: orders.length, orders: orders.slice(0, limit) }
  } catch (error) {
    if (error.statusCode) throw error
    console.error('Ошибка получения заказов:', error)
    throw createError({ statusCode: 500, statusMessage: 'Не удалось получить заказы' })
  }
})