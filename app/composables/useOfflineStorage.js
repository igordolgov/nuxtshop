// composables/useOfflineStorage.js
/**
 * Composable для работы с IndexedDB
 * - Хранение товаров, корзины, избранного
 * - Очередь синхронизации
 * - Кэширование API ответов
 */

import { openDB } from 'idb'

const DB_NAME = 'shop-offline-db'
const DB_VERSION = 1

// ==========================================
// Инициализация базы данных
// ==========================================

const dbPromise = () => {
  if (!process.client) return null
  
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Товары
      if (!db.objectStoreNames.contains('products')) {
        const productsStore = db.createObjectStore('products', { keyPath: 'id' })
        productsStore.createIndex('category', 'categories', { multiEntry: true })
        productsStore.createIndex('updatedAt', 'updatedAt')
      }

      // Корзина
      if (!db.objectStoreNames.contains('cart')) {
        const cartStore = db.createObjectStore('cart', { keyPath: 'id' })
        cartStore.createIndex('addedAt', 'addedAt')
      }

      // Избранное
      if (!db.objectStoreNames.contains('favorites')) {
        const favoritesStore = db.createObjectStore('favorites', { keyPath: 'id' })
        favoritesStore.createIndex('addedAt', 'addedAt')
      }

      // Очередь синхронизации
      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', {
          keyPath: 'id',
          autoIncrement: true
        })
        syncStore.createIndex('type', 'type')
        syncStore.createIndex('timestamp', 'timestamp')
      }

      // Кэш API ответов
      if (!db.objectStoreNames.contains('apiCache')) {
        const cacheStore = db.createObjectStore('apiCache', { keyPath: 'url' })
        cacheStore.createIndex('expiresAt', 'expiresAt')
      }

      // Кэш изображений (base64)
      if (!db.objectStoreNames.contains('imageCache')) {
        db.createObjectStore('imageCache', { keyPath: 'url' })
      }
    }
  })
}

// ==========================================
// Composable
// ==========================================

export const useOfflineStorage = () => {
  const getDb = async () => {
    if (!process.client) return null
    return await dbPromise()
  }

  // ==========================================
  // ТОВАРЫ
  // ==========================================

  /**
   * Сохранить товары в IndexedDB
   */
  const saveProducts = async (products) => {
    const db = await getDb()
    if (!db) return

    const tx = db.transaction('products', 'readwrite')
    const store = tx.objectStore('products')

    for (const product of products) {
      await store.put({
        ...product,
        updatedAt: Date.now()
      })
    }

    await tx.done
  }

  /**
   * Получить все товары
   */
  const getProducts = async () => {
    const db = await getDb()
    if (!db) return []
    return await db.getAll('products')
  }

  /**
   * Получить товар по ID
   */
  const getProduct = async (id) => {
    const db = await getDb()
    if (!db) return null
    return await db.get('products', id)
  }

  /**
   * Получить товары по категории
   */
  const getProductsByCategory = async (category) => {
    const db = await getDb()
    if (!db) return []
    return await db.getAllFromIndex('products', 'category', category)
  }

  /**
   * Очистить товары
   */
  const clearProducts = async () => {
    const db = await getDb()
    if (!db) return
    await db.clear('products')
  }

  /**
   * Количество товаров
   */
  const getProductsCount = async () => {
    const db = await getDb()
    if (!db) return 0
    return await db.count('products')
  }

  // ==========================================
  // КОРЗИНА
  // ==========================================

  /**
   * Сохранить товар в корзину
   */
  const saveCartItem = async (item) => {
    const db = await getDb()
    if (!db) return

    await db.put('cart', {
      ...item,
      addedAt: item.addedAt || Date.now()
    })

    // Добавляем в очередь синхронизации
    await addToSyncQueue('cart', 'add', { id: item.id, quantity: item.quantity })
  }

  /**
   * Получить корзину
   */
  const getCart = async () => {
    const db = await getDb()
    if (!db) return []
    return await db.getAll('cart')
  }

  /**
   * Обновить количество товара в корзине
   */
  const updateCartItem = async (id, quantity) => {
    const db = await getDb()
    if (!db) return

    const item = await db.get('cart', id)
    if (item) {
      item.quantity = quantity
      await db.put('cart', item)
      await addToSyncQueue('cart', 'update', { id, quantity })
    }
  }

  /**
   * Удалить товар из корзины
   */
  const removeCartItem = async (id) => {
    const db = await getDb()
    if (!db) return

    await db.delete('cart', id)
    await addToSyncQueue('cart', 'remove', { id })
  }

  /**
   * Очистить корзину
   */
  const clearCart = async () => {
    const db = await getDb()
    if (!db) return
    await db.clear('cart')
    await addToSyncQueue('cart', 'clear', {})
  }

  // ==========================================
  // ИЗБРАННОЕ
  // ==========================================

  /**
   * Добавить в избранное
   */
  const saveFavorite = async (item) => {
    const db = await getDb()
    if (!db) return

    await db.put('favorites', {
      ...item,
      addedAt: item.addedAt || Date.now()
    })

    await addToSyncQueue('favorite', 'add', { id: item.id })
  }

  /**
   * Получить избранное
   */
  const getFavorites = async () => {
    const db = await getDb()
    if (!db) return []
    return await db.getAll('favorites')
  }

  /**
   * Удалить из избранного
   */
  const removeFavorite = async (id) => {
    const db = await getDb()
    if (!db) return

    await db.delete('favorites', id)
    await addToSyncQueue('favorite', 'remove', { id })
  }

  /**
   * Проверить, есть ли в избранном
   */
  const isFavoriteStored = async (id) => {
    const db = await getDb()
    if (!db) return false
    const item = await db.get('favorites', id)
    return !!item
  }

  /**
   * Очистить избранное
   */
  const clearFavorites = async () => {
    const db = await getDb()
    if (!db) return
    await db.clear('favorites')
  }

  // ==========================================
  // ОЧЕРЕДЬ СИНХРОНИЗАЦИИ
  // ==========================================

  /**
   * Добавить действие в очередь синхронизации
   */
  const addToSyncQueue = async (type, action, data) => {
    const db = await getDb()
    if (!db) return

    await db.put('syncQueue', {
      type,        // 'cart' | 'favorite' | 'order'
      action,      // 'add' | 'remove' | 'update' | 'clear'
      data,
      timestamp: Date.now()
    })
  }

  /**
   * Получить очередь синхронизации
   */
  const getSyncQueue = async () => {
    const db = await getDb()
    if (!db) return []
    return await db.getAll('syncQueue')
  }

  /**
   * Получить элементы по типу
   */
  const getSyncQueueByType = async (type) => {
    const db = await getDb()
    if (!db) return []
    return await db.getAllFromIndex('syncQueue', 'type', type)
  }

  /**
   * Очистить очередь синхронизации
   */
  const clearSyncQueue = async () => {
    const db = await getDb()
    if (!db) return
    await db.clear('syncQueue')
  }

  /**
   * Удалить выполненный элемент из очереди
   */
  const removeSyncItem = async (id) => {
    const db = await getDb()
    if (!db) return
    await db.delete('syncQueue', id)
  }

  // ==========================================
  // API КЭШ
  // ==========================================

  /**
   * Сохранить ответ API в кэш
   */
  const cacheApiResponse = async (url, data, ttlMinutes = 60) => {
    const db = await getDb()
    if (!db) return

    await db.put('apiCache', {
      url,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + (ttlMinutes * 60 * 1000)
    })
  }

  /**
   * Получить кэшированный ответ API
   */
  const getCachedApi = async (url) => {
    const db = await getDb()
    if (!db) return null

    const cached = await db.get('apiCache', url)
    
    if (!cached) return null

    // Проверяем срок годности
    if (Date.now() > cached.expiresAt) {
      await db.delete('apiCache', url)
      return null
    }

    return cached.data
  }

  /**
   * Очистить просроченный кэш
   */
  const cleanExpiredCache = async () => {
    const db = await getDb()
    if (!db) return

    const tx = db.transaction('apiCache', 'readwrite')
    const store = tx.objectStore('apiCache')
    const index = store.index('expiresAt')
    
    const now = Date.now()
    let cursor = await index.openCursor(IDBKeyRange.upperBound(now))
    
    while (cursor) {
      await cursor.delete()
      cursor = await cursor.continue()
    }
  }

  // ==========================================
  // ОБЩИЕ МЕТОДЫ
  // ==========================================

  /**
   * Очистить всё хранилище
   */
  const clearAll = async () => {
    const db = await getDb()
    if (!db) return

    await Promise.all([
      db.clear('products'),
      db.clear('cart'),
      db.clear('favorites'),
      db.clear('syncQueue'),
      db.clear('apiCache'),
      db.clear('imageCache')
    ])
  }

  /**
   * Получить размер хранилища
   */
  const getStorageSize = async () => {
    const db = await getDb()
    if (!db) return { products: 0, cart: 0, favorites: 0, syncQueue: 0 }

    return {
      products: await db.count('products'),
      cart: await db.count('cart'),
      favorites: await db.count('favorites'),
      syncQueue: await db.count('syncQueue')
    }
  }

  // ==========================================
  // API
  // ==========================================

  return {
    // Товары
    saveProducts,
    getProducts,
    getProduct,
    getProductsByCategory,
    clearProducts,
    getProductsCount,

    // Корзина
    saveCartItem,
    getCart,
    updateCartItem,
    removeCartItem,
    clearCart,

    // Избранное
    saveFavorite,
    getFavorites,
    removeFavorite,
    isFavoriteStored,
    clearFavorites,

    // Синхронизация
    addToSyncQueue,
    getSyncQueue,
    getSyncQueueByType,
    clearSyncQueue,
    removeSyncItem,

    // Кэш API
    cacheApiResponse,
    getCachedApi,
    cleanExpiredCache,

    // Общие
    clearAll,
    getStorageSize
  }
}