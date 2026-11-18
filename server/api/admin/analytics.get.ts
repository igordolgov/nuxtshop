// server/api/admin/analytics.get.ts
// Аналитика заказов для страницы /admin/analytics (менеджер или админ).
// Query: ?days=30 — окно в днях (7/30/90 на клиенте, сервер клампит 1..365).
// Вычисление на лету из KV data:orders — та же модель, что у «Часто
// покупают вместе»: масштаб магазина (сотни заказов) делает агрегацию
// дешёвой, отдельный кэш не нужен.
// В ответе также promoCodes — статистика промокодов за тот же период
// (секция «Промокоды» страницы и CSV-экспорт).
import { computeAnalytics, computePromoAnalytics } from '../../lib/analyticsHelpers';
import { readOrders } from '../../lib/orderHelpers';
import { readPromoCodes } from '../../lib/promoHelpers';
import { requireStaff } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireStaff(event);

  const query = getQuery(event);
  const days = Math.min(Math.max(parseInt(String(query.days)) || 30, 1), 365);

  const orders = await readOrders(event);
  const analytics = computeAnalytics(orders, days);
  const promos = await readPromoCodes(event);
  const promoCodes = computePromoAnalytics(orders, promos, days);

  return {
    success: true,
    timestamp: new Date().toISOString(),
    analytics: { ...analytics, promoCodes },
  };
});
