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
      @edit="handleEdit"
      @delete="handleDelete"
      @refresh="handleRefresh"
    )

  //- Мобильный футер (только на мобильных)
  .block(class="sm:hidden")
    MobileNavFooter

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
const currentProduct = ref(null)
const searchQuery = ref('')
const currentFilter = ref('all')
const selectedCategories = ref([])
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
      aVal = new Date(aVal || 0).getTime()
      bVal = new Date(bVal || 0).getTime()
    }
    return dir * ((Number(aVal) || 0) - (Number(bVal) || 0))
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
  if (ok) notify.success(`"${product.name}" удалён`)
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