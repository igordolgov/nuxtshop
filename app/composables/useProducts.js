// app/composables/useProducts.js
// ============================================
// Composable: useProducts
// Управление состоянием товаров.
// На SSR — свежий инстанс на каждый запрос.
// ============================================

import { ref, computed } from 'vue'

let productsState = null
let isInitialized = false
let eventListenerAdded = false

export const useProducts = () => {
  if (import.meta.server) return createProducts()

  if (productsState) return productsState
  productsState = createProducts()
  return productsState
}

function createProducts() {
  const { $notify } = useNuxtApp()

  const products = ref([])
  const loading = ref(false)
  const error = ref(null)

  const favorites = useFavorites()
  const favoritesUpdateTrigger = ref(0)

  let cachedCategories = []
  let lastProductsForCategories = ''

  // ─── Утилиты ──────────────────────────────────────────────

  const fixImageUrl = (url) => {
    if (!url || url === 'null' || url === 'undefined') return '/images/placeholder.jpg'
    if (url.startsWith('data:')) return url
    if (url.startsWith('photo-') || url.match(/^photo-[a-zA-Z0-9-]+/))
      return `https://images.unsplash.com/${url}`
    if (url.includes('unsplash.com')) return url
    if (url.startsWith('images/') || url.startsWith('products/')) return `/${url}`
    if (url.includes('.') && !url.includes('/')) return `/images/${url}`
    if (url.startsWith('/')) return url
    if (url.startsWith('http')) return url
    return '/images/placeholder.jpg'
  }

  const fixProductImages = (product) => {
    if (!product) return product
    const fixed = { ...product }
    if (fixed.image) fixed.image = fixImageUrl(fixed.image)
    if (Array.isArray(fixed.gallery)) {
      fixed.gallery = fixed.gallery
        .map((img) => fixImageUrl(img))
        .filter((img) => img && img !== '/images/placeholder.jpg')
    }
    return fixed
  }

  const showNotification = (type, message) => {
    if (!import.meta.client) return
    if ($notify) {
      if (type === 'success') $notify.success(message)
      else if (type === 'error') $notify.error(message)
      else $notify.info(message)
      return
    }
    console.log(`[${type.toUpperCase()}] ${message}`)
  }

  const updateProductStockStatus = (product) => ({
    ...product,
    inStock: product.stockQuantity > 0,
  })

  const cleanProductsForStorage = (list) => {
    if (!Array.isArray(list)) return []
    return list.map((product) => {
      const cleaned = { ...product }
      if (cleaned.image?.startsWith('data:') && cleaned.image.length > 100000) {
        cleaned.image = '/images/placeholder.jpg'
      }
      if (Array.isArray(cleaned.gallery)) {
        cleaned.gallery = cleaned.gallery
          .map((img) =>
            img?.startsWith('data:') && img.length > 100000
              ? '/images/placeholder.jpg'
              : img
          )
          .filter(Boolean)
      }
      return cleaned
    })
  }

  const persist = () => {
    if (!import.meta.client) return
    try {
      localStorage.setItem('products', JSON.stringify(cleanProductsForStorage(products.value)))
    } catch (e) {
      console.warn('[useProducts] localStorage save failed:', e.message)
    }
  }

  // ─── Загрузка ─────────────────────────────────────────────

  const loadProducts = async (force = false) => {
    if (products.value.length > 0 && !force) return products.value

    loading.value = true
    error.value = null

    try {
      const response = await $fetch('/api/products')
      products.value = response.map((product) =>
        updateProductStockStatus(
          fixProductImages({
            ...product,
            isFavorite: favorites.isFavorite(product.id),
          })
        )
      )
      persist()
      return products.value
    } catch (err) {
      console.error('[useProducts] Ошибка загрузки товаров:', err)
      error.value = err.message
      showNotification('error', 'Ошибка загрузки товаров')

      if (import.meta.client) {
        try {
          const cached = localStorage.getItem('products')
          if (cached) {
            products.value = JSON.parse(cached).map((product) =>
              updateProductStockStatus(
                fixProductImages({
                  ...product,
                  isFavorite: favorites.isFavorite(product.id),
                })
              )
            )
            showNotification('info', 'Используются кэшированные данные')
          }
        } catch (localStorageError) {
          console.warn('[useProducts] localStorage read failed:', localStorageError.message)
        }
      }
      return []
    } finally {
      loading.value = false
    }
  }

  // ─── CRUD ─────────────────────────────────────────────────

  const toggleFavorite = async (productOrId) => {
    try {
      const isObject = productOrId && typeof productOrId === 'object'
      const id = isObject ? (productOrId.id || productOrId._id) : productOrId

      if (!id) {
        console.warn('[useProducts] toggleFavorite: не передан ID или объект')
        return false
      }

      // Ищем товар — сравниваем строкой, чтобы 1 === "1"
      const idx = products.value.findIndex((p) => String(p.id) === String(id))
      const product = idx !== -1 ? products.value[idx] : (isObject ? productOrId : null)

      if (!product) {
        console.warn('[useProducts] toggleFavorite: товар не найден по ID', id)
        return false
      }

      // useFavorites.toggleFavorite принимает и объект, и ID — оба работают
      favorites.toggleFavorite(product)

      // Обновляем флаг isFavorite в массиве товаров
      if (idx !== -1) {
        products.value[idx].isFavorite = favorites.isFavorite(id)
        persist()
      }

      return true
    } catch (err) {
      console.error('[useProducts] Ошибка переключения избранного:', err)
      showNotification('error', 'Ошибка при обновлении избранного')
      return false
    }
  }

  const updateProduct = async (productId, updatedData) => {
    loading.value = true
    error.value = null

    try {
      const finalData = { ...updatedData, inStock: updatedData.stockQuantity > 0 }
      const response = await $fetch(`/api/products/${productId}`, {
        method: 'PUT',
        body: finalData,
      })

      if (!response.success) throw new Error(response.message || 'Ошибка при обновлении товара')

      const index = products.value.findIndex((p) => p.id === productId)
      const wasFavorite = favorites.isFavorite(productId)

      if (index !== -1) {
        products.value[index] = updateProductStockStatus(
          fixProductImages({
            ...products.value[index],
            ...response.product,
            isFavorite: wasFavorite,
          })
        )
      } else {
        products.value.push(
          updateProductStockStatus(
            fixProductImages({ ...response.product, isFavorite: wasFavorite })
          )
        )
      }
      persist()
      showNotification('success', 'Товар успешно обновлен')
      return index !== -1 ? products.value[index] : products.value[products.value.length - 1]
    } catch (err) {
      console.error('[useProducts] Ошибка обновления товара:', err)
      showNotification('error', `Ошибка обновления товара: ${err.message || 'Неизвестная ошибка'}`)

      const index = products.value.findIndex((p) => p.id === productId)
      if (index !== -1) {
        products.value[index] = updateProductStockStatus(
          fixProductImages({
            ...products.value[index],
            ...updatedData,
            isFavorite: favorites.isFavorite(productId),
            updatedAt: new Date().toISOString(),
          })
        )
        persist()
        showNotification('info', 'Товар обновлен локально (ошибка сервера)')
        return products.value[index]
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  const createProduct = async (productData) => {
    loading.value = true
    error.value = null

    const buildFallback = (data) =>
      updateProductStockStatus(
        fixProductImages({
          id: Date.now().toString(),
          name: data.name,
          description: data.description || '',
          price: data.price,
          categories: data.categories,
          image: data.image || '',
          gallery: data.gallery || [],
          inStock: data.stockQuantity > 0,
          stockQuantity: data.stockQuantity || 0,
          isFavorite: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          slug: `${data.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        })
      )

    try {
      const finalData = { ...productData, inStock: productData.stockQuantity > 0 }
      const response = await $fetch('/api/products', { method: 'POST', body: finalData })

      let newProduct
      if (response.success && response.product) {
        newProduct = updateProductStockStatus(fixProductImages({ ...response.product, isFavorite: false }))
      } else if (response.id) {
        newProduct = updateProductStockStatus(fixProductImages({ ...response, isFavorite: false }))
      } else {
        newProduct = buildFallback(productData)
      }

      products.value = [newProduct, ...products.value]
      persist()
      showNotification('success', 'Товар успешно создан')
      return newProduct
    } catch (err) {
      console.error('[useProducts] Ошибка создания товара:', err)
      showNotification('error', `Ошибка создания товара: ${err.message || 'Неизвестная ошибка'}`)

      const newProduct = buildFallback(productData)
      products.value = [newProduct, ...products.value]
      showNotification('info', 'Товар создан локально (ошибка сервера)')
      return newProduct
    } finally {
      loading.value = false
    }
  }

  const deleteProduct = async (productId) => {
    if (import.meta.client) {
      const confirmed = window.confirm('Вы уверены, что хотите удалить этот товар?')
      if (!confirmed) return false
    }

    loading.value = true
    error.value = null

    const removeLocally = () => {
      const idx = products.value.findIndex((p) => p.id === productId)
      if (idx === -1) return null
      const name = products.value[idx].name
      products.value.splice(idx, 1)
      persist()
      if (favorites.isFavorite(productId)) favorites.removeFromFavorites(productId)
      return name
    }

    try {
      const response = await $fetch(`/api/products/${productId}`, { method: 'DELETE' })
      if (!response.success) throw new Error(response.message || 'Ошибка при удалении товара')

      const name = removeLocally()
      if (name) {
        showNotification('success', `Товар "${name}" удален`)
        return true
      }
      return false
    } catch (err) {
      console.error('[useProducts] Ошибка удаления товара:', err)
      showNotification('error', `Ошибка удаления товара: ${err.message || 'Неизвестная ошибка'}`)

      const name = removeLocally()
      if (name) {
        showNotification('info', `Товар "${name}" удален локально (ошибка сервера)`)
        return true
      }
      return false
    } finally {
      loading.value = false
    }
  }

  // ─── Поиск ────────────────────────────────────────────────

  const getProductBySlug = async (slug) => {
    try {
      const local = products.value.find((p) => p.slug === slug || p.id === slug)
      if (local) return local

      if (!loading.value) {
        await loadProducts(true)
        const refreshed = products.value.find((p) => p.slug === slug || p.id === slug)
        if (refreshed) return refreshed
      }

      try {
        const response = await $fetch(`/api/product/${slug}`)
        if (response) {
          const product = updateProductStockStatus(
            fixProductImages({ ...response, isFavorite: favorites.isFavorite(response.id) })
          )
          products.value.push(product)
          return product
        }
      } catch (apiError) {
        console.warn('[useProducts] Ошибка API поиска товара:', apiError)
      }
      return null
    } catch (err) {
      console.error('[useProducts] Ошибка поиска товара по slug:', err)
      return null
    }
  }

  const getProductById = (id) => products.value.find((p) => p.id === id)

  const getProductsByCategory = (category) => {
    if (!category) return products.value
    return products.value.filter((p) => p.categories?.includes(category))
  }

  const searchProducts = (query) => {
    if (!query) return products.value
    const term = query.toLowerCase()
    return products.value.filter(
      (p) =>
        p.name?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term) ||
        p.categories?.some((c) => c.toLowerCase().includes(term))
    )
  }

  const filterProducts = (filters) => {
    let filtered = products.value
    if (filters.category) filtered = filtered.filter((p) => p.categories?.includes(filters.category))
    if (filters.minPrice !== undefined) filtered = filtered.filter((p) => p.price >= filters.minPrice)
    if (filters.maxPrice !== undefined) filtered = filtered.filter((p) => p.price <= filters.maxPrice)
    if (filters.inStock !== undefined) filtered = filtered.filter((p) => p.inStock === filters.inStock)
    if (filters.search) {
      const term = filters.search.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name?.toLowerCase().includes(term) ||
          p.description?.toLowerCase().includes(term)
      )
    }
    return filtered
  }

  const sortProducts = (list, sortBy) => {
    if (!sortBy?.field) return list
    const { field, direction = 'asc' } = sortBy
    const mult = direction === 'desc' ? -1 : 1
    return [...list].sort((a, b) => {
      switch (field) {
        case 'name':
          return mult * a.name.localeCompare(b.name)
        case 'price':
          return mult * (a.price - b.price)
        case 'date':
          return mult * (new Date(a.createdAt) - new Date(b.createdAt))
        default:
          return 0
      }
    })
  }

  const updateProductQuantity = (productId, newQuantity) => {
    const idx = products.value.findIndex((p) => p.id === productId)
    if (idx === -1) return false
    products.value[idx].stockQuantity = newQuantity
    products.value[idx].inStock = newQuantity > 0
    persist()
    return true
  }

  const decreaseProductQuantity = (productId, amount = 1) => {
    const idx = products.value.findIndex((p) => p.id === productId)
    if (idx === -1) return -1
    const newQuantity = Math.max(0, products.value[idx].stockQuantity - amount)
    products.value[idx].stockQuantity = newQuantity
    products.value[idx].inStock = newQuantity > 0
    persist()
    return newQuantity
  }

  // ─── Инициализация (только клиент, только один раз) ───────
  if (import.meta.client && !isInitialized) {
    isInitialized = true

    if (!eventListenerAdded) {
      eventListenerAdded = true
      window.addEventListener('favorites-updated', () => {
        favoritesUpdateTrigger.value++
        if (products.value.length > 0) {
          products.value = products.value.map((product) => ({
            ...product,
            isFavorite: favorites.isFavorite(product.id),
          }))
          persist()
        }
      })
    }

    loadProducts(true).catch((err) => {
      console.warn('[useProducts] Загрузка не удалась:', err)
    })
  }

  // ─── Публичный API ────────────────────────────────────────
  return {
    products: computed(() => products.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),

    categories: computed(() => {
      const current = products.value
      const key = current.map((p) => p.id).join(',')
      if (key === lastProductsForCategories) return cachedCategories
      lastProductsForCategories = key
      const all = current.flatMap((p) => p.categories || [])
      cachedCategories = [...new Set(all)].sort((a, b) => a.localeCompare(b))
      return cachedCategories
    }),

    favoriteProducts: computed(() => {
      // eslint-disable-next-line no-unused-expressions
      favoritesUpdateTrigger.value
      return products.value.filter((p) => favorites.isFavorite(p.id))
    }),

    isFavorite: (productId) => favorites.isFavorite(productId),
    favoritesCount: computed(() => favorites.favoritesCount),

    loadProducts,
    updateProduct,
    createProduct,
    deleteProduct,
    getProductBySlug,
    getProductById,

    getProductsByCategory,
    searchProducts,
    filterProducts,
    sortProducts,
    toggleFavorite,
    updateProductQuantity,
    decreaseProductQuantity,
  }
}