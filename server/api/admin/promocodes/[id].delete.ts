// server/api/admin/promocodes/[id].delete.ts
// Удаление промокода (DELETE /api/admin/promocodes/:id). Только админ.
// Заказы, в которых промокод уже применён, не затрагиваются —
// их discount/promoCode зафиксированы в записи заказа.
import { readPromoCodes, writePromoCodes } from '../../../lib/promoHelpers';
import { requireAdmin } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = getRouterParam(event, 'id');

  const promos = await readPromoCodes(event);
  const index = promos.findIndex((p) => String(p.id) === String(id));
  // Сужение вместо проверки index (noUncheckedIndexedAccess)
  const removed = promos[index];
  if (!removed) {
    throw createError({ statusCode: 404, message: 'Промокод не найден' });
  }

  promos.splice(index, 1);
  await writePromoCodes(event, promos);

  return { success: true, message: `Промокод ${removed.code} удалён` };
});
