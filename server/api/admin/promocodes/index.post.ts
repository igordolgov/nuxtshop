// server/api/admin/promocodes/index.post.ts
// Создание промокода (POST /api/admin/promocodes). Только админ.
// Код уникален регистронезависимо; usedCount всегда стартует с 0.
import {
  readPromoCodes,
  writePromoCodes,
  normalizePromoInput,
  findPromoByCode,
  nextPromoId,
  PromoValidationError,
} from '../../../lib/promoHelpers';
import { requireAdmin } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAdmin(event);

  const body = await readBody(event);

  let fields;
  try {
    fields = normalizePromoInput(body ?? {});
  } catch (error) {
    if (error instanceof PromoValidationError) {
      throw createError({ statusCode: 400, message: error.message });
    }
    throw error;
  }

  const promos = await readPromoCodes(event);
  if (findPromoByCode(promos, fields.code)) {
    throw createError({ statusCode: 409, message: `Промокод ${fields.code} уже существует` });
  }

  const now = new Date().toISOString();
  const promo = {
    id: nextPromoId(promos),
    ...fields,
    usedCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  promos.push(promo);
  await writePromoCodes(event, promos);

  return { success: true, promo, message: `Промокод ${promo.code} создан` };
});
