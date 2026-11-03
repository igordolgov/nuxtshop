// server/api/admin/promocodes/[id].put.ts
// Редактирование промокода (PUT /api/admin/promocodes/:id). Только админ.
// id/usedCount/createdAt не редактируются; счётчик применений сбросить
// нельзя (история заказов), при необходимости — удалить и создать заново.
import {
  readPromoCodes,
  writePromoCodes,
  normalizePromoInput,
  findPromoByCode,
  PromoValidationError,
} from '../../../lib/promoHelpers';
import { requireAdmin } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  const promos = await readPromoCodes(event);
  const promo = promos.find((p) => String(p.id) === String(id));
  if (!promo) {
    throw createError({ statusCode: 404, message: 'Промокод не найден' });
  }

  let fields;
  try {
    fields = normalizePromoInput(body ?? {}, promo);
  } catch (error) {
    if (error instanceof PromoValidationError) {
      throw createError({ statusCode: 400, message: error.message });
    }
    throw error;
  }

  // Уникальность кода среди ДРУГИХ промокодов
  const duplicate = findPromoByCode(promos, fields.code);
  if (duplicate && duplicate.id !== promo.id) {
    throw createError({ statusCode: 409, message: `Промокод ${fields.code} уже существует` });
  }

  Object.assign(promo, fields, { updatedAt: new Date().toISOString() });
  await writePromoCodes(event, promos);

  return { success: true, promo, message: `Промокод ${promo.code} сохранён` };
});
