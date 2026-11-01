// server/api/product/[slug].js
import { getProductBySlug, getSimilarProducts } from '../../lib/productHelpers'
import { approvedReviews, ratingSummary, readReviews } from '../../lib/reviewHelpers'
import { buildProductJsonLd, resolveSiteUrl } from '../../lib/seoHelpers'

export default defineEventHandler(async (event) => {
  try {
    const slugOrId = getRouterParam(event, 'slug')
    if (!slugOrId) {
      throw createError({ statusCode: 400, message: 'Не указан идентификатор товара' })
    }

    const product = await getProductBySlug(event, slugOrId)
    if (!product) {
      throw createError({ statusCode: 404, message: 'Товар не найден' })
    }

    const similarProducts = await getSimilarProducts(event, product, 4)

    // Одобренные отзывы товара: блок на карточке + aggregateRating в JSON-LD
    // (звёзды в выдаче поисковиков). Не прошедшие модерацию — не видны.
    const allReviews = await readReviews(event)
    const reviews = approvedReviews(allReviews, String(product.id))
    const ratingSummaryValue = ratingSummary(reviews)

    // JSON-LD строится на сервере — страница и бот используют один источник
    const jsonLd = buildProductJsonLd(
      product,
      resolveSiteUrl(event),
      'RUB',
      ratingSummaryValue.count > 0 ? ratingSummaryValue : null,
    )

    return {
      success: true,
      product,
      similarProducts,
      reviews,
      ratingSummary: ratingSummaryValue,
      jsonLd,
    }
  } catch (error) {
    if (error.statusCode) throw error
    console.error('Ошибка получения товара:', error)
    throw createError({ statusCode: 500, message: 'Не удалось загрузить товар' })
  }
})