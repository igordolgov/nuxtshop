// server/api/product/[slug].js
import { getProductBySlug, getSimilarProducts } from '../../lib/productHelpers'
import { buildProductJsonLd, resolveSiteUrl } from '../../lib/seoHelpers'

export default defineEventHandler(async (event) => {
  try {
    const slugOrId = getRouterParam(event, 'slug')
    if (!slugOrId) {
      throw createError({ statusCode: 400, statusMessage: 'Не указан идентификатор товара' })
    }

    const product = await getProductBySlug(event, slugOrId)
    if (!product) {
      throw createError({ statusCode: 404, statusMessage: 'Товар не найден' })
    }

    const similarProducts = await getSimilarProducts(event, product, 4)
    // JSON-LD строится на сервере — страница и бот используют один источник
    const jsonLd = buildProductJsonLd(product, resolveSiteUrl(event))

    return { success: true, product, similarProducts, jsonLd }
  } catch (error) {
    if (error.statusCode) throw error
    console.error('Ошибка получения товара:', error)
    throw createError({ statusCode: 500, statusMessage: 'Не удалось загрузить товар' })
  }
})