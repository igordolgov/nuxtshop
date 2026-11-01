<!-- app/components/products/RecentlyViewed.vue — блок «Недавно смотрели».
     История — localStorage клиента (useRecentlyViewed), персональные
     данные: SSR не рендерит ничего, блок появляется после гидратации
     и сам скрывается без истории (главная/карточка не ломаются).
     Товары разименуются из общего каталога appState; если каталог ещё
     не загружен (прямой заход на карточку) — догружается на клиенте.
     Сетка и карточка — паттерн SimilarProducts; текущий товар карточки
     исключается через excludeId. -->
<template lang="pug">
section.recently-viewed(
  v-if="isMounted && items.length"
  aria-labelledby="recently-viewed-title"
)
  .container.mx-auto.px-2(class="lg:px-4")
    .flex.items-center.justify-between.mb-2(class="lg:mb-3")
      h2#recently-viewed-title.text-xl.font-semibold.text-base-content(class="lg:text-2xl") Недавно смотрели
      button.clear-link.btn.btn-ghost.btn-xs.rounded-lg(
        class="text-base-content/75"
        type="button"
        @click="clearHistory"
      ) Очистить

    .grid.grid-cols-2.gap-1(
      class="lg:gap-4 sm:grid-cols-3 lg:grid-cols-4"
    )
      .recent-card(v-for="item in items" :key="item.id")
        .card.bg-base-100.shadow-md.transition-all.duration-300.h-full.flex.flex-col.group(class="hover:shadow-lg")
          //- Кнопки действий
          .absolute.top-1.left-2.z-10
            //- text-white, а не text-error-content: в business error-content
            //- тёмный — сердече «чёрное на красном» (паттерн ProductInfo)
            button.btn.btn-circle.btn-xs(
              :class="isFav(item.id) ? 'btn-error text-white' : 'btn-ghost bg-base-100/80'"
              @click.stop="$emit('toggle-favorite', item.id)"
              :title="isFav(item.id) ? 'Удалить из избранного' : 'Добавить в избранное'"
            )
              svg.w-4.h-4(
                :class="isFav(item.id) ? 'fill-current' : 'fill-none stroke-current text-base-content/70'"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                stroke-width="1.5"
              )
                path(d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z")

          .absolute.top-1.right-2.z-10
            button.btn.btn-circle.btn-xs(
              @click.stop="$emit('add-to-cart', item)"
              :disabled="!item.inStock || isInCart(item.id)"
              :class="isInCart(item.id) ? 'btn-success text-success-content' : 'btn-primary text-primary-content'"
              :title="isInCart(item.id) ? 'Уже в корзине' : 'Добавить в корзину'"
            )
              svg.w-6.h-6(
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              )
                path(
                  v-if="!isInCart(item.id)"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                )
                path(
                  v-else
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M5 13l4 4L19 7"
                )

          //- Ссылка на товар
          NuxtLink.flex-1.flex.flex-col(:to="getProductUrl(item)" prefetch)
            figure.p-1.pt-0.flex.justify-center.items-center(class="lg:h-40")
              img.rounded-box.w-full.object-cover.max-w-full(
                :src="getValidImageUrl(item.image)"
                :srcset="productSrcset(getValidImageUrl(item.image))"
                :sizes="productSrcset(getValidImageUrl(item.image)) ? '(max-width: 767px) 45vw, 280px' : undefined"
                :alt="item.name"
                @error="handleImageError"
                draggable="false"
                loading="lazy"
                :width="400"
                :height="300"
              )

            .card-body.p-1.flex-1.flex.flex-col
              .flex-1
                h3.card-title.text-xs.font-semibold.text-base-content.line-clamp-2.mb-1(class="lg:text-sm") {{ item.name }}

              .flex.items-center.justify-between.-mt-1.border-t.border-base-200
                .text-md.font-bold.text-primary {{ formatPrice(item.price) }}
                .text-xs(
                  :class="item.inStock ? 'text-success' : 'text-error'"
                ) {{ item.inStock ? 'В наличии' : 'Нет в наличии' }}
</template>

<script setup>
const props = defineProps({
  /** ID товара, который не показывать (страница этого товара) */
  excludeId: { type: [String, Number], default: null },
})

defineEmits(['toggle-favorite', 'add-to-cart'])

const MAX_VISIBLE = 8

const appState = useAppState()
const { products } = appState
const { cartItems, getProductUrl, slugify } = useCart()
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
  return found
})

const clearHistory = () => {
  clearRecentlyViewed()
  refreshHistory()
}

const isFav = (id) => {
  try {
    return appState.isFavorite?.(id) ?? false
  } catch {
    return false
  }
}

const isInCart = (productId) => {
  if (!productId) return false
  const items = cartItems.value
  if (!items || !Array.isArray(items)) return false
  return items.some((item) => item && String(item.id) === String(productId))
}

const fallbackImage = '/images/placeholder.jpg'

const getValidImageUrl = (url) => {
  if (!url) return fallbackImage
  if (url.startsWith('data:')) return url
  if (url.startsWith('/')) return url
  if (url.startsWith('http')) return url
  return fallbackImage
}

const formatPrice = (price) => {
  if (!price && price !== 0) return '0 ₽'
  return `${price.toLocaleString('ru-RU')} ₽`
}

const handleImageError = (event) => {
  if (event?.target) event.target.src = fallbackImage
}
</script>

<style scoped>
.recently-viewed {
  width: 100%;
  margin-top: 0.5rem;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
