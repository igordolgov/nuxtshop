<!-- components/products/ProductsSection.vue — секция каталога:
    пагинация с infinite scroll (IntersectionObserver, root=вьюпорт),
    окно рендера (расширяется догрузками), скелетоны при первой
    загрузке, 4 колонки в landscape — чистым CSS (см. style).
    Окно рендера растит только вниз (усечение сверху не нужно при
    текущем размере каталога: окно уже >= всех товаров) — если каталог
    вырастет до сотен позиций, вернуться к вопросу об усечении. -->
<template lang="pug">
//- Нижний отступ секции не нужен: на главной products-container уже даёт
//- «воздух» под фиксированной навигацией (padding-bottom 60px+12px на
//- мобильных). Раньше здесь был ещё pb-12 — суммарно ~137px пустоты
//- под последним рядом карточек (жалоба «много лишнего пространства»).
.products-section
  //- h1 витрины — визуально скрыт: сетку называет «Каталог» (i18n),
  //- дизайн строки-пилюли не меняет. Раньше первый заголовок в DOM —
  //- h2 названия первой карточки: структура заголовков без корня (a11y/SEO)
  h1.sr-only {{ $t('catalog.title') }}

  //- Первая загрузка: скелетон-сетка вместо спиннера
  .initial-skeleton(v-if="isLoadingInitial")
    .products-grid(:class="gridClasses")
      ProductCardSkeleton(
        v-for="i in initialSkeletonCount"
        :key="`sk-init-${i}`"
        :variant="isMobile ? 'list' : 'grid'"
      )

  template(v-else)
    //- Результаты поиска
    .search-results.mb-4(v-if="searchQuery && displayedProducts.length > 0")
      .flex.items-center.justify-between.gap-2.flex-wrap
        .text-sm.text-base-content.opacity-70
          | {{ $t('catalog.foundByQuery', { n: $t('catalog.itemsCount', displayedProducts.length) }) }}
          span.font-medium "{{ searchQuery }}"
        button.btn.btn-sm.btn-ghost.gap-1(
          type="button"
          @click="$emit('clearSearch')"
        )
          Icon(name="mdi:close" size="16")
          | {{ $t('cart.clear') }}

    //- Пустое состояние (role=status: СК анонсирует «ничего не найдено»
    //- после применения фильтра/поиска без перевода фокуса)
    .empty-state.py-16.text-center(
      v-if="!displayedProducts.length && !isLoading"
      role="status"
    )
      Icon.empty-icon(name="mdi:package-variant" size="64")
      h3.text-xl.font-medium.mb-2 {{ $t('product.notFound') }}
      p.text-base-content.opacity-60.mb-4 {{ emptyMessage }}
      button.btn.btn-primary(
        type="button"
        v-if="activeFiltersCount > 0"
        @click="$emit('resetFilters')"
      ) {{ $t('catalog.resetAll') }}

    //- Grid/List товаров с Infinite Scroll
    .products-wrapper(
      v-if="displayedProducts.length > 0"
      ref="containerRef"
    )
      //- Счётчик «Показано N из M» — только пока есть что догружать:
      //- в конце списка его заменяет «Вы просмотрели все N» (раньше
      //- оба висели одновременно — дважды одно и то же)
      .products-counter.text-sm.text-base-content.opacity-60.mb-0.py-1(
        v-if="!searchQuery && hasMore"
      )
        | {{ $t('catalog.shownOf', { n: visibleProducts.length, total: displayedProducts.length }) }}

      .products-grid(
        :class="gridClasses"
      )
        //- card-enter + --card-i: каскадное появление партии карточек
        //- (main.css; чистый CSS, transform+opacity, без JS)
        //- searchQuery в карточки НЕ передаётся: сетка — страница
        //- результатов, маркетплейсы в карточках подсветку не выводят
        //- (жёлтые mark в названии/описании — шум, убрано по отзыву)
        //- ProductCardGrid напрямую (было ProductCard): обёртка была
        //- динамическим :is, который ВСЕГДА возвращал ProductCardGrid
        //- (ветка list закомментирована) — 30 лишних инстансов-посредников
        //- на гидратации главной. Кнопки избранного/сравнения Grid ведёт
        //- сам через appState, emits-проводка была мёртвой.
        ProductCardGrid.product-card.card-enter(
          v-for="(product, index) in visibleProducts"
          :key="product.id"
          :product="product"
          :index="index"
          :style="{ '--card-i': index % 12 }"
        )

        //- Скелетоны подгрузки следующей страницы
        template(v-if="isLoadingMore")
          ProductCardSkeleton(
            v-for="i in moreSkeletonCount"
            :key="`sk-more-${i}`"
            :variant="isMobile ? 'list' : 'grid'"
          )

      .scroll-sentinel(
        ref="sentinelRef"
      )

      .end-of-list.text-center.py-2.text-sm.opacity-60(
        v-if="!hasMore && displayedProducts.length > 0"
        role="status"
      )
        | {{ $t('catalog.viewedAll', { n: displayedProducts.length }) }}

    //- Кнопка «Показать ещё» (fallback без infinite scroll)
    .load-more-section.py-6.text-center(
      v-if="showLoadMoreButton && hasMore && !isLoadingMore"
    )
      button.btn.btn-outline.btn-primary(
        type="button"
        @click="loadMore"
      )
        | {{ $t('catalog.loadMore') }}
        span.badge.badge-primary.badge-sm.ml-2 {{ remainingCount }}

  //- Ошибка загрузки
  .error-state.py-16.text-center(
    v-if="loadError"
  )
    Icon(name="mdi:alert-circle" size="48" class="text-error")
    h3.text-xl.font-medium.mb-2 {{ $t('catalog.loadError') }}
    p.text-base-content.opacity-60.mb-4 {{ loadError }}
    button.btn.btn-primary(
      type="button"
      @click="$emit('refreshProducts')"
    ) {{ $t('news.retry') }}
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

const { t } = useI18n()

// ==========================================
// Props.
// isHorizontal удалён: 4 колонки в landscape теперь чистый CSS
// (media-блок в <style>). Пропс больше никем не передаётся
// ==========================================
const props = defineProps({
  products: { type: Array, default: () => [] },
  isLoading: { type: Boolean, default: false },
  isMobile: { type: Boolean, default: false },
  searchQuery: { type: String, default: '' },
  activeFiltersCount: { type: Number, default: 0 },
  useInfiniteScroll: { type: Boolean, default: true },
  pageSize: { type: Number, default: 20 },
  // Окно рендера: сколько карточек реально держать в DOM (аудит
  // «Структура DOM»). Остальное подгружает infinite scroll
  maxRendered: { type: Number, default: 30 },
})

// ==========================================
// Emits (используются в шаблоне через $emit)
// ==========================================
defineEmits([
  'resetFilters',
  'refreshProducts',
  'clearSearch',
])

// ==========================================
// Constants
// ==========================================

// ==========================================
// State
// ==========================================
const containerRef = ref(null)
const sentinelRef = ref(null)
const observer = ref(null)

// Размер окна рендера. Стартует с maxRendered и РАСШИРЯЕТСЯ на pageSize
// каждым loadMore — единая система с updateVisibleProducts (раньше окно
// резалось startIndex+maxRendered, а loadMore считал currentPage*pageSize:
// при 31 товаре и окне 30 hasMore гас, не показав последний — баг «30 из 31»)
const windowSize = ref(props.maxRendered)
const isLoadingMore = ref(false)
const isLoadingInitial = ref(true)
const hasMore = ref(true)

const visibleProducts = ref([])
const startIndex = ref(0)

const loadError = ref(null)

// ==========================================
// Computed
// ==========================================
const displayedProducts = computed(() => props.products)

const remainingCount = computed(() => {
  return Math.max(0, displayedProducts.value.length - visibleProducts.value.length)
})

const showLoadMoreButton = computed(() => !props.useInfiniteScroll)

// Скелетоны первой загрузки: заполняют экран.
// ⚙️ НАСТРОЙКА: количество призрачных карточек
const initialSkeletonCount = computed(() => (props.isMobile ? 6 : 10))

// Скелетоны подгрузки: короткий ряд внизу сетки.
// Не больше, чем реально осталось товаров: при окне 30 из 31 показываем
// 1 призрак, а не целый ряд — исчезает «зазор» перед «Вы просмотрели все»
// и прыжок сетки после догрузки (наблюдение визуального аудита)
const moreSkeletonCount = computed(() => {
  const base = props.isMobile ? 4 : 5
  return Math.max(1, Math.min(base, remainingCount.value))
})

const gridClasses = computed(() => {
  const classes = ['grid', 'gap-2', 'sm:gap-4']

  if (props.isMobile) {
    // Portrait: 2 колонки. Landscape: 4 — чистый CSS (media-блок в style)
    classes.push('grid-cols-2')
  } else {
    classes.push('grid-cols-2', 'sm:grid-cols-4', 'lg:grid-cols-4', 'xl:grid-cols-5')
  }

  return classes
})

const emptyMessage = computed(() => {
  if (props.searchQuery) {
    return t('catalog.nothingForQuery', { query: props.searchQuery })
  }
  if (props.activeFiltersCount > 0) {
    return t('catalog.tryChangeFilters')
  }
  return t('catalog.noProducts')
})

// ==========================================
// Методы
// ==========================================

const updateVisibleProducts = () => {
  const total = displayedProducts.value.length
  const maxStart = Math.max(0, total - windowSize.value)

  if (startIndex.value > maxStart) {
    startIndex.value = maxStart
  }

  const endIndex = Math.min(startIndex.value + windowSize.value, total)
  visibleProducts.value = displayedProducts.value.slice(startIndex.value, endIndex)
}

const loadMore = async () => {
  if (isLoadingMore.value || !hasMore.value) return

  isLoadingMore.value = true

  try {
    // Расширяем окно рендера на одну «страницу» и проверяем,
    // покрыли ли мы весь список (в терминах той же windowSize,
    // что использует updateVisibleProducts). Искусственной задержки
    // НЕТ: товары уже в памяти (весь каталог загружен appState),
    // сетка расширяется синхронно — скелетоны догрузки остаются
    // только для честно асинхронных кейсов
    windowSize.value += props.pageSize

    const total = displayedProducts.value.length
    if (startIndex.value + windowSize.value >= total) {
      hasMore.value = false
    }

    updateVisibleProducts()
  } catch (error) {
    console.error('[ProductsSection] Error loading more:', error)
    loadError.value = t('catalog.loadError')
  } finally {
    isLoadingMore.value = false
  }
}

const setupObserver = () => {
  if (!import.meta.client || !sentinelRef.value) return

  if (observer.value) {
    observer.value.disconnect()
  }

  // root:null — ВЬЮПОРТ. Настоящий скролл-контейнер — .products-container
  // на странице (index.vue), и он НЕ находится между сантинелом и
  // .products-wrapper: при root=обёртке пересечение сантинела с
  // обёрткой не меняется при скролле НИКОГДА (оба — потомки одного
  // потока, едут вместе) — observer срабатывал один раз при
  // монтировании, и при каталоге >50 товаров остальное молча не
  // подгружалось. Вьюпорт-режим честен: промежуточные скролл-контейнеры
  // режут прямоугольник цели по спецификации IntersectionObserver
  observer.value = new IntersectionObserver(
    async ([entry]) => {
      if (entry.isIntersecting && !isLoadingMore.value && hasMore.value) {
        await loadMore()
      }
    },
    {
      root: null,
      rootMargin: '300px',
      threshold: 0,
    },
  )

  observer.value.observe(sentinelRef.value)
}

const reset = async () => {
  windowSize.value = props.maxRendered
  startIndex.value = 0
  hasMore.value = true
  isLoadingMore.value = false
  loadError.value = null

  // Синхронно: на SSR рендер происходит сразу после setup, до nextTick —
  // отложенное заполнение оставляло бы серверный HTML с пустой сеткой.
  // Обновление от watcher'а (immediate) попадает в первый кадр и на сервере,
  // и при гидратации → карточки в SSR HTML без рассинхрона.
  updateVisibleProducts()

  if (containerRef.value) {
    containerRef.value.scrollTop = 0
  }

  await nextTick()
  setupObserver()
}

// ==========================================
// Watchers
// ==========================================

watch(
  () => props.products,  // замена массива (фильтр/поиск/сортировка). deep не нужен:
  // смысл вотчера — новые id; инплейс-мутации (isFavorite в useProducts)
  // id не меняют, а глубокий обход 30×~20 полей вешался на каждый setup
  async (newProducts, oldProducts) => {
    const newIds = newProducts?.map((p) => p.id).join(',')
    const oldIds = oldProducts?.map((p) => p.id).join(',')

    // Синхронно до первого await: SSR рендерит сразу после setup, и всё,
    // что исполнится после await, в серверный HTML уже не попадёт
    // (иначе сервер снова отрисует скелетон вместо карточек)
    isLoadingInitial.value = false

    if (newIds !== oldIds) {
      await reset()
    }
  },
  { immediate: true },
)

watch(
  () => props.isLoading,
  (loading) => {
    isLoadingInitial.value = loading
  },
)

// ==========================================
// Lifecycle
// ==========================================

onMounted(() => {
  if (!import.meta.client) return

  updateVisibleProducts()

  setTimeout(() => {
    setupObserver()
  }, 100)
})

onUnmounted(() => {
  if (observer.value) {
    observer.value.disconnect()
  }
})

// ==========================================
// Public API
// ==========================================
defineExpose({
  reset,
  loadMore,
})
</script>

<style scoped>
.products-section {
  width: 100%;
}

.products-wrapper {
  position: relative;
  width: 100%;
  contain: layout style;
}

.products-grid {
  transform: translateZ(0);
  contain: layout;
}

.product-card {
  /* Без content-visibility: auto — обёртки карточек первого экрана
     лежат на пути LCP (render delay 2 090 мс на PageSpeed, см.
     ProductCardGrid.vue). Анимация появления — .card-enter (main.css):
     здесь её раньше не было — keyframes fadeIn не существовали. */
  contain: layout style;
}

.scroll-sentinel {
  height: 1px;
  width: 100%;
  flex-shrink: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-icon {
  opacity: 0.3;
  margin-bottom: 1rem;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>