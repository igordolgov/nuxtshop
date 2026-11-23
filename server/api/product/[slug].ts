// server/api/product/[slug].ts
import { getBoughtTogetherProducts } from '../../lib/boughtTogetherHelpers';
import { getProductBySlug, getSimilarProducts, type Product } from '../../lib/productHelpers';
import {
  approvedReviews,
  publicReviewView,
  ratingSummary,
  readReviews,
  type RatingSummary,
} from '../../lib/reviewHelpers';
import { getSessionUser } from '../../utils/auth';
import { buildProductJsonLd, resolveSiteUrl } from '../../lib/seoHelpers';
import { localizedProduct } from '../../lib/localizedProduct';
import {
  PRODUCT_CARD_JSON_LD_LOCALES,
  readProductCardEdgeCache,
  writeProductCardEdgeCache,
} from '../../lib/productEdgeCache';
// Акции: витринные цены карточки/похожих/FBT (raw KV + активные акции)
import { readSellableProducts } from '../../lib/promoDiscount';

// Витринный ответ карточки: тип-договор для edge-кэша (JSON туда-обратно,
// анонимный ответ одинаков для всех гостей — см. productEdgeCache).
type ProductCardPayload = {
  success: true;
  product: Product;
  boughtTogether: Product[];
  similarProducts: Product[];
  reviews: ReturnType<typeof publicReviewView>[];
  ratingSummary: RatingSummary;
  jsonLd: Record<string, unknown>;
};

export default defineEventHandler(async (event) => {
  try {
    const slugOrId = getRouterParam(event, 'slug');
    if (!slugOrId) {
      throw createError({ statusCode: 400, message: 'Не указан идентификатор товара' });
    }

    // Edge-кэш витринного ответа: холодный изолят читал из KV каталог,
    // заказы и отзывы (до 5 чтений) — TTFB корневого документа доходил до
    // ~1,8 с (Lighthouse mobile). Cache API коло переживает смерть
    // изолята; только анонимы — у залогиненных ответ персональный
    // (likedByMe в отзывах), они читают KV как раньше. См. productEdgeCache.
    const cachedCard = await readProductCardEdgeCache<ProductCardPayload>(event, slugOrId);
    if (cachedCard) {
      setHeader(event, 'x-product-card-cache', 'hit');
      return cachedCard;
    }
    setHeader(event, 'x-product-card-cache', 'miss');

    // Одно чтение каталога на весь ответ: слаг, «Похожие» и «Часто
    // покупают вместе» раньше читали KV независимо (до 3 раз на запрос).
    // Витринные цены: активные акции применены (карточка, похожие, FBT и
    // JSON-LD price согласованы); KV не мутируется, истечение срока
    // отзывает скидку само. Устаревание — не позже TTL кэша (30 с).
    const allProducts = await readSellableProducts(event);
    const product = await getProductBySlug(event, slugOrId, allProducts);
    if (!product) {
      throw createError({ statusCode: 404, message: 'Товар не найден' });
    }

    // Локализация JSON-LD под префикс страницы (/en/product/… запрашивает
    // ?lang=en): бот видит name/category/canonical того же языка, что и
    // SSR-HTML. Витринные поля остаются полными (клиент локализует сам).
    // Набор локали — общий с ключом edge-кэша (PRODUCT_CARD_JSON_LD_LOCALES):
    // ключ и содержимое ответа не могут разойтись.
    const langParam = String(getQuery(event).lang ?? '');
    const jsonLdLocale = PRODUCT_CARD_JSON_LD_LOCALES.has(langParam) ? langParam : 'ru';
    const productView = localizedProduct(product, jsonLdLocale);

    const similarProducts = await getSimilarProducts(event, product, 4, allProducts);

    // «Часто покупают вместе» (Amazon FBT): товары из одних заказов с
    // текущим. Пустой массив — совместных покупок ещё не было, витрина
    // блок не рисует. Тот же запрос, что и похожие: один KV-read заказов.
    const boughtTogether = await getBoughtTogetherProducts(event, product, 3, allProducts);

    // Одобренные отзывы товара: блок на карточке + aggregateRating в JSON-LD
    // (звёзды в выдаче поисковиков). Не прошедшие модерацию — не видны.
    // publicReviewView скрывает helpfulBy (id пользователей): наружу — только
    // счётчик «полезно» и факт отметки ТЕКУЩЕГО пользователя (null у гостей).
    const allReviews = await readReviews(event);
    const sessionUser = await getSessionUser(event);
    const reviews = approvedReviews(allReviews, String(product.id)).map((r) =>
      publicReviewView(r, sessionUser?.id ?? null),
    );
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

    const payload: ProductCardPayload = {
      success: true,
      product,
      boughtTogether,
      similarProducts,
      reviews,
      ratingSummary: ratingSummaryValue,
      jsonLd,
    };

    // Витринный ответ анонимов — в edge-кэш на TTL (успешные ответы;
    // у залогиненных write молча пропустит — см. productEdgeCache).
    await writeProductCardEdgeCache(event, slugOrId, payload);

    return payload;
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('Ошибка получения товара:', error);
    throw createError({ statusCode: 500, message: 'Не удалось загрузить товар' });
  }
});
