<!-- app/components/products/ProductCardGrid.vue -->
<template lang="pug">
.card.product-card.p-0.bg-base-100.relative.group.overflow-hidden.rounded-2xl.border(
  class="border-base-300 hover:border-primary/30"
  :class="{ 'has-search-highlight': hasSearchHighlight }"
)
  //- Кнопка избранного
  button.favorite-btn(
    class="top-1 left-1 z-10 absolute flex justify-center items-center backdrop-blur rounded-full size-8 transition-colors",
    :class="isFavorite ? 'bg-error text-white' : 'bg-base-100/40 text-base-content'",
    @click="toggleFavorite",
    :title="isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'",
    :aria-label="isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'"
  )
    icon(:name="isFavorite ? 'heroicons:heart-solid' : 'heroicons:heart'",
      size="20"
    )

  //- Ссылка на товар
  .card-content
    NuxtLink.block(:to="productUrl", prefetch)
      .image-container.relative.w-full.aspect-square.overflow-hidden.bg-base-200.flex.items-center.justify-center
        //- Placeholder при загрузке/ошибке
        .placeholder.absolute.inset-0.flex.items-center.justify-center(
          v-if="showPlaceholder"
        )
          icon(name="heroicons:photo" size="32" class="text-base-300")

        //- Изображение
        img.product-image(
          v-if="currentImage && !imageError",
          :src="currentImage",
          :alt="product.name",
          :loading="loadingAttr",
          :fetchpriority="fetchPriority",
          decoding="async",
          @load="onImageLoad",
          @error="onImageError"
        )

      .card-body.relative.p-3.gap-y-1
        //- Название товара
        h2.card-title.min-h-9.text-sm.font-medium.text-base-content.line-clamp-2.leading-snug(
          class="lg:min-h-10 lg:text-base"
        )
          span(v-html="highlightedName")

        //- Описание товара
        p.line-clamp-2.leading-snug.text-xs(
          class="lg:text-sm text-base-content/60"
        )
          span(v-html="highlightedDescription")

    //- Цена и статус
    .card-actions.flex.items-center.justify-between.px-3.pb-3.pt-1
      .font-semibold.text-base-content(
        v-if="product.inStock",
        class="text-base lg:text-lg"
      ) {{ formatPrice(product.price) }} ₽
      .text-error.text-xs(v-else) Нет в наличии
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
const productUrl = computed(() => `/product/${props.product.slug}`)

const isFavorite = computed(() => app.isFavorite(props.product.id))

//- Оптимизация загрузки изображений - lazy для всех кроме первых 4
const loadingAttr = computed(() => props.index < 4 ? 'eager' : 'lazy')
const fetchPriority = computed(() => props.index < 4 ? 'high' : 'low')

//- ============================================
//- Изображения - упрощённая логика
//- ============================================
const imageLoaded = ref(false)
const imageError = ref(false)

// ✅ ИСПРАВЛЕНО: обратные кавычки везде, где формируется URL
const currentImage = computed(() => {
  const url = props.product?.image
  if (!url || url === 'null' || url === 'undefined') return null

  // Base64
  if (url.startsWith('data:')) return url

  // Unsplash без домена
  if (url.startsWith('photo-')) return `https://images.unsplash.com/${url}`

  // Полный URL
  if (url.startsWith('http') || url.startsWith('/')) return url

  return `/images/${url}`
})

const showPlaceholder = computed(() => !currentImage.value || imageError.value || !imageLoaded.value)

const onImageLoad = () => {
  imageLoaded.value = true
}

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
  contain: layout style;
  content-visibility: auto;
  contain-intrinsic-size: auto 220px;
  transition: border-color var(--transition-base, 0.25s), box-shadow var(--transition-base, 0.25s), transform var(--transition-base, 0.25s);
}

.product-card:hover {
  box-shadow: var(--shadow-md, 0 4px 10px -2px rgb(0 0 0 / 0.06));
}

/* Изображения */
.image-container {
  position: relative;
}

.product-image {
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