// server/lib/boughtTogetherHelpers.ts
// «Часто покупают вместе» (Amazon Frequently Bought Together): товары,
// которые чаще всего оказываются в одном заказе с текущим.
//
// Данные — заказы из KV data:orders (readOrders). Отдельный индекс не
// ведём: масштаб проекта — сотни заказов (⚠️ в orderHelpers), вычисление
// ко-встречаемости на лету — один KV-read в уже существующем запросе
// /api/product/[slug] (там же читаются отзывы). Отменённые заказы
// покупкой не считаются.
import type { H3Event } from 'h3';
import { readOrders, type Order } from './orderHelpers';
import { readProducts, type Product } from './productHelpers';

/** Статусы заказов, которые не считаются покупкой. */
const NON_PURCHASE_STATUSES: ReadonlySet<string> = new Set(['cancelled']);

/**
 * Базовый id товара из id позиции заказа. У варианта позиция ключуется
 * составным «productId::variantId» (витрина собирает через cartLineId,
 * сервер разбирает тем же разделителем '::' — см. orderHelpers.createOrder).
 * Разделитель в самом productId не встречается.
 */
export function baseProductId(lineId: string): string {
  const s = String(lineId);
  const sep = s.indexOf('::');
  return sep === -1 ? s : s.slice(0, sep);
}

export interface BoughtTogetherEntry {
  productId: string;
  /** В скольких заказах товары встретились вместе. */
  count: number;
  /** Момент последней совместной покупки (тай-брейк сортировки). */
  lastAt: string;
}

/**
 * Чистая функция (покрыта тестами): id товаров, чаще всего покупаемых
 * вместе с currentId. Порядок — по числу совместных заказов убыв.,
 * при равенстве — по свежести последней совместной покупки.
 * Один заказ добавляет пару один раз, независимо от количества позиций.
 */
export function computeBoughtTogether(
  orders: Order[],
  currentId: string,
  limit = 3,
): BoughtTogetherEntry[] {
  const target = String(currentId);
  if (!target) return [];
  const stats = new Map<string, BoughtTogetherEntry>();
  for (const order of orders ?? []) {
    if (!order || NON_PURCHASE_STATUSES.has(order.status)) continue;
    const ids = new Set<string>();
    for (const item of order.items ?? []) {
      const id = baseProductId(String(item?.id ?? ''));
      if (id) ids.add(id);
    }
    if (!ids.has(target)) continue;
    for (const id of ids) {
      if (id === target) continue;
      const prev = stats.get(id);
      if (prev) {
        prev.count += 1;
        if (order.createdAt > prev.lastAt) prev.lastAt = order.createdAt;
      } else {
        stats.set(id, { productId: id, count: 1, lastAt: order.createdAt ?? '' });
      }
    }
  }
  return [...stats.values()]
    .sort((a, b) => b.count - a.count || (b.lastAt > a.lastAt ? 1 : b.lastAt < a.lastAt ? -1 : 0))
    .slice(0, Math.max(0, limit));
}

/**
 * Карточки товаров для блока: co-purchase id → товары из каталога.
 * Удалённые из каталога id пропускаются (снапшоты в заказах переживают
 * товар); наличие и цену показывает витрина, как в «Похожих».
 */
export async function getBoughtTogetherProducts(
  event: H3Event,
  current: Product,
  limit = 3,
): Promise<Product[]> {
  const orders = await readOrders(event);
  const top = computeBoughtTogether(orders, String(current.id), limit);
  if (top.length === 0) return [];
  const products = await readProducts(event);
  const byId = new Map(products.map((p) => [String(p.id), p] as const));
  const result: Product[] = [];
  for (const { productId } of top) {
    const product = byId.get(productId);
    if (product) result.push(product);
  }
  return result;
}
