// app/composables/useOfflineStorage.js
/**
 * Composable для работы с IndexedDB (обёртка над idb).
 *
 * - Товары, корзина, избранное
 * - Очередь синхронизации
 * - Кэш API-ответов и изображений
 *
 * На SSR всегда возвращает null/пустые значения — IndexedDB в Node нет.
 */
import { openDB } from 'idb'

const DB_NAME = 'shop-offline-db'
const DB_VERSION = 1

let dbInstance = null

const getDbPromise = () => {
  if (!import.meta.client) return null
  if (dbInstance) return dbInstance

  dbInstance = openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('products')) {
        const productsStore = db.createObjectStore('products', { keyPath: 'id' })
        productsStore.createIndex('category', 'categories', { multiEntry: true })
        productsStore.createIndex('updatedAt', 'updatedAt')
      }

      if (!db.objectStoreNames.contains('cart')) {
        const cartStore = db.createObjectStore('cart', { keyPath: 'id' })
        cartStore.createIndex('addedAt', 'addedAt')
      }

      if (!db.objectStoreNames.contains('favorites')) {
        const favoritesStore = db.createObjectStore('favorites', { keyPath: 'id' })
        favoritesStore.createIndex('addedAt', 'addedAt')
      }

      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', {
          keyPath: 'id',
          autoIncrement: true,
        })
        syncStore.createIndex('type', 'type')
        syncStore.createIndex('timestamp', 'timestamp')
      }

      if (!db.objectStoreNames.contains('apiCache')) {
        const cacheStore = db.createObjectStore('apiCache', { keyPath: 'url' })
        cacheStore.createIndex('expiresAt', 'expiresAt')
      }

      if (!db.objectStoreNames.contains('imageCache')) {
        db.createObjectStore('imageCache', { keyPath: 'url' })
      }
    },
  })

  return dbInstance
}

export const useOfflineStorage = () => {
  const getDb = async () => {
    if (!import.meta.client) return null
    return await getDbPromise()
  }

  // ─── Товары ──────────────────────────────────────────────
  const saveProducts = async (products) => {
    const db = await getDb()
    if (!db) return

    const tx = db.transaction('products', 'readwrite')
    const store = tx.objectStore('products')
    const now = Date.now()

    await Promise.all([
      ...products.map((p) => store.put({ ...p, updatedAt: now })),
      tx.done,
    ])
  }

  const getProducts = async () => {
    const db = await getDb()
    if (!db) return []
    return await db.getAll('products')
  }

  const getProduct = async (id) => {
    const db = await getDb()
    if (!db) return null
    return await db.get('products', id)
  }

  const getProductsByCategory = async (category) => {
    const db = await getDb()
    if (!db) return []
    return await db.getAllFromIndex('products', 'category', category)
  }

  const clearProducts = async () => {
    const db = await getDb()
    if (!db) return
    await db.clear('products')
  }

  const getProductsCount = async () => {
    const db = await getDb()
    if (!db) return 0
    return await db.count('products')
  }

  // ─── Корзина ─────────────────────────────────────────────
  const saveCartItem = async (item) => {
    const db = await getDb()
    if (!db) return

    await db.put('cart', {
      ...item,
      addedAt: item.addedAt || Date.now(),
    })
    await addToSyncQueue('cart', 'add', { id: item.id, quantity: item.quantity })
  }

  const getCart = async () => {
    const db = await getDb()
    if (!db) return []
    return await db.getAll('cart')
  }

  const updateCartItem = async (id, quantity) => {
    const db = await getDb()
    if (!db) return

    const item = await db.get('cart', id)
    if (!item) return
    item.quantity = quantity
    await db.put('cart', item)
    await addToSyncQueue('cart', 'update', { id, quantity })
  }

  const removeCartItem = async (id) => {
    const db = await getDb()
    if (!db) return
    await db.delete('cart', id)
    await addToSyncQueue('cart', 'remove', { id })
  }

  const clearCart = async () => {
    const db = await getDb()
    if (!db) return
    await db.clear('cart')
    await addToSyncQueue('cart', 'clear', {})
  }

  // ─── Избранное ───────────────────────────────────────────
  const saveFavorite = async (item) => {
    const db = await getDb()
    if (!db) return

    await db.put('favorites', {
      ...item,
      addedAt: item.addedAt || Date.now(),
    })
    await addToSyncQueue('favorite', 'add', { id: item.id })
  }

  const getFavorites = async () => {
    const db = await getDb()
    if (!db) return []
    return await db.getAll('favorites')
  }

  const removeFavorite = async (id) => {
    const db = await getDb()
    if (!db) return
    await db.delete('favorites', id)
    await addToSyncQueue('favorite', 'remove', { id })
  }

  const isFavoriteStored = async (id) => {
    const db = await getDb()
    if (!db) return false
    const item = await db.get('favorites', id)
    return !!item
  }

  const clearFavorites = async () => {
    const db = await getDb()
    if (!db) return
    await db.clear('favorites')
  }

  // ─── Очередь синхронизации ──────────────────────────────
  const addToSyncQueue = async (type, action, data) => {
    const db = await getDb()
    if (!db) return

    await db.put('syncQueue', {
      type,
      action,
      data,
      timestamp: Date.now(),
    })
  }

  const getSyncQueue = async () => {
    const db = await getDb()
    if (!db) return []
    return await db.getAll('syncQueue')
  }

  const getSyncQueueByType = async (type) => {
    const db = await getDb()
    if (!db) return []
    return await db.getAllFromIndex('syncQueue', 'type', type)
  }

  const clearSyncQueue = async () => {
    const db = await getDb()
    if (!db) return
    await db.clear('syncQueue')
  }

  const removeSyncItem = async (id) => {
    const db = await getDb()
    if (!db) return
    await db.delete('syncQueue', id)
  }

  // ─── Кэш API ────────────────────────────────────────────
  const cacheApiResponse = async (url, data, ttlMinutes = 60) => {
    const db = await getDb()
    if (!db) return

    await db.put('apiCache', {
      url,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttlMinutes * 60 * 1000,
    })
  }

  const getCachedApi = async (url) => {
    const db = await getDb()
    if (!db) return null

    const cached = await db.get('apiCache', url)
    if (!cached) return null

    if (Date.now() > cached.expiresAt) {
      await db.delete('apiCache', url)
      return null
    }
    return cached.data
  }

  const cleanExpiredCache = async () => {
    const db = await getDb()
    if (!db) return

    const tx = db.transaction('apiCache', 'readwrite')
    const store = tx.objectStore('apiCache')
    const index = store.index('expiresAt')

    let cursor = await index.openCursor(IDBKeyRange.upperBound(Date.now()))
    while (cursor) {
      await cursor.delete()
      cursor = await cursor.continue()
    }
  }

  // ─── Общие методы ───────────────────────────────────────
  const clearAll = async () => {
    const db = await getDb()
    if (!db) return

    await Promise.all([
      db.clear('products'),
      db.clear('cart'),
      db.clear('favorites'),
      db.clear('syncQueue'),
      db.clear('apiCache'),
      db.clear('imageCache'),
    ])
  }

  const getStorageSize = async () => {
    const db = await getDb()
    if (!db) return { products: 0, cart: 0, favorites: 0, syncQueue: 0 }

    return {
      products: await db.count('products'),
      cart: await db.count('cart'),
      favorites: await db.count('favorites'),
      syncQueue: await db.count('syncQueue'),
    }
  }

  // ─── Публичный API ───────────────────────────────────────
  return {
    saveProducts,
    getProducts,
    getProduct,
    getProductsByCategory,
    clearProducts,
    getProductsCount,

    saveCartItem,
    getCart,
    updateCartItem,
    removeCartItem,
    clearCart,

    saveFavorite,
    getFavorites,
    removeFavorite,
    isFavoriteStored,
    clearFavorites,

    addToSyncQueue,
    getSyncQueue,
    getSyncQueueByType,
    clearSyncQueue,
    removeSyncItem,

    cacheApiResponse,
    getCachedApi,
    cleanExpiredCache,

    clearAll,
    getStorageSize,
  }
}