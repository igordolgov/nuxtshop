// app/composables/useProducts.js
// ============================================
// Composable: useProducts
// Управление состоянием товаров.
// На SSR — свежий инстанс на каждый запрос.
// Административные операции (create/update/delete)
// НЕ имеют локальных fallback: ошибка сервера — ошибка в UI.
// Избранное: делегация в useFavorites, реактивность автоматическая.
// Подтверждение удаления (confirm) — ответственность вызывающего компонента.
// ============================================

import { ref, computed } from 'vue'

let productsState = null
let isInitialized = false

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

  // Человекочитаемое сообщение из ошибки $fetch (h3 кладёт тело в error.data)
  const errorMessage = (err) =>
    err?.data?.message || err?.data?.statusMessage || err?.message || 'Неизвестная ошибка'

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
      const list = Array.isArray(response) ? response : response?.products || []

      products.value = list.map((product) =>
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
      error.value = errorMessage(err)
      showNotification('error', 'Ошибка загрузки товаров')

      // Офлайн-фолбэк на чтение — легитимен для PWA
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
      const id = isObject ? productOrId.id || productOrId._id : productOrId

      if (!id) {
        console.warn('[useProducts] toggleFavorite: не передан ID или объект')
        return false
      }

      const idx = products.value.findIndex((p) => String(p.id) === String(id))
      const product = idx !== -1 ? products.value[idx] : isObject ? productOrId : null

      if (!product) {
        console.warn('[useProducts] toggleFavorite: товар не найден по ID', id)
        return false
      }

      favorites.toggleFavorite(product)

      if (idx !== -1) {
        products.value[idx] = {
          ...products.value[idx],
          isFavorite: favorites.isFavorite(id),
        }
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

      if (!response.success || !response.product) {
        throw new Error(response.message || 'Сервер не подтвердил обновление')
      }

      const index = products.value.findIndex((p) => String(p.id) === String(productId))
      const wasFavorite = favorites.isFavorite(productId)

      const merged = updateProductStockStatus(
        fixProductImages({
          ...(index !== -1 ? products.value[index] : {}),
          ...response.product,
          isFavorite: wasFavorite,
        })
      )

      if (index !== -1) {
        products.value[index] = merged
      } else {
        products.value.push(merged)
      }
      persist()
      return merged
    } catch (err) {
      console.error('[useProducts] Ошибка обновления товара:', err)
      error.value = errorMessage(err)
      showNotification('error', `Ошибка обновления товара: ${errorMessage(err)}`)
      throw err
    } finally {
      loading.value = false
    }
  }

  const createProduct = async (productData) => {
    loading.value = true
    error.value = null

    try {
      const finalData = { ...productData, inStock: productData.stockQuantity > 0 }
      const response = await $fetch('/api/products', { method: 'POST', body: finalData })

      if (!response.success || !response.product) {
        throw new Error(response.message || 'Сервер не подтвердил создание')
      }

      const newProduct = updateProductStockStatus(
        fixProductImages({ ...response.product, isFavorite: false })
      )
      products.value = [newProduct, ...products.value]
      persist()
      return newProduct
    } catch (err) {
      console.error('[useProducts] Ошибка создания товара:', err)
      error.value = errorMessage(err)
      showNotification('error', `Ошибка создания товара: ${errorMessage(err)}`)
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteProduct = async (productId) => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch(`/api/products/${productId}`, { method: 'DELETE' })
      if (!response.success) throw new Error(response.message || 'Ошибка при удалении товара')

      const idx = products.value.findIndex((p) => String(p.id) === String(productId))
      if (idx === -1) return false
      const name = products.value[idx].name
      products.value.splice(idx, 1)
      persist()
      if (favorites.isFavorite(productId)) favorites.removeFromFavorites(productId)
      showNotification('success', `Товар "${name}" удален`)
      return true
    } catch (err) {
      console.error('[useProducts] Ошибка удаления товара:', err)
      error.value = errorMessage(err)
      // 401 — сессия истекла (например, после рестарта dev-сервера)
      showNotification('error', `Ошибка удаления товара: ${errorMessage(err)}`)
      return false
    } finally {
      loading.value = false
    }
  }

  // ─── Поиск ────────────────────────────────────────────────

  const getProductBySlug = async (slug) => {
    try {
      const local = products.value.find(
        (p) => p.slug === slug || String(p.id) === String(slug)
      )
      if (local) return local

      if (!loading.value) {
        await loadProducts(true)
        const refreshed = products.value.find(
          (p) => p.slug === slug || String(p.id) === String(slug)
        )
        if (refreshed) return refreshed
      }

      try {
        const response = await $fetch(`/api/product/${slug}`)
        // Новый эндпоинт: { success, product, similarProducts }; старый: товар напрямую
        const raw = response?.product ?? response
        if (raw) {
          const product = updateProductStockStatus(
            fixProductImages({ ...raw, isFavorite: favorites.isFavorite(raw.id) })
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

  const getProductById = (id) => products.value.find((p) => String(p.id) === String(id))

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
    const idx = products.value.findIndex((p) => String(p.id) === String(productId))
    if (idx === -1) return false
    products.value[idx] = {
      ...products.value[idx],
      stockQuantity: newQuantity,
      inStock: newQuantity > 0,
    }
    persist()
    return true
  }

  const decreaseProductQuantity = (productId, amount = 1) => {
    const idx = products.value.findIndex((p) => String(p.id) === String(productId))
    if (idx === -1) return -1
    const newQuantity = Math.max(0, products.value[idx].stockQuantity - amount)
    products.value[idx] = {
      ...products.value[idx],
      stockQuantity: newQuantity,
      inStock: newQuantity > 0,
    }
    persist()
    return newQuantity
  }

  // ─── Инициализация (только клиент, только один раз) ───────
  if (import.meta.client && !isInitialized) {
    isInitialized = true

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

    // Реактивно без триггеров: isFavorite читает computed из useFavorites
    favoriteProducts: computed(() =>
      products.value.filter((p) => favorites.isFavorite(p.id))
    ),

    isFavorite: (productId) => favorites.isFavorite(productId),
    favoritesCount: computed(() => favorites.favoritesCount.value),

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