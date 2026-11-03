// server/api/products/index.get.ts
import { readProducts } from '../../lib/productHelpers';
import { attachRatings } from '../../lib/reviewHelpers';

export default defineEventHandler(async (event) => {
  try {
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

    return list;
  } catch (error) {
    console.error('Ошибка получения товаров:', error);
    throw createError({ statusCode: 500, message: 'Не удалось загрузить товары' });
  }
});
