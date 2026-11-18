// server/api/admin/stock-alerts/index.get.ts
// Список заявок «сообщить о поступлении» (GET /api/admin/stock-alerts).
// Менеджер или админ (staff); свежие сверху.
// telegramReady — только у pending-заявок: найдётся ли адресат в Telegram
// при поступлении (привязка аккаунта в профиле). false → бейдж «нет
// Telegram» в админке: после поступления придётся писать вручную.
import { readStockAlerts } from '../../../lib/stockAlertHelpers';
import { readUsers } from '../../../lib/userHelpers';
import { resolveAlertChat } from '../../../lib/stockAlertNotify';
import { requireStaff } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireStaff(event);

  const [alerts, users] = await Promise.all([readStockAlerts(event), readUsers(event)]);
  const sorted = [...alerts].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const enriched = sorted.map((a) =>
    a.notifiedAt ? a : { ...a, telegramReady: resolveAlertChat(a, users) !== null },
  );
  return { success: true, alerts: enriched, total: alerts.length };
});
