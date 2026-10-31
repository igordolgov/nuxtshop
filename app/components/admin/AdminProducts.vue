<!-- app/components/admin/AdminProducts.vue -->
<template lang="pug">
.admin-page.h-screen.bg-base-100.flex.flex-col.overflow-hidden
  Header

  AdminProductsHeader(
    :stats="stats"
    @add="showAddModal = true"
    @refresh="handleRefresh"
    @export="handleExport"
  )
    template(#filters)
      AdminProductsFilters(
        v-model:searchQuery="searchQuery"
        v-model:currentFilter="currentFilter"
        :statusFilters="statusFilters"
      )
        template(#dropdowns)
          AdminProductsDropdowns(
            :categories="availableCategories"
            :selectedCategories="selectedCategories"
            :sortOptions="sortOptions"
            :sortField="sortField"
            :sortDirection="sortDirection"
            @toggle="toggleCategory"
            @selectAll="selectAllCategories"
            @clear="clearCategories"
            @sort="handleSort"
          )

  //- Основное содержимое - заполняет оставшееся пространство
  .content-area.flex-1.overflow-hidden.flex.flex-col(class="pb-16 sm:pb-0")
    AdminProductsTable(
      :products="processedProducts"
      :loading="isLoading"
      :searchQuery="searchQuery"
      :emptyMessage="emptyMessage"
      :stats="stats"
      :selectedIds="selectedIds"
      @edit="handleEdit"
      @delete="handleDelete"
      @refresh="handleRefresh"
      @toggleSelect="toggleSelect"
      @toggleSelectAll="toggleSelectAll"
    )

  //- Мобильный футер (только на мобильных)
  .block(class="sm:hidden")
    MobileNavFooter

  //- Групповые операции над выбранными товарами
  AdminBulkActionBar(
    :count="selectedIds.length"
    @edit="showBulkModal = true"
    @remove="handleBulkDelete"
    @clear="clearSelection"
  )

  AdminBulkEditModal(
    v-model:isOpen="showBulkModal"
    :products="selectedProducts"
    :allCategories="availableCategories"
    @applied="handleBulkApplied"
  )

  AdminAddProductModal(
    v-model:isOpen="showAddModal"
    :allCategories="availableCategories"
    @productAdded="handleProductAdded"
  )

  AdminEditProductModal(
    v-model:isOpen="showEditModal"
    :product="currentProduct"
    :allCategories="availableCategories"
    @productUpdated="handleProductUpdated"
  )

  ClientOnly
    ScrollToTop
</template>

<script setup>
// ============================================
// Компонент: AdminProducts
// Страница управления товарами.
// Удаление: один confirm здесь; результат запроса уважается —
// success-тост только при реальном удалении (useProducts сам
// показывает ошибку с текстом от сервера).
// Выделение: массив id выбранных товаров живёт здесь; таблица
// только сообщает toggle/toggleAll. «Выбрать все» действует на
// показанные (отфильтрованные) товары; выделение переживает смену
// фильтров и очищается после массовых операций.
// Перезагрузка списка после добавления/редактирования выполняет
// модалка — здесь дублируемый loadProducts убран.
// ============================================
import Header from '~/components/layout/Header.vue'
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'
import ScrollToTop from '~/components/ScrollToTop.vue'

const appState = useAppState()
const products = appState.products
const isLoading = appState.loading
const loadProducts = appState.loadProducts
const deleteProduct = appState.deleteProduct
const bulkDeleteProducts = appState.bulkDeleteProducts
const initializeApp = appState.initializeApp

const notify = useNotifyQueue()

const sortOptions = [
  { field: 'createdAt', label: 'По дате' },
  { field: 'name', label: 'По названию' },
  { field: 'price', label: 'По цене' },
  { field: 'stockQuantity', label: 'По количеству' }
]

const statusFilters = [
  { value: 'all', label: 'Все товары' },
  { value: 'inStock', label: 'В наличии' },
  { value: 'outOfStock', label: 'Нет в наличии' }
]

const showAddModal = ref(false)
const showEditModal = ref(false)
const showBulkModal = ref(false)
const currentProduct = ref(null)
const searchQuery = ref('')
const currentFilter = ref('all')
const selectedCategories = ref([])
const selectedIds = ref([])
const sortField = ref('createdAt')
const sortDirection = ref('desc')

onMounted(() => {
  initializeApp()
})

const availableCategories = computed(() => {
  const cats = new Set()
  products.value.forEach(p => {
    if (p.categories) {
      p.categories.forEach(c => cats.add(c))
    }
  })
  return Array.from(cats).sort()
})

const processedProducts = computed(() => {
  let result = [...products.value]

  if (currentFilter.value === 'inStock') {
    result = result.filter(p => p.inStock)
  } else if (currentFilter.value === 'outOfStock') {
    result = result.filter(p => !p.inStock)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.categories?.some(c => c.toLowerCase().includes(q))
    )
  }

  if (selectedCategories.value.length > 0) {
    result = result.filter(p =>
      p.categories?.some(c => selectedCategories.value.includes(c))
    )
  }

  const field = sortField.value
  const dir = sortDirection.value === 'asc' ? 1 : -1

  return result.sort((a, b) => {
    let aVal = a[field]
    let bVal = b[field]

    if (field === 'name') {
      return dir * (aVal || '').localeCompare(bVal || '', 'ru')
    }
    if (field === 'createdAt') {
      // В сиде и старых записях createdAt отсутствует (есть только
      // updatedAt) — без фолбэка все даты 0 и сортировка не работает
      // ни в одну сторону
      aVal = new Date(aVal || a.updatedAt || 0).getTime()
      bVal = new Date(bVal || b.updatedAt || 0).getTime()
    }
    // Tiebreak по числовому id: стабильный порядок при равных значениях,
    // иначе при нулевых датах направление сортировки «не видно»
    return (
      dir * ((Number(aVal) || 0) - (Number(bVal) || 0)) ||
      (Number(a.id) || 0) - (Number(b.id) || 0)
    )
  })
})

const stats = computed(() => ({
  total: products.value.length,
  shown: processedProducts.value.length,
  inStock: products.value.filter(p => p.inStock).length,
  outOfStock: products.value.filter(p => !p.inStock).length
}))

const emptyMessage = computed(() => {
  if (searchQuery.value) return 'Попробуйте изменить поиск'
  if (selectedCategories.value.length) return 'Попробуйте сбросить фильтры категорий'
  if (currentFilter.value !== 'all') return 'Попробуйте сбросить фильтры'
  return 'Добавьте первый товар или измените фильтры'
})

const handleRefresh = async () => {
  try {
    await loadProducts(true)
    notify.success('Данные обновлены')
  } catch (e) {
    notify.error('Ошибка обновления')
  }
}

const handleExport = () => {
  const data = JSON.stringify(products.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `products-${new Date().toISOString().split('T')[0]}.json`
  link.click()
  URL.revokeObjectURL(url)
  notify.success('Экспорт завершён')
}

const handleEdit = (product) => {
  currentProduct.value = { ...product }
  showEditModal.value = true
}

const handleDelete = async (product) => {
  if (!confirm(`Удалить "${product.name}"?`)) return
  // useProducts.deleteProduct сам показывает ошибку с текстом от сервера
  // (в т.ч. «Требуется авторизация» при мёртвой сессии) и возвращает boolean
  const ok = await deleteProduct(product.id)
  if (ok) {
    notify.success(`"${product.name}" удалён`)
    // Если товар был выделен — убираем из выделения, чтобы панель
    // групповых операций не считала уже несуществующий товар
    selectedIds.value = selectedIds.value.filter((id) => id !== String(product.id))
  }
}

// ─── Выделение и групповые операции ─────────────────────

const selectedProducts = computed(() =>
  products.value.filter((p) => selectedIds.value.includes(String(p.id)))
)

const toggleSelect = (id) => {
  const sid = String(id)
  const idx = selectedIds.value.indexOf(sid)
  if (idx > -1) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(sid)
}

const toggleSelectAll = () => {
  const visible = processedProducts.value.map((p) => String(p.id))
  const allSelected =
    visible.length > 0 && visible.every((id) => selectedIds.value.includes(id))
  if (allSelected) {
    // Снимаем только с показанных: выделение вне текущего фильтра не трогаем
    const visibleSet = new Set(visible)
    selectedIds.value = selectedIds.value.filter((id) => !visibleSet.has(id))
  } else {
    selectedIds.value = [...new Set([...selectedIds.value, ...visible])]
  }
}

const clearSelection = () => {
  selectedIds.value = []
}

const handleBulkDelete = async () => {
  const count = selectedIds.value.length
  if (!confirm(`Удалить выбранные товары (${count})? Действие необратимо.`)) return
  try {
    // useProducts сам показывает тост с ошибкой сервера при неудаче
    const result = await bulkDeleteProducts(selectedIds.value)
    notify.success(result.message || `Удалено товаров: ${count}`)
    clearSelection()
  } catch {
    // Ошибка уже показана в useProducts — здесь только не падаем
  }
}

const handleBulkApplied = () => {
  // Список уже обновлён в стейте (bulkUpdateProducts мерджит ответ);
  // снимаем выделение — после массовой операции оно обычно больше не нужно
  clearSelection()
  showBulkModal.value = false
}

const handleSort = (field) => {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDirection.value = 'asc'
  }
}

const toggleCategory = (cat) => {
  const idx = selectedCategories.value.indexOf(cat)
  if (idx > -1) {
    selectedCategories.value.splice(idx, 1)
  } else {
    selectedCategories.value.push(cat)
  }
}

const selectAllCategories = () => {
  selectedCategories.value = [...availableCategories.value]
}

const clearCategories = () => {
  selectedCategories.value = []
}

const handleProductAdded = (product) => {
  // Список уже перезагружен модалкой — только закрываем и уведомляем
  showAddModal.value = false
  notify.success(`"${product.name}" добавлен`)
}

const handleProductUpdated = (product) => {
  // Список уже перезагружен модалкой
  showEditModal.value = false
  currentProduct.value = null
  notify.success(`"${product.name}" обновлён`)
}
</script>

<style scoped>
.admin-page {
  font-size: 15px;
}

.content-area {
  padding: 0.5rem;
}

@media (min-width: 640px) {
  .content-area {
    padding: 0.75rem;
  }
}
</style>