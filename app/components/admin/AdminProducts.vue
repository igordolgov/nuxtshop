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
            :categoryLabels="categoryLabels"
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
    :categoryLabelMaps="categoryLabelMaps"
    @productAdded="handleProductAdded"
  )

  AdminEditProductModal(
    v-model:isOpen="showEditModal"
    :product="currentProduct"
    :allCategories="availableCategories"
    :categoryLabelMaps="categoryLabelMaps"
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
const ensureFullProducts = appState.ensureFullProducts
const initializeApp = appState.initializeApp

const notify = useNotifyQueue()
const { t } = useI18n()

// Локаль из пути (/en/… → 'en' и т.д.) — для поиска, сортировки и
// подписи категорий. Значения фильтров и данные редактирования
// остаются сырыми — переводится только отображение.
const { locale, loc } = useLocalizedProduct()
const localeTag = computed(() =>
  locale.value === 'en' ? 'en' : locale.value === 'es' ? 'es' : 'ru',
)

const sortOptions = computed(() => [
  { field: 'createdAt', label: t('admin.products.sortByDate') },
  { field: 'name', label: t('admin.products.sortByName') },
  { field: 'price', label: t('admin.products.sortByPrice') },
  { field: 'stockQuantity', label: t('admin.products.sortByStock') },
])

const statusFilters = computed(() => [
  { value: 'all', label: t('admin.products.filterAll') },
  { value: 'inStock', label: t('admin.products.filterInStock') },
  { value: 'outOfStock', label: t('admin.products.filterOutOfStock') },
])

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

// Карта «сырая категория → подпись в текущей локали» для чипов/дропдауна
// (значения фильтров и пикер модалок остаются сырыми — переводится только
// подпись; на ru карта пустая, дропдаун фолбэкается на сырые значения)
const categoryLabels = computed(() => buildCategoryLabelMap(products.value, locale.value))

// Карты переводов категорий для модалок товара (вкладки EN/ES): подсказки
// пикера показываются в языке вкладки, а не по-русски (непереведённые
// категории остаются сырыми — тот же фолбэк, что у витрины)
const categoryLabelMaps = computed(() => ({
  en: buildCategoryLabelMap(products.value, 'en'),
  es: buildCategoryLabelMap(products.value, 'es'),
}))

const processedProducts = computed(() => {
  let result = [...products.value]

  if (currentFilter.value === 'inStock') {
    result = result.filter(p => p.inStock)
  } else if (currentFilter.value === 'outOfStock') {
    result = result.filter(p => !p.inStock)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    // Ищем и в сырых, и в локализованных полях: на /en админ может
    // набрать английское название (loc(p) для ru — тот же объект)
    result = result.filter((p) => {
      const lp = loc(p)
      return (
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.categories?.some((c) => c.toLowerCase().includes(q)) ||
        lp.name?.toLowerCase().includes(q) ||
        lp.description?.toLowerCase().includes(q) ||
        lp.categories?.some((c) => c.toLowerCase().includes(q))
      )
    })
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
      return dir * (aVal || '').localeCompare(bVal || '', localeTag.value)
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
  if (searchQuery.value) return t('admin.products.emptySearch')
  if (selectedCategories.value.length) return t('admin.products.emptyCategories')
  if (currentFilter.value !== 'all') return t('admin.products.emptyFilters')
  return t('admin.products.emptyDefault')
})

const handleRefresh = async () => {
  try {
    await loadProducts(true)
    notify.success(t('admin.products.dataRefreshed'))
  } catch (e) {
    notify.error(t('admin.common.error'))
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
  notify.success(t('admin.products.exportDone'))
}

const handleEdit = async (product) => {
  // Каталог в state может быть карточным слепком из SSR-payload: перед
  // редактированием добираем полные данные (галереи, характеристики,
  // описания) — иначе модалка запишет пустые поля поверх живого товара.
  let full = product
  if (!isFullCatalogProduct(product)) {
    const all = await ensureFullProducts()
    full = all.find((p) => String(p.id) === String(product.id)) || product
  }
  currentProduct.value = { ...full }
  showEditModal.value = true
}

const handleDelete = async (product) => {
  // В сообщениях — имя в текущей локали; удаляем всё равно по id
  const displayName = loc(product).name || product.name
  if (!confirm(t('admin.products.deleteConfirm', { name: displayName }))) return
  // useProducts.deleteProduct сам показывает ошибку с текстом от сервера
  // (в т.ч. «Требуется авторизация» при мёртвой сессии) и возвращает boolean
  const ok = await deleteProduct(product.id)
  if (ok) {
    notify.success(t('admin.products.deleted', { name: displayName }))
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
  if (!confirm(t('admin.products.bulkDeleteConfirm', { n: count }))) return
  try {
    // useProducts сам показывает тост с ошибкой сервера при неудаче
    await bulkDeleteProducts(selectedIds.value)
    notify.success(t('admin.products.bulkDeleted', { n: count }))
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
  notify.success(t('admin.products.addedToast', { name: product.name }))
}

const handleProductUpdated = (product) => {
  // Список уже перезагружен модалкой
  showEditModal.value = false
  currentProduct.value = null
  notify.success(t('admin.products.updatedToast', { name: product.name }))
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