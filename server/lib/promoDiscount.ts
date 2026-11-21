// server/lib/promoDiscount.ts
// ── Акции с автоскидкой (рубрика «Акции») ────────────────────────────────
//
// ПРОБЛЕМА: новость-акция («скидка 15% на товары») — просто текст на
// витрине: цены товаров она не меняет, админ должен руками править
// price/oldPrice каждого товара и вовремя откатывать обратно.
//
// РЕШЕНИЕ (как у маркетплейсов): акция — запись новости с промо-полями
// (promoDiscount/promoCategory + productIds как цель), сроком действия
// (startsAt/endsAt) и РЕЗОЛВЕРОМ на витринных ридах: активные акции
// применяются к товарам ЧИСТОЙ ФУНКЦИЕЙ на выдаче — KV не мутируется,
// цена возвращается сама ровно в момент истечения срока (без cron:
// сравнение дат на каждый витринный запрос).
//
// Безопасность данных:
//  - KV хранит БАЗОВЫЕ цены; скидка живёт только в ответах витрины
//    (GET /api/products, /api/product/:slug, /api/news, расчёт заказа);
//  - админка читает каталог с ?raw=1 (см. products/index.get.ts) — видит
//    и правит базовые цены, «скидочная» цена никогда не уезжает в KV
//    через форму редактирования;
//  - заказ считает деньги СЕРВЕР от промо-цен (orderHelpers) — скидка
//    доезжает до чека, даже если клиентская корзина осталась со старым
//    снимком;
//  - устаревание кэшей после старта/истечения акции ограничено TTL
//    (каталог 120 с, карточка 30 с) — правки новостей дополнительно
//    пуржат каталог-кэш (см. news endpoints).
//
// Окно действия: даты YYYY-MM-DD (input type=date), сравнение лексико-
// графическое (ISO-строки сортируются как даты). endsAt ВКЛЮЧИТЕЛЬНО:
// «действует по 30.11» = активна весь день 30.11. startsAt отсутствует →
// окно открыто от прошлого (но не раньше даты публикации? — нет: date —
// витринная дата показа, окно управляет ТОЛЬКО сроком).
//
// Проверено на тестах: tests/unit/promo-discount.test.ts.

import type { H3Event } from 'h3';
import type { NewsItem } from './newsTypes';
import { readNews } from './newsHelpers';
import { readProducts, type Product, type ProductVariant } from './productHelpers';

// ─── Даты: окно действия новости/акции ───────────────────────────────────

/** Сегодняшняя дата в формате YYYY-MM-DD (UTC — единая точка отсчёта
 *  сервера и витрины; акция «до 30.11» активна весь день 30.11 UTC). */
export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Валидная ISO-дата (YYYY-MM-DD)? Пусто/битое → false. */
function isISODate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * Статус новости в окне показа (startsAt/endsAt — у ЛЮБОЙ новости):
 *  - 'scheduled' — startsAt в будущем (ещё не показываем);
 *  - 'expired'   — endsAt в прошлом (скрыли с витрины);
 *  - 'active'    — в окне (или окно не задано = бессрочно).
 */
export function newsWindowStatus(
  item: Pick<NewsItem, 'startsAt' | 'endsAt'>,
  today: string = todayISO(),
): 'scheduled' | 'active' | 'expired' {
  if (isISODate(item.startsAt) && item.startsAt > today) return 'scheduled';
  if (isISODate(item.endsAt) && item.endsAt < today) return 'expired';
  return 'active';
}

/** Витринный фильтр окна: черновики фильтрует publishedNews, окно — эта. */
export function newsInWindow(item: NewsItem, today: string = todayISO()): boolean {
  return newsWindowStatus(item, today) === 'active';
}

// ─── Акции: активность, цель, лучшая скидка ──────────────────────────────

/** Минимальная форма товара для матчинга акции (структурно — тесты проще). */
export interface PromoProductLike {
  id: string | number;
  price: number;
  categories?: string[] | null;
}

/** Валидная ли промо-скидка: целое 5–90. */
export function isValidPromoDiscount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 5 && value <= 90;
}

/**
 * Активная ли акция (запись-новость): рубрика «Акции», опубликована,
 * есть валидный процент, в окне действия. Чистая, детерминированная —
 * SSR и тесты стабильны.
 */
export function isPromoActive(item: NewsItem, today: string = todayISO()): boolean {
  if (item.category !== 'Акции') return false;
  if (item.published === false) return false;
  if (!isValidPromoDiscount(item.promoDiscount)) return false;
  return newsWindowStatus(item, today) === 'active';
}

/** Активные акции из списка новостей (порядок сохраняется). */
export function activePromos(items: NewsItem[], today: string = todayISO()): NewsItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter((n) => n && typeof n === 'object' && isPromoActive(n, today));
}

/**
 * Лучшая (максимальная) акция для товара или null. Цель акции — явный
 * выбор админа: productIds (пикер) и/или promoCategory (категория
 * каталога). АВТОПОДБОР (attachProducts для пустого productIds) целью НЕ
 * является — иначе автоподбор молча раздавал бы скидки.
 */
export function bestPromoForProduct(
  promos: NewsItem[],
  product: PromoProductLike,
): { percent: number; endsAt: string | null; newsId: string } | null {
  const productId = String(product.id);
  const categories = Array.isArray(product.categories) ? product.categories : [];
  let best: { percent: number; endsAt: string | null; newsId: string } | null = null;
  for (const promo of promos) {
    const percent = promo.promoDiscount;
    if (!isValidPromoDiscount(percent)) continue;
    const byProducts =
      Array.isArray(promo.productIds) && promo.productIds.map(String).includes(productId);
    const byCategory =
      typeof promo.promoCategory === 'string' &&
      promo.promoCategory.length > 0 &&
      categories.includes(promo.promoCategory);
    if (!byProducts && !byCategory) continue;
    // Равный процент — не перебиваем (стабильность: побеждает ранняя в списке)
    if (best && percent <= best.percent) continue;
    best = {
      percent,
      endsAt: isISODate(promo.endsAt) ? promo.endsAt : null,
      newsId: String(promo.id),
    };
  }
  return best;
}

/** Акционная цена: округление до целого (цены каталога целочисленные). */
export function promoPriceFor(price: number, percent: number): number {
  return Math.round(price * (1 - percent / 100));
}

// ─── Применение акций к выдаче ───────────────────────────────────────────

function applyToVariant(variant: ProductVariant, percent: number): ProductVariant {
  const base = variant.price;
  // price варианта не задан → наследует базу товара; при выдаче после
  // применения к товару у variant.price уже нет «наследования» — промо
  // применяется к товару ДО вариантов, variant.price undefined остаётся
  // undefined (унаследует уже акционную цену товара).
  if (typeof base !== 'number' || !Number.isFinite(base)) return variant;
  const promoPrice = promoPriceFor(base, percent);
  if (promoPrice >= base) return variant;
  // oldPrice варианта — его исходная цена (зачёркнутая), как у товара
  return { ...variant, price: promoPrice, oldPrice: base };
}

/**
 * Применяет активные акции к списку товаров: НОВЫЙ массив, вход не
 * мутируется (KV-объекты не трогаются — заказы и админка читают raw).
 * Матч (лучшая акция): price → акционная, oldPrice → исходная база
 * (если у товара уже есть oldPrice БОЛЬШЕ базы — сохраняем её: ручная
 * скидка глубже и не прячется), варианты — пропорционально, их oldPrice
 * — исходная цена варианта. Плюс витринные promoPercent/promoEndsAt
 * (плашка «акция до <даты>»). Товары без матча возвращаются КАК ЕСТЬ
 * (без клонов — накладные расходы только на попавшие под акцию).
 */
export function applyPromosToProducts<P extends Product>(
  products: readonly P[],
  promos: NewsItem[],
  today: string = todayISO(),
): P[] {
  const active = activePromos(promos, today);
  if (active.length === 0) return [...products];

  return products.map((product) => {
    if (!product || typeof product !== 'object') return product;
    const promo = bestPromoForProduct(active, product);
    if (!promo) return product;

    const base = product.price;
    if (typeof base !== 'number' || !Number.isFinite(base)) return product;
    const promoPrice = promoPriceFor(base, promo.percent);
    if (promoPrice >= base) return product;

    const oldPrice =
      typeof product.oldPrice === 'number' &&
      Number.isFinite(product.oldPrice) &&
      product.oldPrice > promoPrice
        ? product.oldPrice // ручная «цена до скидки» глубже — не прячем
        : base;

    const variants = Array.isArray(product.variants)
      ? product.variants.map((v) => applyToVariant(v, promo.percent))
      : product.variants;

    return {
      ...product,
      price: promoPrice,
      oldPrice,
      variants,
      promoPercent: promo.percent,
      promoEndsAt: promo.endsAt,
    };
  });
}

// ─── Композиция на событии: витринный срез каталога ──────────────────────

/**
 * Активные акции события: чтение новостей с отказоустойчивостью — сбой
 * KV/лимитов не роняет витрину и заказы, просто без скидок.
 */
export async function activePromosFromEvent(event: H3Event): Promise<NewsItem[]> {
  try {
    const news = await readNews(event);
    return activePromos(Array.isArray(news) ? news : []);
  } catch (e) {
    console.warn('promo: новости недоступны — скидки не применяются', e);
    return [];
  }
}

/**
 * Каталог в ПРОДАЖНЫХ ценах: raw из KV + активные акции (news из KV).
 * Чок-поинт витрины: GET /api/products, GET /api/product/:slug.
 * Админ-риды используют readProducts НАПРЯМУЮ — они видят базовые цены
 * и пишут в KV только их.
 *
 * Сбой чтения новостей не роняет выдачу каталога: нет новостей →
 * нет скидок (промо — витринная оптимизация, не источник истины).
 */
export async function readSellableProducts(event: H3Event): Promise<Product[]> {
  const products = await readProducts(event);
  const promos = await activePromosFromEvent(event);
  return applyPromosToProducts(products, promos);
}
