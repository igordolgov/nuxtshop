// server/api/promocodes/validate.post.ts
// Публичная проверка промокода (POST /api/promocodes/validate).
// body: { code, items?: [{id: 'productId::variantId', quantity}] } —
// содержимое корзины. Цены/акции/категории сервер берёт из СВОЕГО
// sellable-среза каталога (клиентские суммы не участвуют) и считает
// скидку той же evaluatePromo, что и createOrder — превью никогда не
// расходится с заказом. userId сессии — для per-user лимита в превью
// (у гостя без email превью не проверяет per-user: заказ проверит).
import {
  readPromoCodes,
  findPromoByCode,
  evaluatePromo,
  type PromoCartLine,
} from '../../lib/promoHelpers';
import { readSellableProducts } from '../../lib/promoDiscount';
import { getSessionUser } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const code = String(body?.code ?? '')
    .trim()
    .toUpperCase();
  if (!code) {
    throw createError({
      statusCode: 400,
      message: 'Введите промокод',
      data: { code: 'promoEmpty' },
    });
  }

  const promos = await readPromoCodes(event);
  const promo = findPromoByCode(promos, code);

  if (!promo) {
    return { valid: false, reason: 'not_found', message: 'Промокод не найден' };
  }

  // Срез витрины: акционные цены + promoPercent/promoAllowsPromocodes
  const sellable = await readSellableProducts(event);
  const byId = new Map(sellable.map((p) => [String(p.id), p]));

  // Корзина: составные id «productId::variantId» (см. useCart.addToCart)
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const lines: PromoCartLine[] = [];
  for (const item of rawItems) {
    const lineId = String(item?.id ?? '');
    if (!lineId) continue;
    const productId = lineId.includes('::') ? lineId.slice(0, lineId.indexOf('::')) : lineId;
    const product = byId.get(productId);
    if (!product) continue; // удалённый из каталога — заказ всё равно отклонит
    const quantity = Math.max(1, Number(item?.quantity) || 1);
    lines.push({
      productId,
      quantity,
      price: product.price,
      promoPercent: product.promoPercent ?? null,
      promoAllowsPromocodes: product.promoAllowsPromocodes,
      category: product.categories?.[0] ?? null,
    });
  }

  // userId сессии — per-user лимит в превью; subtotal — только для порога
  const user = await getSessionUser(event);
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  const result = evaluatePromo(promo, {
    lines,
    subtotal,
    userKey: user?.id ?? null,
  });

  if (!result.ok) {
    // Локализацию делает клиент по reason (server.promo*), русский
    // message — фолбэк для прямых вызовов API
    return { valid: false, reason: result.reason, message: null };
  }

  return {
    valid: true,
    promo: {
      code: promo.code,
      type: promo.type,
      value: promo.value,
      // Точная скидка по серверному срезу (клиент не считает сам)
      discount: result.discount,
      base: result.base,
      expiresAt: promo.expiresAt,
      description: promo.description || null,
    },
  };
});
