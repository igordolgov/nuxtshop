<!-- app/pages/product/[slug].vue — карточка товара: галерея, информация,
    похожие товары, фиксированная кнопка «В корзину» (мобильные). -->
<template lang="pug">
.product-page.bg-base-100.text-base-content.flex.flex-col
  Header

  //- Хлебные крошки: sticky ПОД шапкой сайта (раньше top-0 — уезжали под неё).
  //- Видны на ВСЕХ экранах: на десктопе путь категорий ещё полезнее,
  //- чем на телефоне (раньше sm:hidden прятал их от 640px — аудит F10).
  //- Категория — текстовая крошка (не ссылка): фильтры каталога живут
  //- в локальном состоянии панелей, честная ссылка на неё невозможна
  .breadcrumbs-bar.sticky.z-10.bg-base-100.border-b.border-base-200.shadow-sm
    .container.min-h-10.mx-auto.px-2
      nav(:aria-label="$t('catalog.breadcrumbs')")
        .breadcrumbs.pt-2.pb-1.text-sm.overflow-x-auto.whitespace-nowrap
          ul.flex
            li
              NuxtLink.link.link-hover(:to="$localePath('/')" prefetch) {{ $t('nav.home') }}
            li(v-if="productView?.categories?.length")
              span(class="text-base-content/55") {{ productView.categories[0] }}
            li(aria-current="page")
              span {{ productView?.name || $t('productPage.notFound') }}

  //- Основной контент.
  //- Нижний отступ — класс product-scroll-safe (см. стили): pb-14 (56px)
  //- был меньше суммы фиксированных слоёв (CTA 52px + нижняя навигация
  //- 60px + safe-area) — хвост контента уходил под кнопку (аудит F8)
  .flex-1.overflow-auto.flex.flex-col.product-scroll-safe(ref="scrollContainer" class="lg:pb-0")
    .container.mx-auto.px-2.flex-1(class="lg:px-4 lg:pb-0")
      //- Состояние загрузки
      .flex.flex-col.items-center.justify-center.min-h-96(v-if="isLoading")
        .loading.loading-spinner.loading-lg
        span.mt-4.text-center {{ $t('productPage.loading') }}

      //- Ошибка
      .flex.flex-col.items-center.justify-center.min-h-96(v-else-if="error || !product")
        .text-center
          .text-5xl.mb-4.text-error 😔
          h1.text-xl.font-bold.mb-4 {{ $t('productPage.notFound') }}
          p.mb-6.text-sm(class="text-base-content/70") {{ error || $t('productPage.notExists') }}
          .flex.flex-col.gap-3
            button.btn.btn-primary.btn-sm(type="button" @click="$router.back()") {{ $t('productPage.back') }}
            NuxtLink.btn.btn-secondary.btn-sm(:to="$localePath('/')" prefetch) {{ $t('productPage.toCatalog') }}

      //- Контент товара.
      //- В landscape двухколоночная раскладка больше не используется:
      //- вертикальный поток на всех мобильных (как в крупных магазинах),
      //- двухколоночная — только на десктопе (lg:flex-row)
      template(v-else)
        .flex.flex-col(class="lg:flex-row lg:gap-6")
          //- Галерея изображений
          .product-image.flex-1(class="lg:p-3")
            ProductGallery(
              :product="productView"
              :gallery="productGallery"
              :product-name="productView?.name"
              :jump-to-image="galleryJumpTo"
            )

          //- Информация о товаре (productView — локализованная копия:
          //  имя/описание/категории в языке страницы, остаток/цена — общие)
          .product-info.flex-1(class="sm:pt-4")
            ProductInfo(
              :product="productView"
              :rating="ratingSummary"
              :is-favorite="isFavorite"
              :is-in-cart="isInCart(product.id)"
              :selected-variant-id="selectedVariantId"
              @update:selectedVariantId="selectedVariantId = $event"
              @toggle-favorite="toggleFavorite"
              @add-to-cart="addToCartHandler"
            )

    //- Похожие товары
    SimilarProducts(
      v-if="product && similarProducts.length > 0"
      :products="similarProducts"
      :is-in-cart="(item) => isInCart(item.id)"
      :is-favorite="(item) => appState.isFavorite(item.id)"
      @toggle-favorite="toggleSimilarFavorite"
      @add-to-cart="addSimilarToCart"
    )

    //- Недавно смотрели: localStorage клиента, SSR не рендерит;
    //- текущий товар исключается, обработчики — как у похожих
    RecentlyViewed(
      v-if="product"
      :exclude-id="product.id"
      @toggle-favorite="toggleSimilarFavorite"
      @add-to-cart="addSimilarToCart"
    )

    //- Отзывы (approved — приходят с /api/product/[slug]; новые уходят
    //-  на модерацию в /admin/reviews)
    ProductReviews(
      v-if="product"
      :product-id="String(product.id)"
      :reviews="reviews"
      :summary="ratingSummary"
    )

    //- Десктопный футер (аудит F16) — внутри скроллящегося контейнера:
    //- контент карточки прокручивается сам (ref="scrollContainer")
    SiteFooter

  //- Мобильная кнопка «В корзину»: над нижней навигацией + safe-area
  //- (раньше — магические 57px)
  .fixed-bottom-cart-button(
    v-if="product && !isLoading && !error"
    class="lg:hidden"
  )
    button.btn.btn-lg.w-full.rounded-t-box(
      type="button"
      :disabled="!selectedStock.inStock || isInCart(product.id, selectedVariantId)"
      @click="addToCartHandler()"
      :class="isInCart(product.id, selectedVariantId) ? 'btn-success' : (selectedStock.inStock ? 'btn-primary' : 'btn-oos')"
    )
      .flex.items-center.justify-center.w-full
        //- SVG вместо эмодзи 🛒/✅: цветные эмодзи-глифы (сине-серая тележка,
        //- зелёная галка) сливались с фоном btn-primary/btn-success. Текущий
        //- цвет иконки = primary/success-content — контрастная пара темы
        svg.w-6.h-6.mr-2(
          v-if="!isInCart(product.id, selectedVariantId)"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        )
          path(stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z")
        svg.w-6.h-6.mr-2(
          v-else
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        )
          path(stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7")
        span
          span(v-if="isInCart(product.id, selectedVariantId)") {{ $t('product.alreadyInCart') }}
          span(v-else-if="selectedStock.inStock") {{ $t('product.addWithPrice', { price: formatPrice(variantPrice(product, selectedVariant)) + ' ₽' }) }}
          span(v-else) {{ $t('product.soldOut') }}

  //- Футер SSR-рендерится сам (CSS прячет на десктопе ≥768px):
  //- ClientOnly задерживал его до гидратации
  MobileNavFooter
</template>

<script setup>
// Ключ страницы — по slug: при переходе «похожий товар → похожий товар»
// страница пересоздаётся целиком (setup, данные, прокрутка), а не
// переиспользуется с чужими данными — фикс «URL меняется, карточка
// не открывается».
definePageMeta({ key: (route) => route.params.slug })

const route = useRoute()
const { t } = useI18n()
const { locale, loc } = useLocalizedProduct()
const { $notify } = useNuxtApp()
const { isMobile } = useMobileDetection()
const appState = useAppState()
const { products } = appState
const { addToCart, cartItems } = useCart()
const { addRecentlyViewed } = useRecentlyViewed()
// Варианты товара: чистые хелперы (id позиции, цена/склад, дефолт)
import {
  firstVariant,
  findVariant,
  variantStock,
  variantPrice,
  cartLineId,
  VARIANT_SEPARATOR,
} from '~/utils/productVariants'

const productSlug = computed(() => route.params.slug)

// SSR-загрузка карточки: данные и мета-теги попадают в исходный HTML —
// это видят поисковики и превью в мессенджерах. Ключ — по slug+локали,
// watch перезагружает данные при смене slug ИЛИ языка (JSON-LD и
// canonical запрашиваются с ?lang=). 
const { data: responseData, status, error: fetchError, refresh } = await useAsyncData(
  `product-page-${locale.value}-${productSlug.value}`,
  () => $fetch(`/api/product/${productSlug.value}`, { query: { lang: locale.value } }),
  { watch: [productSlug, locale] },
)

// Спиннер — только пока карточки нет вовсе. Фоновый рефетч остатка идёт
// поверх уже показанного товара и не должен мигать спиннером.
const isLoading = computed(() => status.value === 'pending' && !responseData.value)

// API отдаёт { product, similarProducts, jsonLd } — достаём вложенный товар
const product = computed(() => {
  const response = responseData.value
  if (!response) return null
  return response.product ?? response
})

// Ошибка валидна, только когда данных нет вовсе: упавший ФОНОВЫЙ рефетч
// (мигание сети, оффлайн) не должен превращать открытую карточку
// в «Товар не найден» — показываем последние успешные данные.
const error = computed(() => (fetchError.value && !responseData.value ? t('productPage.notFound') : null))

const jsonLd = computed(() => responseData.value?.jsonLd ?? null)

// Локализованная копия для отображения и SEO: имя/описание/категории —
// в языке страницы (фолбэк — русский), все служебные поля — как есть
const productView = computed(() => loc(product.value))

// ─── Варианты (цвет/память/размер) ──────────────────────────────────
// Состояние выбора живёт здесь (не в ProductInfo): мобильная нижняя CTA
// добавляет ТОТ ЖЕ вариант, что и пилюли. Дефолт — первый вариант:
// детерминирован и на сервере, и на клиенте — гидратация не расходится.
const selectedVariantId = ref(null)
watch(
  product,
  (p) => {
    selectedVariantId.value = firstVariant(p)?.id ?? null
  },
  { immediate: true },
)
const selectedVariant = computed(() => findVariant(product.value, selectedVariantId.value))
const selectedStock = computed(() => variantStock(product.value, selectedVariant.value))

// Выбрали вариант с собственной картинкой — галерея прыгает на неё.
// null у товара без вариантов/без картинки: галерея живёт своей жизнью.
const galleryJumpTo = computed(() => selectedVariant.value?.image ?? null)

// Одобренные отзывы товара + сводка (приходят вместе с карточкой, SSR)
const reviews = computed(() => responseData.value?.reviews ?? [])
const ratingSummary = computed(
  () => responseData.value?.ratingSummary ?? { count: 0, average: 0 },
)

// ─── Мгновенный остаток: свежие данные мимо SWR-кеша HTML ────────────
// SSR-HTML маршрута /product/** отдаётся из SWR-кэша (swr: 60), а заказ
// могут подтвердить в Telegram в любой момент. /api/product/[slug] при
// этом НЕ кешируется — поэтому сразу после загрузки и при каждом
// возвращении на вкладку перезапрашиваем его: «Осталось: N шт.» на
// карточке актуально на момент показа, а не на момент рендера HTML.
// Один лишний запрос на открытие карточки — это 2 чтения KV, копейки.
const syncStock = () => {
  if (document.visibilityState !== 'visible') return
  refresh().catch(() => {})
}

// ─── SEO-мета (SSR) ─────────────────────────────────────────────────
useSeoMeta({
  title: () =>
    productView.value
      ? t('productPage.buyTitle', { name: productView.value.name })
      : t('productPage.notFound'),
  description: () => productView.value?.description?.slice(0, 160) ?? '',
  ogTitle: () => productView.value?.name ?? '',
  ogDescription: () => productView.value?.description?.slice(0, 160) ?? '',
  ogType: 'product',
  ogImage: () => jsonLd.value?.image?.[0] ?? null,
  twitterCard: 'summary_large_image',
})

useHead({
  // canonical ведёт на канонический адрес карточки из JSON-LD
  link: [{ rel: 'canonical', href: () => jsonLd.value?.offers?.url ?? null }],
  script: [
    {
      type: 'application/ld+json',
      // Открывающий угол строки JSON экранируется, иначе сериализованный
      // объект мог бы преждевременно закрыть тег скрипта в head
      innerHTML: () =>
        jsonLd.value ? JSON.stringify(jsonLd.value).replace(/</g, '\\u003c') : '',
    },
  ],
})

const productGallery = computed(() => {
  if (!product.value) return []
  const gallery = product.value.gallery ?? []
  const images = product.value.image && !gallery.includes(product.value.image)
    ? [product.value.image, ...gallery]
    : [...gallery]
  return images.length ? images : ['/images/placeholder.jpg']
})

const similarProducts = computed(() => {
  if (!product.value || !products.value) return []
  return products.value
    .filter((p) =>
      p.id !== product.value.id &&
      p.categories?.some((cat) => product.value.categories?.includes(cat)),
    )
    .slice(0, 4)
})

const isFavorite = computed(() => {
  if (!product.value) return false
  return appState.isFavorite(product.value.id)
})

const isInCart = (productId, variantId = null) => {
  if (!productId) return false
  const items = cartItems.value
  if (!items || !Array.isArray(items)) return false
  // С вариантом — точная позиция «productId::variantId»; без — товар
  // в целом: позиция без варианта ИЛИ любая его вариантная строка
  return items.some((item) => {
    if (!item || item.id === undefined || item.id === null) return false
    const id = String(item.id)
    if (variantId !== null) return id === cartLineId(productId, variantId)
    return id === String(productId) || id.startsWith(`${productId}${VARIANT_SEPARATOR}`)
  })
}

// formatPrice — единый из useProductUtils; в строку кнопки «В корзину»
// валюта добавляется рядом с параметром локали (аудит F13)
const { formatPrice } = useProductUtils()

const toggleFavorite = () => {
  if (!product.value) return
  appState.toggleFavorite(product.value)
}

const toggleSimilarFavorite = (similarProduct) => {
  appState.toggleFavorite(similarProduct)
}

const addToCartHandler = async (payload = null) => {
  if (!product.value) return
  // Точная позиция выбранного варианта; null для товаров без вариантов
  const variant = payload?.variant ?? selectedVariant.value ?? null
  if (isInCart(product.value.id, variant?.id ?? null)) return
  try {
    await addToCart(product.value, variant)
    $notify.success(t('product.cartAdded'))
  } catch {
    $notify.error(t('product.cartAddErrorLong'))
  }
}

const addSimilarToCart = async (item) => {
  if (isInCart(item?.id)) return
  try {
    await addToCart(item)
    $notify.success(t('product.cartAdded'))
  } catch {
    $notify.error(t('product.cartAddErrorLong'))
  }
}

// ─── Прокрутка: окно И внутренний контейнер ─────────────────────────
// window.scrollTo внутренний контейнер не трогает — он скроллится
// отдельно (фикс «карточка открылась с середины»)
const scrollContainer = ref(null)
const resetScroll = () => {
  window.scrollTo(0, 0)
  if (scrollContainer.value) scrollContainer.value.scrollTop = 0
}

// ─── История просмотров: slug из URL — наверх списка localStorage ───
const trackView = () => {
  if (route.params.slug) addRecentlyViewed(String(route.params.slug))
}

onMounted(() => {
  resetScroll()
  trackView()
  syncStock()
  // Возврат на вкладку (подтвердили заказ в Telegram, вернулись в магазин) —
  // дотягиваем свежий остаток
  document.addEventListener('visibilitychange', syncStock)
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', syncStock)
})

watch(() => route.params.slug, () => {
  resetScroll()
  trackView()
})
</script>

<style scoped>
.product-page {
  min-height: 100dvh;
}

.flex-1.overflow-auto {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Нижний воздух на мобильных: фиксированная CTA (52px + зазор) + нижняя
   навигация (60px) + safe-area + запас 12px — по образцу .mobile-nav-safe.
   Навигация/CTA видны <1024px (lg:hidden), поэтому брейкпоинт тот же */
@media (max-width: 1023.98px) {
  .product-scroll-safe {
    padding-bottom: calc(
      var(--mobile-nav-height, 60px) + 64px + var(--safe-area-bottom, 0px) + 12px
    );
  }
}

/* Крошки прилипают ПОД шапкой сайта (56px), а не к верху экрана */
.breadcrumbs-bar {
  top: var(--header-height, 56px);
}

/* Кнопка «В корзину» — над нижней навигацией с учётом safe-area.
   z-60 и translateZ(0): контент карточки с transform-анимациями
   (галерея, бейджи, тосты) при инерционной прокрутке получает
   GPU-слои и мог отрисовываться ПОВЕРХ закреплённого низа (z-40).
   Свой композитинг-слой + z выше контента (0–30) — артефакт исчезает.
   Зум галереи (100/1000) и лайтбокс отзывов (10001) остаются выше. */
.fixed-bottom-cart-button {
  position: fixed;
  bottom: calc(var(--mobile-nav-height, 60px) + var(--safe-area-bottom, 0px));
  left: 0;
  right: 0;
  z-index: 60;
  transform: translateZ(0);
  padding: 0 6px;
}

.fixed-bottom-cart-button .btn {
  height: 52px;
}

/* «Товар закончился»: НЕПРОЗРАЧНАЯ нейтральная кнопка. daisyUI красит
   .btn:disabled в opacity .5 — плашка почти сливалась с фоном. */
.btn-oos:disabled {
  opacity: 1;
  background-color: var(--color-base-200);
  color: var(--color-base-content);
  border: 1px solid var(--color-base-300);
}
</style>
