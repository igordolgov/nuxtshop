// server/api/admin/stock-alerts/[id].delete.ts
// Удаление заявки о поступлении (DELETE /api/admin/stock-alerts/:id). Только админ.
import { readStockAlerts, writeStockAlerts } from '../../../lib/stockAlertHelpers';
import { requireAdmin } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = getRouterParam(event, 'id');
  const alerts = await readStockAlerts(event);
  const next = alerts.filter((a) => String(a.id) !== String(id));
  if (next.length === alerts.length) {
    throw createError({ statusCode: 404, message: 'Заявка не найдена' });
  }

  await writeStockAlerts(event, next);
  return { success: true, message: 'Заявка удалена' };
});
