// server/api/product/[slug].js
export default defineEventHandler(async (event) => {
  const slug = event.context.params.slug
  
  try {
    // Загружаем все товары
    const products = await $fetch('/api/products')
    
    // Ищем товар по slug или id
    const product = products.find(p => 
      p.slug === slug || 
      String(p.id) === String(slug)
    )
    
    if (product) {
      return product
    } else {
      // Если не нашли, пробуем найти по slugify названия
      const slugify = (str) => {
        if (!str) return ''
        return str
          .toLowerCase()
          .replace(/[^a-z0-9а-яё\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()
      }
      
      const foundBySlugify = products.find(p => 
        slugify(p.name) === slug
      )
      
      if (foundBySlugify) {
        return foundBySlugify
      }
      
      throw createError({
        statusCode: 404,
        statusMessage: 'Product not found'
      })
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load product'
    })
  }
})