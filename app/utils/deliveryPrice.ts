// app/utils/deliveryPrice.ts
// ============================================
// Единый КЛИЕНТСКИЙ источник правил доставки — зеркало
// server/lib/orderHelpers.ts. Цифры (порог бесплатного курьера, цены)
// живут в store.config.ts — один файл на клиент и сервер, не разъезжаются.
// До появления модуля цены дублировались в трёх местах и расходились:
// в корзине считался только курьер (subtotal > 2000 ? 0 : 300),
// в чекауте был свой статический список с фиксированными ценами —
// один и тот же заказ показывал две разные суммы.
// Финальную сумму всё равно пересчитывает сервер при заказе.
// ============================================

// ⚙️ НАСТРОЙКА: цифры — в store.config.ts (в валюте витрины;
// символ к сумме клеит formatMoney в шаблонах, здесь только числа)
import {
  DELIVERY_PRICE_COURIER,
  DELIVERY_PRICE_POST,
  FREE_DELIVERY_FROM,
} from '../../store.config';

export { DELIVERY_PRICE_COURIER, DELIVERY_PRICE_POST, FREE_DELIVERY_FROM };

/** Способы доставки (зеркало DeliveryMethod из server/lib/orderHelpers.ts) */
export type DeliveryMethodId = 'courier' | 'pickup' | 'post';

/**
 * Цена доставки по способу и сумме заказа.
 * Правила идентичны server/lib/orderHelpers.ts (createOrder):
 *   pickup → 0; post → всегда DELIVERY_PRICE_POST; courier → бесплатно от порога.
 */
export const getDeliveryPrice = (methodId: DeliveryMethodId, subtotal: number): number => {
  if (methodId === 'pickup') return 0;
  if (methodId === 'post') return DELIVERY_PRICE_POST;
  if (methodId === 'courier') {
    return (Number(subtotal) || 0) > FREE_DELIVERY_FROM ? 0 : DELIVERY_PRICE_COURIER;
  }
  return 0;
};
