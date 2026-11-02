// app/composables/useCompare.js
// ============================================
// Composable: useCompare — сравнение товаров (№9 из аудита).
//
// Паттерн useFavorites: единственный источник правды — реактивный массив
// снапшотов + автосохранение в localStorage (ключ compareProducts).
// Лимит COMPARE_MAX=4: колонки таблицы сравнения не должны расползаться.
//
// Снапшот несёт ВСЁ нужное таблице (характеристики, цена, рейтинг) —
// страница /compare не ходит в сеть и работает даже с товарами,
// удалёнными из каталога после добавления.
//
// pushCompare — чистая функция (юнит-тесты без localStorage):
// статусы 'added' | 'removed' | 'full'.
// ============================================

import { ref, computed, watch } from 'vue'

export const COMPARE_KEY = 'compareProducts'
export const COMPARE_MAX = 4

let compareInstance = null

/** Чистая: toggle товара в списке сравнения. Битые входы не бросают. */
export const pushCompare = (list, product, max = COMPARE_MAX) => {
  if (!product || typeof product !== 'object' || product.id == null) {
    return { list: Array.isArray(list) ? [...list] : [], status: 'removed' }
  }
  const id = String(product.id)
  const current = Array.isArray(list) ? list : []
  if (current.some((p) => String(p?.id) === id)) {
    return { list: current.filter((p) => String(p?.id) !== id), status: 'removed' }
  }
  if (current.length >= max) {
    return { list: current, status: 'full' }
  }
  return { list: [product, ...current], status: 'added' }
}

export const useCompare = () => {
  if (import.meta.server) return createCompare()
  if (!compareInstance) compareInstance = createCompare()
  return compareInstance
}

function createCompare() {
  const items = ref([])

  const compareIds = computed(() => items.value.map((p) => String(p.id)))
  const compareCount = computed(() => items.value.length)
  const isCompared = (productId) => compareIds.value.includes(String(productId))

  // ─── Персистентность (как в useFavorites) ─────────────────
  const save = () => {
    if (!import.meta.client) return
    try {
      localStorage.setItem(COMPARE_KEY, JSON.stringify(items.value))
    } catch {
      // переполнение квоты / приватный режим — сравнение не критично
    }
  }

  if (import.meta.client) {
    watch(items, save, { deep: true })
  }

  /** Снимок товара для таблицы сравнения: всё, что рисует /compare. */
  const buildSnapshot = (product) => ({
    id: String(product.id),
    slug: product.slug ?? null,
    name: product.name ?? '',
    price: product.price ?? null,
    image: product.image ?? null,
    categories: Array.isArray(product.categories) ? [...product.categories] : [],
    inStock: product.inStock ?? true,
    stockQuantity: product.stockQuantity ?? null,
    rating:
      product.rating && typeof product.rating === 'object'
        ? { count: Number(product.rating.count) || 0, average: Number(product.rating.average) || 0 }
        : null,
    characteristics:
      product.characteristics && typeof product.characteristics === 'object'
        ? { ...product.characteristics }
        : {},
    addedAt: new Date().toISOString(),
  })

  const load = () => {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(COMPARE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      if (!Array.isArray(data)) return
      // Принимаем только снапшоты с id; лимит соблюдаем и при загрузке
      items.value = data
        .filter((p) => p && typeof p === 'object' && p.id != null)
        .slice(0, COMPARE_MAX)
    } catch {
      // битый JSON — начинаем с пустого списка
    }
  }

  /** Добавить/убрать товар. Возвращает 'added' | 'removed' | 'full'. */
  const toggleCompare = (product) => {
    const { list, status } = pushCompare(items.value, buildSnapshot(product))
    if (status !== 'full') items.value = list
    return status
  }

  const removeCompare = (productId) => {
    const id = String(productId)
    items.value = items.value.filter((p) => String(p.id) !== id)
  }

  const clearCompare = () => {
    items.value = []
  }

  // ─── Инициализация (только клиент) ────────────────────────
  if (import.meta.client) {
    // Первый кадр = SSR («сравнение пусто»), сохранённое — после гидратации:
    // без этого бейджи и кнопки расходятся с сервером (hydration mismatch)
    let nuxtApp = null
    try {
      nuxtApp = useNuxtApp()
    } catch {
      // вне Nuxt-контекста — грузим синхронно
    }
    if (nuxtApp?.isHydrating) {
      nuxtApp.hooks.hookOnce('app:suspense:resolve', () => load())
    } else {
      load()
    }

    // Кросс-табовая синхронизация
    window.addEventListener('storage', (e) => {
      if (e.key !== COMPARE_KEY) return
      try {
        const data = e.newValue ? JSON.parse(e.newValue) : []
        items.value = Array.isArray(data) ? data.slice(0, COMPARE_MAX) : []
      } catch {
        // битые данные из другой вкладки — игнорируем
      }
    })
  }

  return {
    compareProducts: computed(() => items.value),
    compareIds,
    compareCount,
    isCompared,
    toggleCompare,
    removeCompare,
    clearCompare,
    load,
  }
}
