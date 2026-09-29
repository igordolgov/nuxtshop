// server/api/products/index.get.js
import { readProducts } from '../../lib/productHelpers'

export default defineEventHandler(async (event) => {
  try {
    const products = await readProducts(event)
    const query = getQuery(event)

    let list = products

    if (query.category) {
      list = list.filter((p) => p.categories?.includes(query.category))
    }
    if (query.inStock === 'true') {
      list = list.filter((p) => p.inStock)
    }
    if (query.minPrice) {
      list = list.filter((p) => p.price >= parseFloat(query.minPrice))
    }
    if (query.maxPrice) {
      list = list.filter((p) => p.price <= parseFloat(query.maxPrice))
    }
    if (query.search) {
      const s = query.search.toLowerCase()
      list = list.filter(
        (p) => p.name.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s),
      )
    }

    switch (query.sort) {
      case 'price-asc':
        list.sort((a, b) => a.price - b.price)
        break
      case 'price-desc':
        list.sort((a, b) => b.price - a.price)
        break
      case 'name':
        list.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        break
      case 'newest':
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        break
    }

    const page = parseInt(query.page) || 1
    const limit = parseInt(query.limit) || 0

    if (limit > 0) {
      const start = (page - 1) * limit
      return {
        products: list.slice(start, start + limit),
        pagination: {
          total: list.length,
          page,
          limit,
          totalPages: Math.ceil(list.length / limit),
        },
      }
    }

    return list
  } catch (error) {
    console.error('Ошибка получения товаров:', error)
    throw createError({ statusCode: 500, statusMessage: 'Не удалось загрузить товары' })
  }
})