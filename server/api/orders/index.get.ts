// server/api/orders/index.get.ts
// Список заказов (GET /api/orders). Менеджер или админ (staff).
// Query: ?status=new — фильтр по статусу; ?limit=50 — ограничение выборки.
import { readOrders, ORDER_STATUSES, type OrderStatus } from '../../lib/orderHelpers';
import { requireStaff } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    await requireStaff(event);

    const query = getQuery(event);
    let orders = await readOrders(event);

    // Фильтр по статусу (значение валидируется — чужие просто игнорируются)
    const status = query.status as OrderStatus | undefined;
    if (status && ORDER_STATUSES.includes(status)) {
      orders = orders.filter((o) => o.status === status);
    }

    // Явная сортировка новые→старые: не полагаемся на порядок в KV
    orders = [...orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // ⚙️ НАСТРОЙКА: лимит выборки по умолчанию (защита от гигантских ответов)
    const limit = Math.min(Math.max(parseInt(String(query.limit)) || 100, 1), 500);

    return { success: true, total: orders.length, orders: orders.slice(0, limit) };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка получения заказов:', error);
    throw createError({ statusCode: 500, message: 'Не удалось получить заказы' });
  }
});
