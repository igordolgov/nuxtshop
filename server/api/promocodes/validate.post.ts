// server/api/promocodes/validate.post.ts
// Публичная проверка промокода (POST /api/promocodes/validate).
// body: { code: string, subtotal?: number } — subtotal клиентский, нужен
// только для превью скидки; окончательно скидку пересчитывает createOrder
// по серверным ценам (клиентская сумма не может ничего подделать).
import {
  readPromoCodes,
  findPromoByCode,
  promoIssue,
  PROMO_ISSUE_MESSAGES,
  calcDiscount,
} from '../../lib/promoHelpers';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const code = String(body?.code ?? '')
    .trim()
    .toUpperCase();
  if (!code) {
    throw createError({ statusCode: 400, message: 'Введите промокод' });
  }

  const promos = await readPromoCodes(event);
  const promo = findPromoByCode(promos, code);

  if (!promo) {
    return { valid: false, reason: 'not_found', message: 'Промокод не найден' };
  }

  const issue = promoIssue(promo);
  if (issue) {
    return { valid: false, reason: issue, message: PROMO_ISSUE_MESSAGES[issue] };
  }

  const subtotal = Number(body?.subtotal);
  const discount = calcDiscount(promo, Number.isFinite(subtotal) ? subtotal : 0);

  return {
    valid: true,
    promo: {
      code: promo.code,
      type: promo.type,
      value: promo.value,
      discount,
      expiresAt: promo.expiresAt,
      description: promo.description || null,
    },
  };
});
