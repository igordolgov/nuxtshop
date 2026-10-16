<!-- app/pages/product/[slug].vue — карточка товара: галерея, информация,
    похожие товары, фиксированная кнопка «В корзину» (мобильные). -->
<template lang="pug">
.product-page.bg-base-100.text-base-content.flex.flex-col
  Header

  //- Хлебные крошки: sticky ПОД шапкой сайта (раньше top-0 — уезжали под неё)
  .breadcrumbs-bar.sticky.z-10.bg-base-100.border-b.border-base-200.shadow-sm
    .container.min-h-10.mx-auto.px-2(class="sm:hidden lg:p-4 lg:pb-0")
      nav(aria-label="Хлебные крошки")
        .breadcrumbs.pt-2.pb-1.text-sm.overflow-x-auto.whitespace-nowrap
          ul.flex
            li
              NuxtLink.link.link-hover(to="/" prefetch) Главная
            li(aria-current="page")
              span {{ product?.name || 'Товар не найден' }}

  //- Основной контент
  .flex-1.overflow-auto.flex.flex-col.pb-14(class="lg:pb-0")
    .container.mx-auto.px-2.flex-1(class="lg:px-4 lg:pb-0")
      //- Состояние загрузки
      .flex.flex-col.items-center.justify-center.min-h-96(v-if="isLoading")
        .loading.loading-spinner.loading-lg
        span.mt-4.text-center Загрузка товара...

      //- Ошибка
      .flex.flex-col.items-center.justify-center.min-h-96(v-else-if="error || !product")
        .text-center
          .text-5xl.mb-4.text-error 😔
          h1.text-xl.font-bold.mb-4 Товар не найден
          p.mb-6.text-sm(class="text-base-content/70") {{ error || 'Запрошенный товар не существует' }}
          .flex.flex-col.gap-3
            button.btn.btn-primary.btn-sm(type="button" @click="$router.back()") Вернуться назад
            NuxtLink.btn.btn-secondary.btn-sm(to="/" prefetch) В каталог

      //- Контент товара.
      //- В landscape двухколоночная раскладка больше не используется:
      //- вертикальный поток на всех мобильных (как в крупных магазинах),
      //- двухколоночная — только на десктопе (lg:flex-row)
      template(v-else)
        .flex.flex-col(class="lg:flex-row lg:gap-6")
          //- Галерея изображений
          .product-image.flex-1(class="lg:p-3")
            ProductGallery(
              :product="product"
              :gallery="productGallery"
              :product-name="product.name"
            )

          //- Информация о товаре
          .product-info.flex-1(class="sm:pt-4")
            ProductInfo(
              :product="product"
              :is-favorite="isFavorite"
              :is-in-cart="isInCart(product.id)"
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

  //- Мобильная кнопка «В корзину»: над нижней навигацией + safe-area
  //- (раньше — магические 57px)
  .fixed-bottom-cart-button(
    v-if="product && !isLoading && !error"
    class="lg:hidden"
  )
    button.btn.btn-lg.w-full.rounded-t-box(
      type="button"
      :disabled="!product.inStock || isInCart(product.id)"
      @click="addToCartHandler"
      :class="isInCart(product.id) ? 'btn-success' : 'btn-primary'"
    )
      .flex.items-center.justify-center.w-full
        span.mr-2 {{ isInCart(product.id) ? '✅' : '🛒' }}
        span
          span(v-if="isInCart(product.id)") Товар уже в корзине
          span(v-else-if="product.inStock") Добавить в корзину · {{ formatPrice(product.price) }}
          span(v-else) Товар закончился

  ClientOnly
    div
      MobileNavFooter(v-if="isMobile")
</template>

<script setup>
const route = useRoute()
const { $notify } = useNuxtApp()
const { isMobile } = useMobileDetection()
const appState = useAppState()
const { products } = appState
const { addToCart, cartItems } = useCart()

const productSlug = computed(() => route.params.slug)

// SSR-загрузка карточки: данные и мета-теги попадают в исходный HTML —
// это видят поисковики и превью в мессенджерах. watch перезагружает
// данные при смене slug без размонтирования компонента.
const { data: responseData, status, error: fetchError } = await useAsyncData(
  'product-page',
  () => $fetch(`/api/product/${productSlug.value}`),
  { watch: [productSlug] },
)

const isLoading = computed(() => status.value === 'pending')

// API отдаёт { product, similarProducts, jsonLd } — достаём вложенный товар
const product = computed(() => {
  const response = responseData.value
  if (!response) return null
  return response.product ?? response
})

const error = computed(() => (fetchError.value ? 'Товар не найден' : null))

const jsonLd = computed(() => responseData.value?.jsonLd ?? null)

// ─── SEO-мета (SSR) ─────────────────────────────────────────────────
useSeoMeta({
  title: () => (product.value ? `${product.value.name} — купить` : 'Товар не найден'),
  description: () => product.value?.description?.slice(0, 160) ?? '',
  ogTitle: () => product.value?.name ?? '',
  ogDescription: () => product.value?.description?.slice(0, 160) ?? '',
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

const isInCart = (productId) => {
  if (!productId) return false
  const items = cartItems.value
  if (!items || !Array.isArray(items)) return false
  return items.some((item) => {
    if (!item || item.id === undefined || item.id === null) return false
    return String(item.id) === String(productId)
  })
}

const formatPrice = (price) => {
  if (!price && price !== 0) return '0 ₽'
  return `${price.toLocaleString('ru-RU')} ₽`
}

const toggleFavorite = () => {
  if (!product.value) return
  appState.toggleFavorite(product.value)
}

const toggleSimilarFavorite = (similarProduct) => {
  appState.toggleFavorite(similarProduct)
}

const addToCartHandler = async () => {
  if (!product.value || isInCart(product.value.id)) return
  try {
    await addToCart(product.value)
    $notify.success('Товар добавлен в корзину!')
  } catch {
    $notify.error('Не удалось добавить товар в корзину')
  }
}

const addSimilarToCart = async (item) => {
  if (isInCart(item?.id)) return
  try {
    await addToCart(item)
    $notify.success('Товар добавлен в корзину!')
  } catch {
    $notify.error('Не удалось добавить товар в корзину')
  }
}

onMounted(() => {
  window.scrollTo(0, 0)
})

watch(() => route.params.slug, () => {
  window.scrollTo(0, 0)
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

/* Крошки прилипают ПОД шапкой сайта (56px), а не к верху экрана */
.breadcrumbs-bar {
  top: var(--header-height, 56px);
}

/* Кнопка «В корзину» — над нижней навигацией с учётом safe-area */
.fixed-bottom-cart-button {
  position: fixed;
  bottom: calc(var(--mobile-nav-height, 60px) + var(--safe-area-bottom, 0px));
  left: 0;
  right: 0;
  z-index: 40;
  padding: 0 6px;
}

.fixed-bottom-cart-button .btn {
  height: 52px;
}
</style>