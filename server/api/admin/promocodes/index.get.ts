// server/api/admin/promocodes/index.get.ts
// Список промокодов для админки (GET /api/admin/promocodes). Только админ.
import { readPromoCodes, sortPromosDesc } from '../../../lib/promoHelpers';
import { requireAdmin } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const promos = await readPromoCodes(event);

  return {
    success: true,
    promos: sortPromosDesc(promos),
    active: promos.filter((p) => p.active).length,
  };
});
