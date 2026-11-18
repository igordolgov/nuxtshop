// server/api/admin/stock-alerts/index.get.ts
// Список заявок «сообщить о поступлении» (GET /api/admin/stock-alerts).
// Менеджер или админ (staff); свежие сверху.
// notifyReady — только у pending-заявок: есть ли канал доставки при
// поступлении (Telegram-привязка аккаунта или email-контакт при
// настроенном Resend). false → бейдж «нет канала» в админке: после
// поступления придётся писать вручную.
import { readStockAlerts } from '../../../lib/stockAlertHelpers';
import { readUsers } from '../../../lib/userHelpers';
import { alertHasChannel } from '../../../lib/stockAlertNotify';
import { requireStaff } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireStaff(event);

  const [alerts, users] = await Promise.all([readStockAlerts(event), readUsers(event)]);
  const sorted = [...alerts].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const env = event.context.cloudflare?.env;
  const enriched = sorted.map((a) =>
    a.notifiedAt ? a : { ...a, notifyReady: alertHasChannel(a, users, env) },
  );
  return { success: true, alerts: enriched, total: alerts.length };
});
