// server/api/products/index.get.ts
import { readProducts } from '../../lib/productHelpers';
import { attachRatings } from '../../lib/reviewHelpers';
import { readCatalogEdgeCache, writeCatalogEdgeCache } from '../../lib/catalogEdgeCache';
// Акции: витринный срез каталога в промо-ценах (readSellableProducts)
import { readSellableProducts } from '../../lib/promoDiscount';
// Поиск: токены + fold диакритики + стемминг (копия app/utils/searchQuery.ts)
import { searchFilter, specHaystackFields } from '../../lib/searchQuery';
// raw=1 — только для админа: базовые цены БЕЗ акций (админка редактирует
// и пишет в KV только базовые; витрина без raw получает промо-цены)
import { requireAdmin } from '../../utils/auth';

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

    // raw=1 (только админ): базовые цены без активных акций. Админка
    // редактирует каталог именно по нему — иначе акционная цена попала
    // бы в форму и уехала в KV как базовая при сохранении.
    if (getQuery(event).raw === '1') {
      await requireAdmin(event);
    }

    // Витрина: readSellableProducts = raw + активные акции (старт/истечение
    // — сравнение дат на каждом запросе, KV не мутируется). Сбой чтения
    // новостей внутри не роняет выдачу (скидок просто нет).
    // raw-рид админа читает KV напрямую.
    const rawOrPromo =
      getQuery(event).raw === '1' ? await readProducts(event) : await readSellableProducts(event);

    // rating { count, average } для карточек каталога: одна пачка отзывов
    // из KV на весь список, нулевая сводка товарам без одобренных отзывов
    let list = await attachRatings(event, rawOrPromo);
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
      // Токен-совпадение с fold'ом диакритики, стеммингом, fuzzy-опечатками и
      // транслитерацией (server/lib/searchQuery.ts — копия
      // app/utils/searchQuery.ts): «galaxy samsung» находит «…Samsung Galaxy…»
      // (порядок слов), «telefono» — «Teléfono…» (без ударения),
      // «телефонов» — «телефон» (стеммер), «samsng» — «samsung» (fuzzy),
      // «самсунг» — «Samsung» (транслит); солома включает характеристики
      // (бренд из spec-листа, «AMOLED»); при пустом матче всех токенов —
      // частичный
      list = searchFilter(list, search, (p) => [
        p.name,
        p.description,
        p.categories,
        specHaystackFields(p.characteristics),
      ]);
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
    // raw=1 без сессии: 401/403 админ-гейта — не 500 (клиент показывает
    // «требуется авторизация», а не «ошибка сервера»). Остальное — как было.
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка получения товаров:', error);
    throw createError({ statusCode: 500, message: 'Не удалось загрузить товары' });
  }
});
