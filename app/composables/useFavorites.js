// app/composables/useFavorites.js
// ============================================
// Composable: useFavorites
// Единственный источник правды по избранному.
// Реактивный массив снапшотов + автосохранение в localStorage.
// Новые товары добавляются сверху — порядок стабилен между перезагрузками.
// ============================================

import { ref, computed, watch } from 'vue'

const STORAGE_KEY = 'favoriteProducts'
// Ключи от старой второй системы избранного — вычищаем при загрузке
const LEGACY_KEYS = ['userFavorites']

let favoritesInstance = null

export const useFavorites = () => {
  // SSR: свежий инстанс на каждый запрос — никакого шаринга между пользователями
  if (import.meta.server) return createFavorites()

  if (!favoritesInstance) favoritesInstance = createFavorites()
  return favoritesInstance
}

function createFavorites() {
  // Единственное мутируемое состояние. Всё остальное — computed от него,
  // поэтому any изменение автоматически обновляет всех потребителей.
  const items = ref([])

  const normalizeId = (id) => (id == null ? null : String(id))

  // ─── Производные (реактивные) ─────────────────────────────
  const favoriteIdSet = computed(() => new Set(items.value.map((p) => p.id)))
  const favoriteIds = computed(() => items.value.map((p) => p.id))
  const favoritesCount = computed(() => items.value.length)

  // ─── Персистентность ──────────────────────────────────────

  const save = () => {
    if (!import.meta.client) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
    } catch (err) {
      console.error('[useFavorites] Ошибка сохранения:', err)
    }
  }

  // Автосохранение при любом изменении — никаких ручных saveFavorites()
  if (import.meta.client) {
    watch(items, save, { deep: true })
  }

  // Снапшот товара для хранения — минимум полей для карточки избранного
  const buildSnapshot = (product) => ({
    id: normalizeId(product.id || product._id),
    slug: product.slug ?? null,
    name: product.name ?? '',
    price: product.price ?? product.currentPrice ?? null,
    image:
      product.image ??
      product.mainImage ??
      (Array.isArray(product.images) ? product.images[0] : null),
    category: typeof product.category === 'string' ? product.category : product.category?.name ?? null,
    categorySlug: product.categorySlug ?? product.category?.slug ?? null,
    brand: product.brand ?? null,
    description: product.description ?? '',
    inStock: product.inStock ?? true,
    stockQuantity: product.stockQuantity ?? null,
    addedAt: new Date().toISOString(),
  })

  const normalizeSnapshot = (p, index) => ({
    id: normalizeId(p.id),
    slug: p.slug ?? null,
    name: p.name ?? '',
    price: p.price ?? p.currentPrice ?? null,
    image:
      p.image ??
      p.mainImage ??
      (Array.isArray(p.images) ? p.images[0] : null),
    category: p.category ?? null,
    categorySlug: p.categorySlug ?? null,
    brand: p.brand ?? null,
    description: p.description ?? '',
    inStock: p.inStock ?? true,
    stockQuantity: p.stockQuantity ?? null,
    // Старые записи без addedAt: сохраняем относительный порядок,
    // более поздние в списке считаются более новыми
    addedAt: p.addedAt ?? new Date(Date.now() - index * 1000).toISOString(),
  })

  const load = () => {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return

      const data = JSON.parse(raw)
      if (!Array.isArray(data)) return

      // Принимаем только снапшоты-объекты с id.
      // Legacy-формат (голый массив id) отбрасываем — карточки из него
      // всё равно не собрать.
      items.value = data
        .filter((p) => p && typeof p === 'object' && p.id != null)
        .map(normalizeSnapshot)
        .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))

      // Убираем ключи от старой дублирующей системы
      LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))
    } catch (err) {
      console.error('[useFavorites] Ошибка загрузки:', err)
    }
  }

  // Совместимость: некоторые места могут слушать это событие
  const notifyChanged = () => {
    if (import.meta.client) window.dispatchEvent(new CustomEvent('favorites-updated'))
  }

  // ─── API ──────────────────────────────────────────────────

  // Реактивен: читает favoriteIdSet (computed), поэтому все computed,
  // которые его вызывают, пересчитываются автоматически
  const isFavorite = (productId) => {
    const id = normalizeId(productId)
    return id !== null && favoriteIdSet.value.has(id)
  }

  const addToFavorites = (product) => {
    if (!import.meta.client || !product || typeof product !== 'object') return false

    const snapshot = buildSnapshot(product)
    if (!snapshot.id || favoriteIdSet.value.has(snapshot.id)) return false

    items.value = [snapshot, ...items.value] // новые сверху
    notifyChanged()
    return true
  }

  const removeFromFavorites = (productId) => {
    const id = normalizeId(productId)
    if (!id || !favoriteIdSet.value.has(id)) return false

    items.value = items.value.filter((p) => p.id !== id)
    notifyChanged()
    return true
  }

  /**
   * Принимает объект товара или ID.
   * Объект → добавит или удалит. ID → только удалит.
   */
  const toggleFavorite = (productOrId) => {
    const isObject = productOrId && typeof productOrId === 'object'
    const id = normalizeId(isObject ? productOrId.id || productOrId._id : productOrId)
    if (!id) return false

    if (isFavorite(id)) return removeFromFavorites(id)
    if (!isObject) {
      console.warn('[useFavorites] для добавления нужен объект товара, получен id:', id)
      return false
    }
    return addToFavorites(productOrId)
  }

  const clearAllFavorites = () => {
    if (!items.value.length) return
    items.value = []
    notifyChanged()
  }

  // ─── Инициализация (только клиент) ────────────────────────
  if (import.meta.client) {
    load()

    // Кросс-табовая синхронизация: изменение в другой вкладке подхватывается здесь
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY) return
      try {
        const data = e.newValue ? JSON.parse(e.newValue) : []
        items.value = Array.isArray(data) ? data : []
      } catch {
        // битые данные из другой вкладки — игнорируем
      }
    })
  }

  return {
    favoriteIds,
    favoriteProducts: computed(() => items.value),
    favoritesCount,
    isFavorite,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    clearAllFavorites,
    load,
  }
}