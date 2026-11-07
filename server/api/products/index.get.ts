// server/api/products/index.get.ts
import { readProducts } from '../../lib/productHelpers';
import { attachRatings } from '../../lib/reviewHelpers';
import { readCatalogEdgeCache, writeCatalogEdgeCache } from '../../lib/catalogEdgeCache';

export default defineEventHandler(async (event) => {
  try {
    // Edge-кэш витринной выдачи: холодный изолят + чтение KV каталога и
    // отзывов доходило до 1–2 с TTFB, и LCP главной уезжал за 4 с
    // (PageSpeed, mobile). Cache API переживает смерть изолята — полная
    // цена чтения платится один раз за TTL на коло. Мутирующие сценарии
    // читают KV напрямую (readProducts), инвалидация — в writeProducts
    // и при смене approved отзыва: кэш не участвует в read-modify-write.
    const cachedList = await readCatalogEdgeCache<Awaited<ReturnType<typeof attachRatings>>>(event);
    if (cachedList) {
      setHeader(event, 'x-catalog-cache', 'hit');
      return cachedList;
    }

    const products = await readProducts(event);
    // rating { count, average } для карточек каталога: одна пачка отзывов
    // из KV на весь список, нулевая сводка товарам без одобренных отзывов
    let list = await attachRatings(event, products);
    const query = getQuery(event);

    const category = query.category as string | undefined;
    const minPrice = query.minPrice as string | undefined;
    const maxPrice = query.maxPrice as string | undefined;
    const search = query.search as string | undefined;

    if (category) {
      list = list.filter((p) => p.categories?.includes(category));
    }
    if (minPrice) {
      list = list.filter((p) => p.price >= parseFloat(minPrice));
    }
    if (maxPrice) {
      list = list.filter((p) => p.price <= parseFloat(maxPrice));
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s),
      );
    }

    switch (query.sort) {
      case 'price-asc':
        list.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        list.sort((a, b) => b.price - a.price);
        break;
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
        break;
      case 'newest':
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    const page = parseInt(String(query.page)) || 1;
    const limit = parseInt(String(query.limit)) || 0;

    if (limit > 0) {
      const start = (page - 1) * limit;
      return {
        products: list.slice(start, start + limit),
        pagination: {
          total: list.length,
          page,
          limit,
          totalPages: Math.ceil(list.length / limit),
        },
      };
    }

    // «Чистый» запрос (без query) — горячий путь витрины и SSR главной:
    // кладём в edge-кэш на TTL, следящий запросам отдаётся без чтения KV.
    setHeader(event, 'x-catalog-cache', 'miss');
    await writeCatalogEdgeCache(event, list);

    return list;
  } catch (error) {
    console.error('Ошибка получения товаров:', error);
    throw createError({ statusCode: 500, message: 'Не удалось загрузить товары' });
  }
});
