<!-- app/components/products/ProductCardGrid.vue -->
<template lang="pug">
.card.product-card.p-0.bg-base-100.relative.group.overflow-hidden.rounded-2xl.border(
  class="border-base-300 hover:border-primary/30"
  :class="{ 'has-search-highlight': hasSearchHighlight }"
)
  //- Дефицитный остаток: бейдж на фото при ≤ LOW_STOCK_THRESHOLD шт.
  //- (срочность покупки; обилие на складе бейджем не подсвечиваем).
  //- Фон — фиксированный насыщенный тёмно-жёлтый (yellow-700) + белый
  //- текст на ОБЕИХ темах: семантика bg-warning «плавает» от темы к теме.
  //- yellow-700 (не 600): белый текст требует контраста 4.5:1 (AA),
  //- у yellow-600 он 2.98 — замечание Lighthouse accessibility.
  .stock-badge.absolute.z-10.rounded-full.shadow-sm(
    v-if="isLowStock",
    class="top-1 right-1 px-2 py-0.5 text-xs font-semibold bg-yellow-700 text-white",
    role="status"
  ) {{ $t('product.leftShort', product.stockQuantity) }}

  //- Кнопка избранного (fav-pop — упругий «поп» при добавлении, main.css).
  //- 40px (size-10) — тач-минимум, раньше 32px (аудит F7).
  //- bg-heart (токен main.css): глубокий красный на обеих темах
  //- Иконка инлайн-SVG (было <Icon>: 30 инстансов компонента на главной
  //- гидратации дороже статовой разметки; @nuxt/icon в SVG-режиме
  //- вставляет тот же heroicons 24×24): solid/outline — два path одного
  //- силуэта сердца из @iconify-json/heroicons, переключение v-if.
  button.favorite-btn(
    class="top-1 left-1 z-10 absolute flex justify-center items-center backdrop-blur rounded-full size-10 transition-colors",
    :class="[isFavorite ? 'bg-heart text-white' : 'bg-base-100/40 text-base-content', { 'fav-pop': isFavorite }]",
    @click="toggleFavorite",
    :title="isFavorite ? $t('product.favRemove') : $t('product.favAdd')",
    :aria-label="isFavorite ? $t('product.favRemove') : $t('product.favAdd')"
  )
    svg(viewBox="0 0 24 24" width="22" height="22" aria-hidden="true")
      path(v-if="isFavorite" fill="currentColor" d="m11.645 20.91l-.007-.003l-.022-.012l-.082-.045q-.108-.06-.301-.173a25.2 25.2 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25C2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052A5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25c0 3.925-2.438 7.111-4.739 9.256a25 25 0 0 1-4.244 3.17a15 15 0 0 1-.383.219l-.022.012l-.007.004l-.003.001a.75.75 0 0 1-.704 0z")
      path(v-else fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 8.25c0-2.485-2.099-4.5-4.687-4.5c-1.936 0-3.598 1.126-4.313 2.733c-.715-1.607-2.377-2.733-4.312-2.733C5.098 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12")

  //- Кнопка сравнения — под сердцем (топ-1 + высота сердечка 2.5rem + зазор)
  button.compare-btn(
    class="top-12 left-1 z-10 absolute flex justify-center items-center backdrop-blur rounded-full size-10 transition-colors",
    :class="isComparedVisible ? 'bg-primary text-primary-content' : 'bg-base-100/40 text-base-content'",
    @click="toggleCompareClick",
    :title="$t('compare.toggleAria')",
    :aria-label="$t('compare.toggleAria')"
  )
    svg(viewBox="0 0 24 24" width="18" height="18" aria-hidden="true")
      path(fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5")

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
          svg(viewBox="0 0 24 24" width="32" height="32" class="text-base-300" aria-hidden="true")
            path(fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5m10.5-11.25h.008v.008h-.008zm.375 0a.375.375 0 1 1-.75 0a.375.375 0 0 1 .75 0")

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

    //- Цена и статус (при скидке — зачёркнутая oldPrice + бейдж −%)
    .card-actions.flex.items-center.justify-between.gap-2.px-3.pb-3.pt-1
      .flex.flex-wrap.items-baseline.min-w-0(
        class="gap-x-1.5 gap-y-0",
        v-if="product.inStock"
      )
        span.font-semibold.text-base-content(
          class="text-base lg:text-lg"
        ) {{ formatMoney(product.price) }}
        span.text-xs.line-through.shrink-0(
          v-if="hasDiscount(product)",
          class="text-base-content/45"
        ) {{ formatMoney(product.oldPrice) }}
        //- Плашка скидки: умеренное скругление (не pill), насыщенный
        //- тёмно-красный фон (одинаковый на всех темах — без
        //- daisyUI-семантики), белый текст bold (не extrabold), компактные
        //- паддинги — верхний чуть меньше нижнего
        span.shrink-0(
          v-if="hasDiscount(product)",
          class="inline-flex items-center rounded-md bg-red-700 px-1.5 pt-px pb-0.5 text-sm leading-4 font-bold text-white"
        ) −{{ discountPercent(product) }}%
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
//- Формат числа кэшируется по локали: конструктор Intl.NumberFormat
//- дорогой, а форматирование в карточке вызывается на каждой гидрации
//- (было: new на каждый вызов × 30 карточек)
const numberFormatCache = new Map()
const numberFormat = computed(() => {
  const loc = locale.value
  if (!numberFormatCache.has(loc)) {
    numberFormatCache.set(loc, new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }))
  }
  return numberFormatCache.get(loc)
})
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

//- Слепок каталога из SSR-payload не содержит характеристики: перед снапшотом
//- добираем полные данные (дедуплицированный фоновый запрос), иначе в
//- сравнении будут пустые строки характеристик

const toggleCompareClick = async (event) => {
  let product = props.product
  if (!isFullCatalogProduct(product)) {
    const all = await app.ensureFullProducts?.()
    const full = all?.find((p) => String(p.id) === String(product?.id))
    if (full) product = full
  }
  const status = toggleCompare(product)
  if (status === 'added') {
    $notify.success(t('compare.added'))
    // «Синяя точка» летит к бургеру/«Сравнению» в шапке (utils/compareFly.js)
    emitCompareFly(event?.currentTarget)
  }
  if (status === 'full') $notify.warning(t('compare.limit', { n: 4 }))
}

//- Оптимизация загрузки изображений: eager для первых 4 (первый ряд,
//- виден без скролла), но fetchpriority=high — только первые 2 (мобильный
//- первый экран): картинки ниже фолда не конкурируют с LCP-картинкой.
//- Правила вынесены в utils/catalogCard.ts — чистые функции, покрыты тестами.
const loadingAttr = computed(() => catalogCardImageLoading(props.index))
const fetchPriority = computed(() => catalogCardImagePriority(props.index))

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

  // Unsplash без домена — сразу с auto=format/q=75/w=800 (utils/productImage):
  // без auto=format Unsplash отдаёт JPEG вместо WebP/AVIF, без w= — оригинал
  // в полном разрешении (3000-5000px). w=800 совпадает со старшим кандидатом
  // srcset — для браузеров без srcset это та же картина 800w.
  if (url.startsWith('photo-')) return withImageFormat(`https://images.unsplash.com/${url}`, 800)

  // Полный URL (unsplash-ссылки получают auto=format, остальные не меняются)
  if (url.startsWith('http')) return withImageFormat(url, 800)
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
// formatPrice/formatMoney — единые из useProductUtils (валюту добавляет
// formatMoney — раньше здесь была вторая реализация, риск «₽ ₽», аудит F13)
const { formatMoney, formatPrice } = useProductUtils()

const highlightText = (text, query) => {
  if (!text || !query) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
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

/* Стиль самой подсветки (mark) — глобальный, см. main.css:
   «Подсветка найденного в поиске». */

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