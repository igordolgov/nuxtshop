// app/composables/useFavorites.js
import { ref, computed } from 'vue'

let favoritesInstance = null

export const useFavorites = () => {
  // SSR: свежий инстанс на каждый запрос
  if (import.meta.server) return createFavorites()

  if (favoritesInstance) return favoritesInstance
  favoritesInstance = createFavorites()
  return favoritesInstance
}

function createFavorites() {
  const favorites = ref(new Set())
  const favoriteProducts = ref([])

  const normalizeId = (id) => (id == null ? null : String(id))

  // ─── Загрузка / сохранение ────────────────────────────────

  const loadFavorites = () => {
    if (!import.meta.client) return
    try {
      const stored = localStorage.getItem('favoriteProducts')
      if (!stored) return

      const data = JSON.parse(stored)

      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
        favoriteProducts.value = data.map((p) => ({ ...p, id: normalizeId(p.id) }))
        favorites.value = new Set(data.map((p) => normalizeId(p.id)))
      } else if (Array.isArray(data)) {
        // legacy-формат: массив ID
        favorites.value = new Set(data.map(normalizeId))
        favoriteProducts.value = []
      }

      console.log('❤️ Загружены избранные:', favorites.value.size, 'товаров')
    } catch (err) {
      console.error('❌ Ошибка загрузки избранных:', err)
      favorites.value = new Set()
      favoriteProducts.value = []
    }
  }

  const saveFavorites = () => {
    if (!import.meta.client) return
    try {
      localStorage.setItem('favoriteProducts', JSON.stringify(favoriteProducts.value))
      console.log('💾 Избранные сохранены:', favoriteProducts.value.length, 'товаров')
    } catch (err) {
      console.error('❌ Ошибка сохранения избранных:', err)
    }
  }

  // ─── Snapshot товара для хранения ─────────────────────────

  const buildProductSnapshot = (product) => ({
    id: normalizeId(product.id || product._id),
    slug: product.slug || null,
    categorySlug: product.categorySlug || product.category?.slug || null,
    category: product.category?.name || product.category || null,
    name: product.name,
    price: product.price || product.currentPrice,
    image: product.image || product.mainImage || product.images?.[0],
    brand: product.brand,
    description: product.description,
    inStock: product.inStock ?? true,
    stockQuantity: product.stockQuantity ?? null,
  })

  // ─── API ──────────────────────────────────────────────────

  const isFavorite = (productId) => {
    const id = normalizeId(productId)
    return id !== null && favorites.value.has(id)
  }

  const addToFavorites = (product) => {
    if (!import.meta.client || !product || typeof product !== 'object') return

    const id = normalizeId(product.id || product._id)
    if (!id || favorites.value.has(id)) return

    favorites.value.add(id)
    favoriteProducts.value = [...favoriteProducts.value, buildProductSnapshot(product)]
    saveFavorites()
    console.log('❤️ Добавлен в избранное:', product.name || id)
    window.dispatchEvent(new CustomEvent('favorites-updated'))
  }

  const removeFromFavorites = (productId) => {
    if (!import.meta.client) return

    const id = normalizeId(productId)
    if (!id || !favorites.value.has(id)) return

    favorites.value.delete(id)
    favoriteProducts.value = favoriteProducts.value.filter(
      (p) => normalizeId(p.id) !== id
    )
    saveFavorites()
    console.log('💔 Удален из избранного:', id)
    window.dispatchEvent(new CustomEvent('favorites-updated'))
  }

  /**
   * Принимает либо полный объект товара, либо ID.
   * - Объект → корректно добавит или удалит.
   * - ID → может только удалить (для добавления нет данных).
   */
  const toggleFavorite = (productOrId) => {
    if (!import.meta.client) return

    const isObject = productOrId && typeof productOrId === 'object'
    const id = normalizeId(isObject ? productOrId.id || productOrId._id : productOrId)
    if (!id) return

    if (favorites.value.has(id)) {
      removeFromFavorites(id)
      return
    }

    if (!isObject) {
      console.warn(
        '[useFavorites] toggleFavorite: для добавления нужен объект товара, получен ID:',
        id
      )
      return
    }

    addToFavorites(productOrId)
  }

  const clearAllFavorites = () => {
    if (!import.meta.client) return
    favorites.value = new Set()
    favoriteProducts.value = []
    saveFavorites()
    console.log('🗑️ Все избранные товары очищены')
    window.dispatchEvent(new CustomEvent('favorites-updated'))
  }

  if (import.meta.client) loadFavorites()

  return {
    favorites: computed(() => favorites.value),
    favoriteIds: computed(() => Array.from(favorites.value)),
    favoriteProducts: computed(() => favoriteProducts.value),
    favoritesCount: computed(() => favorites.value.size),

    isFavorite,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    loadFavorites,
    clearAllFavorites,
  }
}