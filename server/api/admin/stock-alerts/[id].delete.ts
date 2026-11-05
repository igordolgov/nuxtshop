// server/api/admin/stock-alerts/[id].delete.ts
// Удаление заявки о поступлении (DELETE /api/admin/stock-alerts/:id). Менеджер или админ (staff).
import { readStockAlerts, writeStockAlerts } from '../../../lib/stockAlertHelpers';
import { requireStaff } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireStaff(event);

  const id = getRouterParam(event, 'id');
  const alerts = await readStockAlerts(event);
  const next = alerts.filter((a) => String(a.id) !== String(id));
  if (next.length === alerts.length) {
    throw createError({ statusCode: 404, message: 'Заявка не найдена' });
  }

  await writeStockAlerts(event, next);
  return { success: true, message: 'Заявка удалена' };
});
