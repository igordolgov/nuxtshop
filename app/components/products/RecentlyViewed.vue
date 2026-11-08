<!-- app/components/products/RecentlyViewed.vue — блок «Недавно смотрели».
     История — localStorage клиента (useRecentlyViewed), персональные
     данные: SSR не рендерит ничего, блок появляется после гидратации
     и сам скрывается без истории (главная/карточка не ломаются).
     Товары разименуются из общего каталога appState; если каталог ещё
     не загружен (прямой заход на карточку) — догружается на клиенте.
     Вид — маркетплейс-паттерн «Вы недавно смотрели» (отзыв: «карточки
     очень большие»): ГОРИЗОНТАЛЬНАЯ ЛЕНТА компактных плиток (фото-квадрат,
     название в 2 строки, цена) со снапом и скрытым скроллбаром; вся
     плитка — ссылка на товар, без кнопок на карточке. -->
<template lang="pug">
section.recently-viewed(
  v-if="isMounted && items.length"
  aria-labelledby="recently-viewed-title"
)
  .container.mx-auto.px-2(class="lg:px-4")
    .flex.items-center.justify-between.mb-2(class="lg:mb-3")
      h2#recently-viewed-title.text-xl.font-semibold.text-base-content(class="lg:text-2xl") {{ $t('product.recentlyViewed') }}
      button.clear-link.btn.btn-ghost.btn-xs.rounded-lg(
        class="text-base-content/75"
        type="button"
        @click="clearHistory"
      ) {{ $t('product.clear') }}

    //- Лента: на мобиле выходит за паддинг контейнера (px-2) — плитки
    //- скроллятся от края до края экрана; на lg — в пределах контейнера.
    //- tabindex=0: скроллируемая область фокусируется с клавиатуры
    //- (WCAG 2.1 / стрелки и пробел скроллят сфокусированную ленту)
    .recent-strip.flex.gap-2.overflow-x-auto.pb-1(
      class="lg:gap-3 -mx-2 px-2 lg:mx-0 lg:px-0 snap-x"
      tabindex="0"
    )
      //- Плитка: ширина фиксированная (shrink-0) — сжимаются ТОЛЬКО краем
      //- ленты, а не сеткой; скроллбар скрыт CSS-ом ниже
      NuxtLink.recent-card.group.flex.flex-col.overflow-hidden.rounded-xl(
        v-for="item in items"
        :key="item.id"
        :to="getProductUrl(item)"
        prefetch
        class="shrink-0 snap-start w-28 sm:w-32 lg:w-36 bg-base-100 border border-base-200 shadow-sm hover:shadow-md transition-all duration-300"
      )
        figure.aspect-square.bg-base-200.overflow-hidden.shrink-0
          NuxtImg.w-full.h-full.object-cover.transition-transform.duration-300(
            class="group-hover:scale-105"
            :src="getValidImageUrl(item.image)"
            :srcset="productSrcset(getValidImageUrl(item.image))"
            :sizes="productSrcset(getValidImageUrl(item.image)) ? '(max-width: 639px) 35vw, 150px' : undefined"
            :alt="item.name"
            @error="handleImageError"
            draggable="false"
            loading="lazy"
            :width="400"
            :height="300"
          )

        .p-2.flex.flex-col.gap-1.flex-1
          h3.leading-snug.font-medium.text-base-content.line-clamp-2(
            class="text-[11px] lg:text-xs"
          ) {{ item.name }}
          //- Цена — своя строка (в узкой плитке не переносится);
          //- «в наличии» не дублируем (норма для плейсмаркета), метка
          //- «нет в наличии» появляется только под ценой у out-of-stock
          .mt-auto.flex.flex-col(class="gap-0.5")
            span.text-sm.font-bold.text-primary {{ formatPrice(item.price) }}
            span.text-error.leading-tight(
              v-if="!item.inStock"
              class="text-[10px]"
            ) {{ $t('product.outOfStock') }}
</template>

<script setup>
const props = defineProps({
  /** ID товара, который не показывать (страница этого товара) */
  excludeId: { type: [String, Number], default: null },
})

const MAX_VISIBLE = 8

const appState = useAppState()
const { products } = appState
const { loc } = useLocalizedProduct()
const { getProductUrl, slugify } = useCart()
const { readSlugs, clearRecentlyViewed } = useRecentlyViewed()

const isMounted = ref(false)
const historySlugs = ref([])

const refreshHistory = () => {
  historySlugs.value = readSlugs()
}

onMounted(() => {
  isMounted.value = true
  refreshHistory()
  // Каталог пуст (прямой заход на карточку, обновление страницы) —
  // догружаем, иначе историю нечем разименовать в товары
  if (!products.value?.length) {
    appState.loadProducts?.().catch(() => {})
  }
  // История меняется в другой вкладке — обновляемся
  window.addEventListener('storage', onStorage)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  window.removeEventListener('storage', onStorage)
  document.removeEventListener('visibilitychange', onVisibility)
})

const onStorage = (e) => {
  if (!e || e.key === RECENTLY_VIEWED_KEY) refreshHistory()
}

const onVisibility = () => {
  if (document.visibilityState === 'visible') refreshHistory()
}

/** Сопоставление записи истории с товаром каталога: slug, id
 *  или slugified-имя (исторические ссылки без явного slug). */
const matchesHistory = (product, slug) =>
  product.slug === slug ||
  String(product.id) === slug ||
  slugify(product.name) === slug

/** Свежие просмотры → товары каталога (новые сверху, без текущего). */
const items = computed(() => {
  const catalog = products.value ?? []
  if (!catalog.length || !historySlugs.value.length) return []

  const found = []
  for (const slug of historySlugs.value) {
    const product = catalog.find((p) => matchesHistory(p, slug))
    if (product && String(product.id) !== String(props.excludeId)) {
      found.push(product)
    }
    if (found.length >= MAX_VISIBLE) break
  }
  // Локализованные копии для отображения (имя/описание в языке страницы);
  // сопоставление истории выше — по СЫРЫМ товарам: slugify(имя) исторической
  // ссылки строился от русского названия, локализованное имя слаг не сохранит
  return found.map(loc)
})

const clearHistory = () => {
  clearRecentlyViewed()
  refreshHistory()
}

const fallbackImage = '/images/placeholder.jpg'

const getValidImageUrl = (url) => {
  if (!url) return fallbackImage
  if (url.startsWith('data:')) return url
  if (url.startsWith('/')) return url
  if (url.startsWith('http')) return url
  return fallbackImage
}

// Цена с валютой — единый formatMoney из store.config (₽ / $ по конфигу витрины)
import { formatMoney } from '../../../store.config'

const formatPrice = (price) => formatMoney(price)

const handleImageError = (event) => {
  if (event?.target) event.target.src = fallbackImage
}
</script>

<style scoped>
.recently-viewed {
  width: 100%;
  margin-top: 0.5rem;
}

/* Лента без скроллбара (маркетплейс-паттерн): прокрутка — свайпом,
  трекпадом/колесом; правый край плиток + снап подсказывают жест.
  tabindex=0 в шаблоне — область скроллится с клавиатуры. */
.recent-strip {
  scrollbar-width: none;
}

.recent-strip::-webkit-scrollbar {
  display: none;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
