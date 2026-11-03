<!-- app/components/products/ProductCardGrid.vue -->
<template lang="pug">
.card.product-card.p-0.bg-base-100.relative.group.overflow-hidden.rounded-2xl.border(
  class="border-base-300 hover:border-primary/30"
  :class="{ 'has-search-highlight': hasSearchHighlight }"
)
  //- Дефицитный остаток: бейдж на фото при ≤ LOW_STOCK_THRESHOLD шт.
  //- (срочность покупки; обилие на складе бейджем не подсвечиваем)
  .stock-badge.absolute.z-10.rounded-full.shadow-sm(
    v-if="isLowStock",
    class="top-1 right-1 px-2 py-0.5 text-xs font-medium bg-warning/95 text-warning-content",
    role="status"
  ) {{ $t('product.leftShort', product.stockQuantity) }}

  //- Кнопка избранного (fav-pop — упругий «поп» при добавлении, main.css)
  button.favorite-btn(
    class="top-1 left-1 z-10 absolute flex justify-center items-center backdrop-blur rounded-full size-8 transition-colors",
    :class="[isFavorite ? 'bg-error text-white' : 'bg-base-100/40 text-base-content', { 'fav-pop': isFavorite }]",
    @click="toggleFavorite",
    :title="isFavorite ? $t('product.favRemove') : $t('product.favAdd')",
    :aria-label="isFavorite ? $t('product.favRemove') : $t('product.favAdd')"
  )
    icon(:name="isFavorite ? 'heroicons:heart-solid' : 'heroicons:heart'",
      size="20"
    )

  //- Кнопка сравнения — под сердцем (топ-1 + высота сердечка 2rem + зазор)
  button.compare-btn(
    class="top-10 left-1 z-10 absolute flex justify-center items-center backdrop-blur rounded-full size-8 transition-colors",
    :class="isComparedVisible ? 'bg-primary text-primary-content' : 'bg-base-100/40 text-base-content'",
    @click="toggleCompareClick",
    :title="$t('compare.toggleAria')",
    :aria-label="$t('compare.toggleAria')"
  )
    icon(name="heroicons:arrows-right-left", size="16")

  //- Ссылка на товар
  .card-content
    NuxtLink.block(:to="productUrl", prefetch)
      .image-container.relative.w-full.aspect-square.overflow-hidden.bg-base-200.flex.items-center.justify-center(
        :class="{ 'is-loading': isLoading }"
      )
        //- Иконка только когда картинки нет вовсе: нет URL или ошибка.
        //- Обычная загрузка — нейтральный shimmer-скелетон, без иконки поверх фото.
        .placeholder.absolute.inset-0.flex.items-center.justify-center(
          v-if="showMissingImage"
        )
          icon(name="heroicons:photo" size="32" class="text-base-300")

        //- Изображение
        //- srcset 400w+800w: карточка рисует ~180-300 CSS px (aspect-square),
        //- полный 800w втрое избыточен — браузер берёт small/ 400w
        img.product-image(
          v-if="currentImage && !imageError",
          ref="imageEl",
          :src="currentImage",
          :srcset="imageSrcset",
          :sizes="imageSrcset ? '(max-width: 639px) 50vw, 300px' : undefined",
          :alt="product.name",
          :loading="loadingAttr",
          :fetchpriority="fetchPriority",
          decoding="async",
          @load="onImageLoad",
          @error="onImageError"
        )

      .card-body.relative.p-3.gap-y-1
        //- Название товара
        h2.card-title.min-h-9.text-sm.font-semibold.text-base-content.line-clamp-2.leading-snug(
          class="lg:min-h-10 lg:text-base"
        )
          span(v-html="highlightedName")

        //- Описание товара
        p.line-clamp-2.leading-snug.text-xs(
          class="lg:text-sm text-base-content/75"
        )
          span(v-html="highlightedDescription")

        //- Рейтинг: ★ средняя · N отзывов (только с одобренными отзывами;
        //- данные приходят с /api/products вместе с товаром — без pop-in)
        .rating-row.flex.items-center.gap-1.text-xs.min-h-4(
          v-if="(product.rating?.count ?? 0) > 0"
        )
          span.text-warning(aria-hidden="true") ★
          span.font-medium {{ ratingAverage }}
          span(class="text-base-content/50") · {{ ratingCountLabel }}

    //- Цена и статус
    .card-actions.flex.items-center.justify-between.px-3.pb-3.pt-1
      .font-semibold.text-base-content(
        v-if="product.inStock",
        class="text-base lg:text-lg"
      ) {{ formatPrice(product.price) }} ₽
      .text-error.text-xs(v-else) {{ $t('product.outOfStock') }}
</template>

<script setup>
const props = defineProps({
  product: {
    type: Object,
    required: true
  },
  searchQuery: {
    type: String,
    default: ''
  },
  index: {
    type: Number,
    default: 0
  }
})

//- ============================================
//- Оптимизация: минимальное использование composables
//- ============================================
const app = useAppState()

//- ============================================
//- Вычисляемые свойства - мемоизированные
//- ============================================
// ✅ ИСПРАВЛЕНО: использованы обратные кавычки для шаблонной строки
// Ссылка карточки сохраняет префикс локали (/en/product/…)
const localePath = useLocalePath()
const productUrl = computed(() => localePath(`/product/${props.product.slug}`))

//- Дефицитный остаток: 1..5 шт. (0/undefined — «нет в наличии», он уже
//- показывается ценовой строкой; больше 5 — бейдж не нужен)
const LOW_STOCK_THRESHOLD = 5
const isLowStock = computed(() => {
  const qty = Number(props.product?.stockQuantity)
  return (
    props.product?.inStock === true &&
    Number.isFinite(qty) &&
    qty > 0 &&
    qty <= LOW_STOCK_THRESHOLD
  )
})

//- Средняя оценка в локали пользователя (4,5 в ru/es, 4.5 в en);
//- ProductReviews на карточке товара использует тот же приём
const { t, locale } = useI18n()
const numberFormat = computed(() =>
  new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 })
)
const ratingAverage = computed(() =>
  numberFormat.value.format(props.product?.rating?.average ?? 0)
)
const ratingCountLabel = computed(() =>
  t('reviews.count', props.product?.rating?.count ?? 0)
)

//- Гидратация: избранное живёт в localStorage, сервер его не знает и
//- рендерит все сердечки «пустыми». Первый кадр обязан совпасть с SSR —
//- реальное состояние показываем после монтирования (у пользователей
//- с избранным сердечко дожмётся сразу после гидратации, без
//- hydration mismatch-варнингов)
const isHydrated = ref(false)
onMounted(() => {
  isHydrated.value = true
})

const isFavorite = computed(() => isHydrated.value && app.isFavorite(props.product.id))

//- Сравнение: гейт тот же, что у избранного — до гидратации «не в сравнении»
const { $notify } = useNuxtApp()
const { isCompared, toggleCompare } = useCompare()
const isComparedVisible = computed(() => isHydrated.value && isCompared(props.product.id))

const toggleCompareClick = (event) => {
  const status = toggleCompare(props.product)
  if (status === 'added') {
    $notify.success(t('compare.added'))
    // «Синяя точка» летит к бургеру/«Сравнению» в шапке (utils/compareFly.js)
    emitCompareFly(event?.currentTarget)
  }
  if (status === 'full') $notify.warning(t('compare.limit', { n: 4 }))
}

//- Оптимизация загрузки изображений - lazy для всех кроме первых 4
const loadingAttr = computed(() => props.index < 4 ? 'eager' : 'lazy')
const fetchPriority = computed(() => props.index < 4 ? 'high' : 'low')

//- ============================================
//- Изображения - упрощённая логика
//- ============================================
const imageLoaded = ref(false)
const imageError = ref(false)
const imageEl = ref(null)

// ✅ ИСПРАВЛЕНО: обратные кавычки везде, где формируется URL
const currentImage = computed(() => {
  const url = props.product?.image
  if (!url || url === 'null' || url === 'undefined') return null

  // Base64
  if (url.startsWith('data:')) return url

  // Unsplash без домена — сразу с auto=format/q=75 (utils/productImage):
  // без auto=format Unsplash отдаёт JPEG вместо WebP/AVIF
  if (url.startsWith('photo-')) return withImageFormat(`https://images.unsplash.com/${url}`)

  // Полный URL (unsplash-ссылки получают auto=format, остальные не меняются)
  if (url.startsWith('http')) return withImageFormat(url)
  if (url.startsWith('/')) return url

  return `/images/${url}`
})

//- Иконка показывается только когда картинки нет вовсе (нет URL или ошибка);
//- во время обычной загрузки вместо неё — shimmer-скелетон на контейнере
const showMissingImage = computed(() => !currentImage.value || imageError.value)
const isLoading = computed(() => !!currentImage.value && !imageError.value && !imageLoaded.value)

//- Гонка гидратации: картинка из кэша успевает загрузиться до того,
//- как Vue навесит обработчик @load — событие уже не придёт и состояние
//- навсегда останется «загружается». Снимаем вручную по img.complete.
onMounted(() => {
  const el = imageEl.value
  if (!el || !el.complete) return
  if (el.naturalWidth > 0) {
    imageLoaded.value = true
  } else {
    imageError.value = true
  }
})

const onImageLoad = () => {
  imageLoaded.value = true
}

//- srcset только для локальных фото каталога (data-URI, /api/images/*,
//- внешние URL — без второй версии, атрибут не выводится)
const imageSrcset = computed(() => productSrcset(currentImage.value))

const onImageError = () => {
  imageError.value = true
}

//- ============================================
//- Подсветка поиска - оптимизированная
//- ============================================
const queryValid = computed(() => props.searchQuery?.trim().length >= 2)

const highlightedName = computed(() => {
  if (!queryValid.value || !props.product?.name) return props.product?.name || ''
  return highlightText(props.product.name, props.searchQuery)
})

const highlightedDescription = computed(() => {
  if (!queryValid.value || !props.product?.description) return props.product?.description || ''
  return highlightText(props.product.description, props.searchQuery)
})

const hasSearchHighlight = computed(() => {
  if (!queryValid.value) return false
  const q = props.searchQuery.toLowerCase()
  return props.product?.name?.toLowerCase().includes(q) ||
         props.product?.description?.toLowerCase().includes(q)
})

//- ============================================
//- Методы
//- ============================================
const formatPrice = (price) => {
  return new Intl.NumberFormat('ru-RU').format(price || 0)
}

const highlightText = (text, query) => {
  if (!text || !query) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return text.replace(regex, '<mark class="bg-primary/20 px-0.5 rounded text-base-content">$1</mark>')
}

const toggleFavorite = () => {
  app.toggleFavorite(props.product)
}
</script>

<style scoped>
/* CSS Containment для производительности */
.product-card {
  /* ⚠️ content-visibility: auto здесь НЕЛЬЗЯ: карточки первого экрана —
     LCP-элементы. Chrome откладывает их отрисовку до первого
     layout/intersection-прохода (PageSpeed: «element render delay»
     2 090 мс при загрузке картинки за 250 мс). DOM мал (~700 узлов),
     virtualization не нужна. contain: layout style оставлен. */
  contain: layout style;
  transition: border-color var(--transition-base, 0.25s), box-shadow var(--transition-base, 0.25s), transform var(--transition-base, 0.25s);
}

.product-card:hover {
  box-shadow: var(--shadow-md, 0 4px 10px -2px rgb(0 0 0 / 0.06));
}

/* Изображения */
.image-container {
  position: relative;
}

/* Shimmer-скелетон, пока картинка грузится; стоит ПОД изображением
   (::before — первый ребёнок, img.position:relative рисуется выше) */
.image-container.is-loading::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    100deg,
    transparent 20%,
    color-mix(in oklab, var(--color-base-content) 7%, transparent) 50%,
    transparent 80%
  );
  transform: translateX(-100%);
  animation: card-shimmer 1.4s ease-in-out infinite;
}

@keyframes card-shimmer {
  100% {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .image-container.is-loading::before {
    animation: none;
  }
}

.product-image {
  position: relative;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transition: transform 0.35s ease;
}

.group:hover .product-image {
  transform: scale(1.04);
}

/* Подсветка поиска */
:deep(mark) {
  border-radius: 2px;
  padding: 0 1px;
}

.has-search-highlight {
  border-color: color-mix(in oklab, var(--color-primary) 40%, transparent) !important;
}

/* Доступность */
button:focus-visible,
a:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--color-primary) 50%, transparent);
  outline-offset: 2px;
}
</style>