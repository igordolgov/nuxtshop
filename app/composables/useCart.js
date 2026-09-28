// app/composables/useCart.js
import { ref, computed } from 'vue'

const STORAGE_KEY = 'cart'

const slugify = (str) => {
  if (!str) return ''
  return str
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

let cartInstance = null

export const useCart = () => {
  // SSR: свежий инстанс на каждый запрос
  if (import.meta.server) return createCart()

  if (cartInstance) return cartInstance
  cartInstance = createCart()
  return cartInstance
}

function createCart() {
  const router = useRouter()

  const state = ref({
    items: [],
    promo: '',
    processing: false,
    error: '',
  })

  const loaded = ref(false)

  // ─── Computed ─────────────────────────────────────────────

  const cartItems = computed(() => state.value.items)
  const appliedPromo = computed(() => state.value.promo)
  const isProcessing = computed(() => state.value.processing)
  const promoError = computed(() => state.value.error)

  const subtotal = computed(() =>
    cartItems.value.reduce((sum, item) => {
      const price = item.currentPrice || item.price || 0
      return sum + price * (item.quantity || 0)
    }, 0)
  )

  const discount = computed(() => (appliedPromo.value ? subtotal.value * 0.1 : 0))

  const deliveryPrice = computed(() => (subtotal.value > 2000 ? 0 : 300))

  const total = computed(() => subtotal.value - discount.value + deliveryPrice.value)

  const totalItems = computed(() =>
    cartItems.value.reduce((sum, item) => sum + (item.quantity || 0), 0)
  )

  const discountPercent = computed(() =>
    subtotal.value > 0 ? Math.round((discount.value / subtotal.value) * 100) : 0
  )

  const hasOutOfStockItems = computed(() =>
    cartItems.value.some((item) => (item.quantity || 0) > (item.stockQuantity || 999))
  )

  // ─── Storage ──────────────────────────────────────────────

  const saveCartToStorage = () => {
    if (!import.meta.client) return
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ items: state.value.items, promo: state.value.promo })
      )
    } catch (error) {
      console.error('Error saving cart:', error)
    }
  }

  const fetchCart = () => {
    if (!import.meta.client || loaded.value) return
    loaded.value = true

    try {
      const savedCart = localStorage.getItem(STORAGE_KEY)
      if (!savedCart) return

      const parsed = JSON.parse(savedCart)
      state.value.items = Array.isArray(parsed.items) ? parsed.items : []
      state.value.promo = parsed.promo || ''
      console.log('📥 Корзина загружена:', state.value.items.length, 'товаров')
    } catch (error) {
      console.error('Error loading cart:', error)
      state.value.items = []
      state.value.promo = ''
    }
  }

  const emitUpdated = () => {
    if (import.meta.client) {
      window.dispatchEvent(new CustomEvent('cart-updated'))
    }
  }

  // ─── Методы ───────────────────────────────────────────────

  const addToCart = async (product) => {
    if (!product?.id) {
      console.error('Invalid product:', product)
      return false
    }

    const existing = state.value.items.find((item) => item.id === product.id)

    if (existing) {
      const nextQty = existing.quantity + 1
      const max = product.stockQuantity || 0
      if (nextQty > max) {
        throw new Error(`Нельзя добавить больше ${max} шт. товара "${product.name}"`)
      }
      existing.quantity = nextQty
    } else {
      if ((product.stockQuantity || 0) === 0) {
        throw new Error(`Товар "${product.name}" отсутствует на складе`)
      }

      const productSlug = product.slug || slugify(product.name)

      state.value.items.push({
        id: product.id,
        name: product.name || 'Без названия',
        description: product.description || '',
        price: product.price || 0,
        currentPrice: product.price || 0,
        originalPrice: product.originalPrice || product.price || 0,
        quantity: 1,
        image: product.image || '',
        category: product.categories?.[0] || 'Другое',
        stockQuantity: product.stockQuantity || 0,
        inStock: product.inStock ?? true,
        discount: product.discount || 0,
        slug: productSlug || null,
      })
    }

    saveCartToStorage()
    emitUpdated()
    console.log('➕ Товар добавлен, всего:', totalItems.value)
    return true
  }

  const updateItemQuantity = async (itemId, newQuantity) => {
    const item = state.value.items.find((i) => i.id === itemId)
    if (!item) return

    const max = item.stockQuantity || 999
    if (newQuantity > max) {
      throw new Error(`Нельзя добавить больше ${max} шт. товара "${item.name}"`)
    }

    item.quantity = Math.max(0, newQuantity)

    if (item.quantity === 0) {
      state.value.items = state.value.items.filter((i) => i.id !== itemId)
    }

    saveCartToStorage()
    emitUpdated()
  }

  const removeFromCart = async (itemId) => {
    state.value.items = state.value.items.filter((i) => i.id !== itemId)
    saveCartToStorage()
    emitUpdated()
  }

  const clearCart = async () => {
    state.value.items = []
    state.value.promo = ''
    saveCartToStorage()
    emitUpdated()
  }

  const applyPromoCode = async (code) => {
    if (code.toUpperCase() === 'SALE10') {
      state.value.promo = code
      state.value.error = ''
      saveCartToStorage()
      emitUpdated()
      return true
    }
    state.value.error = 'Неверный промокод'
    throw new Error('Неверный промокод')
  }

  const removePromoCode = async () => {
    state.value.promo = ''
    saveCartToStorage()
    emitUpdated()
  }

  const proceedToCheckout = async () => {
    state.value.processing = true
    try {
      await router.push('/cart/checkout')
    } finally {
      state.value.processing = false
    }
  }

  const getMaxQuantity = (productId) => {
    const item = state.value.items.find((i) => i.id === productId)
    return item?.stockQuantity || 999
  }

  const getProductUrl = (product) => {
    if (!product) return '/'
    const slug = product.slug || slugify(product.name) || product.id
    return `/product/${slug}`
  }

  // Инициализация — один раз при первом вызове на клиенте
  if (import.meta.client) fetchCart()

  return {
    cartItems,
    appliedPromo,
    isProcessing,
    promoError,

    subtotal,
    discount,
    total,
    totalItems,
    deliveryPrice,
    discountPercent,
    hasOutOfStockItems,

    addToCart,
    clearCart,
    updateItemQuantity,
    removeFromCart,
    applyPromoCode,
    removePromoCode,
    fetchCart,
    proceedToCheckout,
    getMaxQuantity,
    getProductUrl,
    slugify,
  }
}