// app/composables/useCart.js
// ============================================
// Composable: useCart — корзина (singleton на клиенте).
// Снапшоты товаров в localStorage; все суммы — computed.
// Промокод: валидируется на сервере (POST /api/promocodes/validate),
// в localStorage хранится { code, type, value }; скидка пересчитывается
// на клиенте по тем же правилам, что и на сервере (promoHelpers),
// окончательный расчёт всё равно делает сервер при заказе.
// ============================================

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

/**
 * Достаёт название категории из товара в любом из встречающихся форматов:
 *   category: 'Электроника'                    → строка
 *   category: { name: 'Электронica', slug }    → объект
 *   categories: ['Электроника']                → массив строк
 *   categories: [{ name: 'Электроника' }]      → массив объектов
 * Ничего не нашлось — 'Другое'.
 * (Раньше читался только categories?.[0], которого в товарах нет,
 *  — все позиции в корзине получали категорию «Другое»)
 */
const resolveCategory = (product) => {
  const raw = product.category ?? product.categories?.[0]
  if (!raw) return 'Другое'
  return typeof raw === 'string' ? raw : raw.name || 'Другое'
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
    // Применённый промокод: { code, type: 'percent'|'fixed', value } или ''
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
    }, 0),
  )

  // Правила расчёта зеркалят server/lib/promoHelpers.calcDiscount:
  // percent — с округлением до рубля, fixed — не больше суммы корзины.
  // Итог при заказе пересчитает сервер — расхождение не страшно,
  // но и этого хватает, чтобы UI и заказ почти всегда совпадали.
  const discount = computed(() => {
    const promo = state.value.promo
    if (!promo || !promo.code) return 0
    const base = subtotal.value
    if (base <= 0) return 0
    const raw = promo.type === 'percent' ? (base * promo.value) / 100 : promo.value
    return Math.max(0, Math.min(Math.round(raw), Math.round(base)))
  })

  // ⚙️ НАСТРОЙКА: бесплатная доставка от 2000 ₽, иначе 300 ₽
  const deliveryPrice = computed(() => (subtotal.value > 2000 ? 0 : 300))

  const total = computed(() => subtotal.value - discount.value + deliveryPrice.value)

  const totalItems = computed(() =>
    cartItems.value.reduce((sum, item) => sum + (item.quantity || 0), 0),
  )

  const discountPercent = computed(() =>
    subtotal.value > 0 ? Math.round((discount.value / subtotal.value) * 100) : 0,
  )

  const hasOutOfStockItems = computed(() =>
    cartItems.value.some((item) => (item.quantity || 0) > (item.stockQuantity || 999)),
  )

  // ─── Storage ──────────────────────────────────────────────

  const saveCartToStorage = () => {
    if (!import.meta.client) return
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ items: state.value.items, promo: state.value.promo }),
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
      // Миграция: раньше промокод хранился строкой (жёсткий SALE10);
      // теперь объект с типом скидки — старую строку сбрасываем.
      const savedPromo = parsed.promo
      state.value.promo =
        savedPromo && typeof savedPromo === 'object' && savedPromo.code ? savedPromo : ''
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
        name: product.name || tr('cart.unnamedProduct', 'Без названия'),
        description: product.description || '',
        price: product.price || 0,
        currentPrice: product.price || 0,
        originalPrice: product.originalPrice || product.price || 0,
        quantity: 1,
        image: product.image || '',
        // Категория через resolveCategory: строка / объект / массив —
        // всё покрывается (раньше только categories?.[0] → всегда «Другое»)
        category: resolveCategory(product),
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
    const trimmed = String(code || '').trim()
    if (!trimmed) throw new Error('Введите промокод')

    // Валидация на сервере: список промокодов живёт в KV (админка
    // /admin/promocodes). Клиентские суммы не участвуют в заказе.
    const resp = await $fetch('/api/promocodes/validate', {
      method: 'POST',
      body: { code: trimmed, subtotal: subtotal.value },
    }).catch((error) => {
      throw new Error(error?.data?.message || 'Не удалось проверить промокод')
    })

    if (!resp?.valid) {
      state.value.error = resp?.message || 'Неверный промокод'
      throw new Error(state.value.error)
    }

    state.value.promo = {
      code: resp.promo.code,
      type: resp.promo.type,
      value: resp.promo.value,
    }
    state.value.error = ''
    saveCartToStorage()
    emitUpdated()
    return true
  }

  /**
   * Перепроверка сохранённого промокода (срок/лимиты могли истечь
   * между сессиями). Невалидный удаляется из корзины. Ошибка сети
   * не наказывается: считаем промокод действующим, сервер перепроверит
   * при заказе.
   */
  const revalidatePromo = async () => {
    const promo = state.value.promo
    if (!promo?.code) return true
    try {
      const resp = await $fetch('/api/promocodes/validate', {
        method: 'POST',
        body: { code: promo.code, subtotal: subtotal.value },
      })
      if (resp?.valid) {
        state.value.promo = {
          code: resp.promo.code,
          type: resp.promo.type,
          value: resp.promo.value,
        }
        saveCartToStorage()
        return true
      }
      state.value.promo = ''
      saveCartToStorage()
      emitUpdated()
      return false
    } catch {
      return true
    }
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

  /**
   * Лимит склада для позиции корзины.
   * Принимает и id, и объект позиции: страница корзины вызывает
   * getMaxQuantity(item), другие места — getMaxQuantity(id).
   * (Раньше при передаче объекта сравнение i.id === объект всегда
   *  было false → возврат 999 → блок «Доступно: N шт.» не показывался)
   */
  const getMaxQuantity = (productOrId) => {
    const id = typeof productOrId === 'object' ? productOrId?.id : productOrId
    const item = state.value.items.find((i) => i.id === id)
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
    revalidatePromo,
    removePromoCode,
    fetchCart,
    proceedToCheckout,
    getMaxQuantity,
    getProductUrl,
    slugify,
  }
}