<!-- app/pages/product/[slug].vue -->
<template lang="pug">
.product-page.min-h-screen.bg-base-100.text-base-content.flex.flex-col(
  :class="{ 'horizontal-orientation': isHorizontal }"
)
  Header

  //- Хлебные крошки
  .sticky.top-0.z-10.bg-base-100.border-b.border-base-200.shadow-sm
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
    .container.mx-auto.px-2.flex-1(
      class="lg:px-4 lg:pb-0"
      :class="{ 'horizontal-layout': isHorizontal }"
    )
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
            button.btn.btn-primary.btn-sm(@click="$router.back()") Вернуться назад
            NuxtLink.btn.btn-secondary.btn-sm(to="/" prefetch) В каталог

      //- Контент товара
      template(v-else)
        .flex.flex-col(
          class="lg:flex-row lg:gap-6"
          :class="{ 'horizontal-product-layout': isHorizontal }"
        )
          //- Галерея изображений
          .product-image.flex-1(
            class="lg:p-3"
            :class="{ 'horizontal-image-section': isHorizontal }"
          )
            ProductGallery(
              :product="product"
              :gallery="productGallery"
              :product-name="product.name"
            )

          //- Информация о товаре
          .product-info.flex-1(
            class="sm:pt-4"
            :class="{ 'horizontal-info-section': isHorizontal }"
          )
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

  //- Мобильная кнопка "В корзину"
  .fixed-bottom-cart-button(
    v-if="product && !isLoading && !error"
    :class="{ 'horizontal-button': isHorizontal }"
    class="lg:hidden"
  )
    button.btn.btn-lg.w-full.rounded-t-box(
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
import Header from '~/components/layout/Header.vue'
import MobileNavFooter from '~/components/layout/MobileNavFooter.vue'
import ProductGallery from '~/components/products/ProductGallery.vue'
import ProductInfo from '~/components/products/ProductInfo.vue'
import SimilarProducts from '~/components/products/SimilarProducts.vue'

const route = useRoute()
const { $notify } = useNuxtApp()
const { isMobile, isHorizontal } = useMobileDetection()
const appState = useAppState()
const { products, loadProducts } = appState
const { addToCart, cartItems } = useCart()

const product = ref(null)
const isLoading = ref(true)
const error = ref(null)

const productSlug = computed(() => route.params.slug)

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
    .filter(p =>
      p.id !== product.value.id &&
      p.categories?.some(cat => product.value.categories?.includes(cat))
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
  return items.some(item => {
    if (!item || item.id === undefined || item.id === null) return false
    return String(item.id) === String(productId)
  })
}

const formatPrice = (price) => {
  if (!price && price !== 0) return '0 ₽'
  return `${price.toLocaleString('ru-RU')} ₽`
}

const loadProductData = async () => {
  isLoading.value = true
  error.value = null
  product.value = null

  try {
    const response = await $fetch(`/api/product/${productSlug.value}`)
    if (response?.product) {
      product.value = response.product
    } else if (response) {
      product.value = response
    } else {
      throw new Error('Товар не найден')
    }
  } catch (err) {
    console.error('Ошибка загрузки товара:', err)
    await loadProducts()
    const found = products.value?.find(p =>
      p.slug === productSlug.value ||
      String(p.id) === String(productSlug.value)
    )
    if (found) {
      product.value = found
    } else {
      error.value = 'Товар не найден'
    }
  } finally {
    isLoading.value = false
  }
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
  } catch (err) {
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
  loadProductData()
  window.scrollTo(0, 0)
})

watch(() => route.params.slug, () => {
  loadProductData()
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

/* Вертикальный режим - кнопка снизу над футером */
.fixed-bottom-cart-button {
  position: fixed;
  bottom: 57px;
  left: 0;
  right: 0;
  z-index: 40;
  padding: 0 6px;
}

.fixed-bottom-cart-button .btn {
  height: 52px;
}

/* Горизонтальный режим - кнопка с отступом слева */
.fixed-bottom-cart-button.horizontal-button {
  left: 62px;
  bottom: 0;
  padding: 8px 6px;
  margin-bottom: -8px;
}

.fixed-bottom-cart-button.horizontal-button .btn {
  height: 48px;
  border-radius: 0.5rem 0.5rem 0 0;
}

/* Горизонтальный layout */
.horizontal-orientation .horizontal-layout {
  /* Убираем padding-left, чтобы не дублировать отступ, он будет на .flex-1.overflow-auto */
  /* padding-left: 62px; */
}

.horizontal-orientation .flex-1.overflow-auto {
  padding-bottom: 70px;
  padding-left: var(--horizontal-nav-width, 70px);
}

.horizontal-product-layout {
  flex-direction: row !important;
}

.horizontal-image-section {
  max-width: 50%;
}

.horizontal-info-section {
  max-width: 50%;
  overflow-y: auto;
}
</style>