// app/utils/deliveryPrice.js
// ============================================
// Единый КЛИЕНТСКИЙ источник правил доставки — зеркало
// server/lib/orderHelpers.ts (FREE_DELIVERY_FROM / DELIVERY_PRICE_*).
// До появления модуля цены дублировались в трёх местах и расходились:
// в корзине считался только курьер (subtotal > 2000 ? 0 : 300),
// в чекауте был свой статический список с фиксированными ценами —
// один и тот же заказ показывал две разные суммы.
// Финальную сумму всё равно пересчитывает сервер при заказе.
// ============================================

// ⚙️ НАСТРОЙКА: бесплатная доставка курьером от порога, иначе 300 ₽;
// почта — всегда платно (200 ₽), самовывоз — всегда 0
export const FREE_DELIVERY_FROM = 2000
export const DELIVERY_PRICE_COURIER = 300
export const DELIVERY_PRICE_POST = 200

/**
 * Цена доставки по способу и сумме заказа.
 * Правила идентичны server/lib/orderHelpers.ts (createOrder):
 *   pickup → 0; post → всегда 200; courier → бесплатно от порога.
 * @param {'courier'|'pickup'|'post'} methodId
 * @param {number} subtotal сумма товаров без скидки и доставки
 * @returns {number}
 */
export const getDeliveryPrice = (methodId, subtotal) => {
  if (methodId === 'pickup') return 0
  if (methodId === 'post') return DELIVERY_PRICE_POST
  if (methodId === 'courier') {
    return (Number(subtotal) || 0) > FREE_DELIVERY_FROM ? 0 : DELIVERY_PRICE_COURIER
  }
  return 0
}
