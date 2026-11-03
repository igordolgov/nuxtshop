// server/api/product/[slug].ts
import { getProductBySlug, getSimilarProducts } from '../../lib/productHelpers';
import { approvedReviews, ratingSummary, readReviews } from '../../lib/reviewHelpers';
import { buildProductJsonLd, resolveSiteUrl } from '../../lib/seoHelpers';
import { localizedProduct } from '../../lib/localizedProduct';

// Локали, для которых карточка отдаёт локализованный JSON-LD (name,
// description, category, canonical offers.url с префиксом). Передаётся
// страницей товара (?lang=…): сам API-маршрут без префикса, своей
// локали у него нет. ru — дефолт и для битых значений.
const JSON_LD_LOCALES = new Set(['en', 'es']);

export default defineEventHandler(async (event) => {
  try {
    const slugOrId = getRouterParam(event, 'slug');
    if (!slugOrId) {
      throw createError({ statusCode: 400, message: 'Не указан идентификатор товара' });
    }

    const product = await getProductBySlug(event, slugOrId);
    if (!product) {
      throw createError({ statusCode: 404, message: 'Товар не найден' });
    }

    // Локализация JSON-LD под префикс страницы (/en/product/… запрашивает
    // ?lang=en): бот видит name/category/canonical того же языка, что и
    // SSR-HTML. Витринные поля остаются полными (клиент локализует сам).
    const langParam = String(getQuery(event).lang ?? '');
    const jsonLdLocale = JSON_LD_LOCALES.has(langParam) ? langParam : 'ru';
    const productView = localizedProduct(product, jsonLdLocale);

    const similarProducts = await getSimilarProducts(event, product, 4);

    // Одобренные отзывы товара: блок на карточке + aggregateRating в JSON-LD
    // (звёзды в выдаче поисковиков). Не прошедшие модерацию — не видны.
    const allReviews = await readReviews(event);
    const reviews = approvedReviews(allReviews, String(product.id));
    const ratingSummaryValue = ratingSummary(reviews);

    // JSON-LD строится на сервере — страница и бот используют один источник;
    // с ?lang=en|es — локализованная версия (name/description/category +
    // канонический URL с префиксом локали)
    const jsonLd = buildProductJsonLd(
      productView,
      resolveSiteUrl(event),
      'RUB',
      ratingSummaryValue.count > 0 ? ratingSummaryValue : null,
      { localePrefix: jsonLdLocale },
    );

    return {
      success: true,
      product,
      similarProducts,
      reviews,
      ratingSummary: ratingSummaryValue,
      jsonLd,
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка получения товара:', error);
    throw createError({ statusCode: 500, message: 'Не удалось загрузить товар' });
  }
});
