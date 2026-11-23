<!-- components/products/ProductsSection.vue — секция каталога:
    пагинация с infinite scroll (IntersectionObserver, root=вьюпорт),
    окно рендера (расширяется догрузками), скелетоны при первой
    загрузке И при догрузке скроллом — целым экраном призраков.
    Фаза стартует ЗАРАНЕЕ (rootMargin ≈ 1.5 экрана на телефоне —
    триггер бьёт ещё до первого скролла) и стоит до приезда
    пользователя: призраки появляются все сразу одним кадром, а не
    выпрыгивают у самого края (см. loadMore);
    4 колонки в landscape — чистым CSS (см. style).
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

  //- Первая загрузка: скелетон-сетка вместо спиннера.
  //- Скелетон — точный слепок ProductCardGrid (варианта «list» больше
  //- нет: мобильная сетка рендерит ту же ProductCardGrid)
  .initial-skeleton(v-if="isLoadingInitial")
    .products-grid(:class="gridClasses")
      ProductCardSkeleton(
        v-for="i in initialSkeletonCount"
        :key="`sk-init-${i}`"
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
          AppIcon(name="mdi:close" size="16")
          | {{ $t('cart.clear') }}

    //- Пустое состояние (role=status: СК анонсирует «ничего не найдено»
    //- после применения фильтра/поиска без перевода фокуса)
    .empty-state.py-16.text-center(
      v-if="!displayedProducts.length && !isLoading"
      role="status"
    )
      AppIcon.empty-icon(name="mdi:package-variant" size="64")
      h3.text-xl.font-medium.mb-2 {{ $t('product.notFound') }}
      p.text-base-content.opacity-60.mb-4 {{ emptyMessage }}
      //- «Возможно, вы имели в виду» (Amazon/Ozon): исправленный запрос
      //- применяется прямо из пустого состояния — не надо возвращаться в
      //- строку поиска; гарантированно ведёт на непустую выдачу
      button.btn.btn-outline.btn-secondary.btn-sm.mb-4(
        type="button"
        v-if="searchQuery && correction"
        @click="$emit('applyCorrection', correction)"
      )
        | {{ $t('catalog.didYouMean') }}
        span.font-bold.ml-1 {{ correction }}
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
      //- оба висели одновременно — дважды одно и то же).
      //- На телефоне (<768px, тот же брейкпоинт, что isMobile) без
      //- применённых фильтров счётчик бесполезен: при открытии главной
      //- он всегда «Показано 12 из 30» — окно рендера, а не результат
      //- отбора. Скрыт CSS-классом max-md:hidden, а НЕ v-if по isMobile:
      //- isMobile включается после гидратации (onNuxtReady) — v-if дал
      //- бы вспышку счётчика при каждой перезагрузке. Применили фильтры —
      //- счётчик возвращается (длина подвыборки снова информативна)
      .products-counter.text-sm.text-base-content.opacity-60.mb-0.py-1(
        v-if="!searchQuery && hasMore"
        :class="{ 'max-md:hidden': activeFiltersCount === 0 }"
      )
        | {{ $t('catalog.shownOf', { n: visibleProducts.length, total: displayedProducts.length }) }}

      .products-grid(
        :class="gridClasses"
      )
        //- card-enter + --card-i: каскадное появление ПЕРВОЙ партии
        //- карточек (main.css; transform+opacity, без JS). На догрузках
        //- скроллом каскада НЕТ: партия после подмены проявлялась до
        //- ~0.85с (opacity 0 при задержках --card-i до 336мс + 380мс
        //- анимации) — приезжающий пользователь видел прозрачные
        //- карточки («некоторые карточки не видны»). Гейт по индексу:
        //- индексы первой партии всегда < maxRendered, у догруженных —
        //- >=; при сбросе фильтра карточки перемонтируются с новыми
        //- ключами и каскад снова играет — как раньше
        //- searchQuery в карточки НЕ передаётся: сетка — страница
        //- результатов, маркетплейсы в карточках подсветку не выводят
        //- (жёлтые mark в названии/описании — шум, убрано по отзыву)
        //- ProductCardGrid напрямую (было ProductCard): обёртка была
        //- динамическим :is, который ВСЕГДА возвращал ProductCardGrid
        //- (ветка list закомментирована) — 30 лишних инстансов-посредников
        //- на гидратации главной. Кнопки избранного/сравнения Grid ведёт
        //- сам через appState, emits-проводка была мёртвой.
        ProductCardGrid.product-card(
          v-for="(product, index) in visibleProducts"
          :key="product.id"
          :product="product"
          :index="index"
          :class="{ 'card-enter': index < maxRendered }"
          :style="{ '--card-i': index % 12 }"
        )

        //- Скелетоны подгрузки следующей партии — целым экраном призраков:
        //- появляются ВСЕ ОДНИМ кадром в момент триггера, а триггер бьёт
        //- заранее (rootMargin) — стоят под контентом, пока пользователь
        //- листает к ним, и живут до приезда (удержание в loadMore);
        //- каталог из памяти расширяется синхронно, без фазы призраки
        //- мелькали один кадр
        template(v-if="isLoadingMore")
          ProductCardSkeleton(
            v-for="i in moreSkeletonCount"
            :key="`sk-more-${i}`"
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
        @click="loadMore(false)"
      )
        | {{ $t('catalog.loadMore') }}
        span.badge.badge-primary.badge-sm.ml-2 {{ remainingCount }}

  //- Ошибка загрузки
  .error-state.py-16.text-center(
    v-if="loadError"
  )
    AppIcon(name="mdi:alert-circle" size="48" class="text-error")
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
  // «Возможно, вы имели в виду»: исправленный запрос для пустой выдачи
  // (строят suggestSearchCorrection в appState; null — исправлять нечего)
  correction: { type: String, default: null },
})

// ==========================================
// Emits (используются в шаблоне через $emit)
// ==========================================
defineEmits([
  'resetFilters',
  'refreshProducts',
  'clearSearch',
  'applyCorrection',
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

//- Поколение догрузки: reset() (смена фильтра/поиска) во время фазы
//- призраков инвалидирует продолжение старого loadMore — без guard'а
//- оно после удержания расширяло окно ПОВЕРХ сброса (12 → 24 вместо
//- свежих 12). Чем дольше удержание, тем вероятнее такое попадание
const loadGeneration = ref(0)

const visibleProducts = ref([])
const startIndex = ref(0)

const loadError = ref(null)

//- Минимальная видимая фаза скелетонов при догрузке скроллом (мс):
//- shimmer успевает качнуться, призраки читаются как «загрузка».
//- На телефоне дольше: карточки крупнее, флинг быстрее — короткую
//- фазу в движении глаз не успевает зафиксировать
const SCROLL_SKELETON_MS = () => (props.isMobile ? 650 : 450)

//- Потолок удержания скелетонов, если пользователь ещё не доехал
//- до границы партии (мс от старта фазы). Триггер бьёт заранее
//- (rootMargin ≈ 1.5 экрана) и призраки стоят под контентом, пока
//- пользователь листает к ним: 8000 покрывает докрут ~1500px даже
//- при ~200px/s. Каталог в памяти — потолок лишь гарантирует, что
//- контент не задержится навсегда
const SKELETON_HOLD_MAX_MS = () => (props.isMobile ? 8000 : 5000)

//- «Существенная видимость» призрачного блока: подменяем карточками
//- не когда первый призрак показался (~160px — полоска на краю,
//- в движении не читается), а когда блок вошёл на ~пол-экрана.
//- Для короткого блока (мал остаток) порог сжимается до его высоты
const SWAP_SUBSTANTIAL_PX = () => (props.isMobile ? 420 : 320)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

//- Доехал ли пользователь до призраков догрузки: верхний ряд скелетонов
//- должен войти в экран на «существенную» глубину (пол-экрана на мобиле).
//- Без удержания фаза 450мс подменяла скелетоны карточками «за кадром» —
//- при листании пользователь их просто не видел (жалоба на телефоне)
const areLoadSkeletonsVisible = () => {
  const ghosts = containerRef.value?.querySelectorAll('.skeleton-card')
  if (!ghosts || !ghosts.length) return true
  const first = ghosts[0].getBoundingClientRect()
  const last = ghosts[ghosts.length - 1].getBoundingClientRect()
  const blockH = last.bottom - first.top
  const need = Math.min(SWAP_SUBSTANTIAL_PX(), Math.max(120, blockH - 140))
  return first.top < window.innerHeight - need
}

// ==========================================
// Computed
// ==========================================
const displayedProducts = computed(() => props.products)

const remainingCount = computed(() => {
  return Math.max(0, displayedProducts.value.length - visibleProducts.value.length)
})

const showLoadMoreButton = computed(() => !props.useInfiniteScroll)

// Скелетоны первой загрузки: заполняют экран с запасом — 8 призраков
// на телефоне (4 ряда по 2 колонки, ≈1.2 экрана: покрыт при любой
// высоте карточек), 10 на десктопе.
// ⚙️ НАСТРОЙКА: количество призрачных карточек
const initialSkeletonCount = computed(() => (props.isMobile ? 8 : 10))

// Скелетоны подгрузки: ЦЕЛЫЙ ЭКРАН призраков внизу сетки — как на
// маркетплейсах. 8 на телефоне (4 ряда по 2 колонки), 10 на десктопе;
// все появляются одним кадром в момент триггера, а триггер бьёт
// заранее (rootMargin) — к приезду пользователя весь экран призраков
// уже стоит (жалобы «не вижу скелетонов», «вижу, но не сразу»).
// Не больше, чем реально осталось товаров: подмена растёт сетку,
// а не сжимает её — без «зазора» перед «Вы просмотрели все»
const moreSkeletonCount = computed(() => {
  const base = props.isMobile ? 8 : 10
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

const loadMore = async (viaScroll = false) => {
  if (isLoadingMore.value || !hasMore.value) return

  isLoadingMore.value = true
  const generation = loadGeneration.value

  try {
    //- Минимальная видимая фаза скелетонов при догрузке СКРОЛЛОМ.
    //- Каталог уже в памяти и окно расширяется синхронно: без фазы
    //- призраки мелькали один кадр (~16мс) и не были видны — при
    //- листании пользователь видел пустые слоты, из которых карточки
    //- ещё ~0.4с проявлялись каскадом card-enter (opacity 0 → 1,
    //- main.css). Далее — удержание до приезда пользователя, чтобы
    //- призраки не подменялись «за кадром»
    if (viaScroll) {
      const phaseStart = Date.now()
      await sleep(SCROLL_SKELETON_MS())

      //- Удержание до приезда пользователя. Призраки стоят под контентом
      //- с момента триггера, а триггер бьёт заранее (rootMargin):
      //- держим, пока блок не войдёт в экран на «существенную» глубину
      //- (см. areLoadSkeletonsVisible), но не дольше
      //- SKELETON_HOLD_MAX_MS: данные в памяти, контент не заложник
      while (
        Date.now() - phaseStart < SKELETON_HOLD_MAX_MS() &&
        !areLoadSkeletonsVisible()
      ) {
        await sleep(80)
      }

      //- Во время фазы сбросили окно (фильтр/поиск → reset) —
      //- продолжение устарело: расширять окно поверх сброса нельзя
      if (generation !== loadGeneration.value) return
    }

    // Расширяем окно рендера на одну «страницу» и проверяем,
    // покрыли ли мы весь список (в терминах той же windowSize,
    // что использует updateVisibleProducts). Искусственной задержки
    // БОЛЬШЕ НЕТ: фаза скелетонов выше — единственная пауза
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
    //- Сброс только своего поколения: reset() во время нашей фазы уже
    //- снял флаг и, возможно, запустил новую догрузку — чужую не роняем
    if (generation === loadGeneration.value) {
      isLoadingMore.value = false

      //- Перевзвод observer'а. IO рапортует только о ПЕРЕСЕЧЕНИЯХ
      //- границы, а большой rootMargin делает вход сантинела в зону
      //- ещё ВО ВРЕМЯ фазы (колбэк съедается guard'ом isLoadingMore);
      //- после подмены сантинел нередко остаётся внутри зоны — нового
      //- пересечения не будет, и следующая партия не триггерится
      //- никогда (затык на «Показано 24 из 31»). observe() всегда
      //- даёт начальный колбэк с ТЕКУЩИМ состоянием: если пользователь
      //- близко, следующий хвост призраков встаёт сразу же
      setupObserver()
    }
  }
}

const setupObserver = () => {
  if (!import.meta.client || !sentinelRef.value) return

  if (observer.value) {
    observer.value.disconnect()
  }

  // root — НАСТОЯЩИЙ скролл-контейнер (.products-container на странице,
  // index.vue), НЕ вьюпорт и НЕ .products-wrapper:
  // · root=вьюпорт: прямоугольник цели СРЕЗАЕТСЯ клипом промежуточного
  //   скролл-контейнера (спецификация IntersectionObserver) — сантинел,
  //   прокрученный за видимый бокс контейнера, для observer'а «не
  //   существует», и rootMargin не может вытащить его из-под клипа:
  //   prefetch-зона (300/500/1500px) молча не работала, триггер бил
  //   только когда сантинел уже въезжал в экран (жалоба «вижу,
  //   но не сразу»);
  // · root=.products-wrapper: не скролл-контейнер — пересечение
  //   сантинела с ним не меняется при скролле НИКОГДА (оба — потомки
  //   одного потока, едут вместе), observer срабатывал один раз.
  // Контейнер — честный root: его видимый бокс + rootMargin дают
  // настоящую prefetch-зону. Нет контейнера (другая страница) —
  // fallback на вьюпорт
  const scrollRoot = sentinelRef.value.closest('.products-container')

  observer.value = new IntersectionObserver(
    async ([entry]) => {
      if (entry.isIntersecting && !isLoadingMore.value && hasMore.value) {
        await loadMore(true)
      }
    },
    {
      root: scrollRoot ?? null,
      // Старт ДОГОНЯЕТ скролл: триггер бьёт, пока пользователь далеко
      // от края партии (на телефоне ~1.5 экрана — при окне 12 карточек
      // срабатывает ещё до первого скролла), поэтому призраки появляются
      // все сразу и заранее стоят под контентом — пользователь въезжает
      // в готовые серые ряды, а не догоняет их у самого края
      // (жалобы «не вижу скелетонов», «вижу, но не сразу»)
      rootMargin: props.isMobile ? '1500px' : '700px',
      threshold: 0,
    },
  )

  observer.value.observe(sentinelRef.value)
}

const reset = async () => {
  loadGeneration.value += 1
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

//- Окно и партия зависят от устройства, а isMobile определяется
//- ПОСЛЕ гидратации (useMobileDetection: первый кадр обязан совпасть
//- с SSR isMobile=false; реальная ширина применяется в onNuxtReady).
//- Без этого вотчера на телефоне props.maxRendered менялся 30→12,
//- а windowSize оставался «десктопным» — вся мобильная каденция
//- призраков (окно 12, партия 12) молча не работала
watch(
  () => props.maxRendered,
  async (next, prev) => {
    if (next === prev) return
    await reset()
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
  /* Без translateZ(0): принудительный композитинг делал из сетки
     ОДИН слой высотой во весь список (~5500px × 390px × DPR2 ≈ 8.5Мп
     на телефоне). При флинге Chrome не успевал растеризовать тайлы
     такого слоя на лету — при быстром листании в обе стороны виднелись
     пустые тайлы вместо карточек и призраков (checkerboarding).
     Без промоушена сетка растеризуется в общий поток скролла — тайлы
     кешируются штатно, промоушен тут ничего не давал. contain: layout
     остаётся. */
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