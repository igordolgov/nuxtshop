// server/api/admin/analytics.get.ts
// Аналитика заказов для страницы /admin/analytics (менеджер или админ).
// Query: ?days=30 — окно в днях (7/30/90 на клиенте, сервер клампит 1..365).
// Вычисление на лету из KV data:orders — та же модель, что у «Часто
// покупают вместе»: масштаб магазина (сотни заказов) делает агрегацию
// дешёвой, отдельный кэш не нужен.
import { computeAnalytics } from '../../lib/analyticsHelpers';
import { readOrders } from '../../lib/orderHelpers';
import { requireStaff } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireStaff(event);

  const query = getQuery(event);
  const days = Math.min(Math.max(parseInt(String(query.days)) || 30, 1), 365);

  const orders = await readOrders(event);
  const analytics = computeAnalytics(orders, days);

  return {
    success: true,
    timestamp: new Date().toISOString(),
    analytics,
  };
});
