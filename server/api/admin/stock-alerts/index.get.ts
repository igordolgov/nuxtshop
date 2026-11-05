// server/api/admin/stock-alerts/index.get.ts
// Список заявок «сообщить о поступлении» (GET /api/admin/stock-alerts).
// Менеджер или админ (staff); свежие сверху.
import { readStockAlerts } from '../../../lib/stockAlertHelpers';
import { requireStaff } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireStaff(event);

  const alerts = await readStockAlerts(event);
  const sorted = [...alerts].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { success: true, alerts: sorted, total: alerts.length };
});
