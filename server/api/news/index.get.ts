// server/api/news/index.get.ts
// Список новостей (GET /api/news). Публичный: читает KV `data:news`,
// при пустом хранилище отдаёт и самоисцеляет сидом (см. newsHelpers).
// Каждая новость обогащается товарами из каталога (перелинковка):
// productIds → мини-карточки NewsProductCard (attachProducts).
// Витрина (без all=1): черновики (publishedNews) И истёкшие/запланированные
// (newsInWindow — startsAt/endsAt) скрыты; мини-карточки — в промо-ценах
// (активные акции: у записи-акции свои товары со скидкой).
// ?all=1 — только для админа (401 остальным): вернуть ВСЁ (и черновики,
// и вне окна) — это кормит список AdminNews (статусы окна рисует он сам).
import { attachProducts, publishedNews, readNews, sortNewsDesc } from '../../lib/newsHelpers';
import { readProducts } from '../../lib/productHelpers';
import {
  activePromosFromEvent,
  applyPromosToProducts,
  newsInWindow,
} from '../../lib/promoDiscount';
import { requireAdmin } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const wantAll = query.all === '1' || query.all === 'true';
  if (wantAll) {
    await requireAdmin(event);
  }

  const news = await readNews(event);
  const products = await readProducts(event);
  // Черновики (published === false) и вне окна показа — только в админке
  // (all=1); витрина видит опубликованные в окне startsAt/endsAt
  const visible = wantAll ? news : publishedNews(news).filter((n) => newsInWindow(n));
  // Мини-карточки товаров — в промо-ценах: у акции-новости свои товары
  // со скидкой (истёкшая акция сама выпадает из activePromos). Сбой
  // чтения новостей внутри activePromosFromEvent не роняет выдачу.
  const promos = await activePromosFromEvent(event);
  const sellable = applyPromosToProducts(products, promos);
  return { success: true, news: sortNewsDesc(attachProducts(visible, sellable)) };
});
