<!-- app/components/products/ProductCardGrid.vue -->
<template lang="pug">
.card.product-card.p-0.bg-base-100.shadow-md.relative.group.overflow-hidden(
  class="border-secondary/30 border rounded-xl"
  :class="{ 'has-search-highlight': hasSearchHighlight }"
)
  //- Кнопка избранного
  button.favorite-btn(
    class="absolute top-1 left-1 z-10 btn btn-circle btn-xs",
    :class="isFavorite ? 'btn-error' : 'btn-ghost'",
    @click="toggleFavorite", 
    :title="isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'",
    :aria-label="isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'"
  )
    icon(
      :name="isFavorite ? 'heroicons:heart-solid' : 'heroicons:heart'",
      size="14",
      :class="isFavorite ? 'text-white' : 'text-base-content/50'"
    )

  //- Ссылка на товар
  .card-content
    NuxtLink.block(:to="productUrl", prefetch)
      figure.px-2.pt-2.overflow-hidden
        .image-container.relative.h-32.w-full.rounded-xl.overflow-hidden.bg-base-200.flex.items-center.justify-center
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
      
      .card-body.relative.p-2.bg-base-100.gap-y-1(
        class="pb-0 group-hover:-translate-y-1"
      )
        //- Название товара
        h2.card-title.min-h-8.text-base-content.text-sm.line-clamp-2.leading-tight(
          class="lg:min-h-10 lg:text-base"
        )
          span(v-html="highlightedName")
        
        //- Описание товара
        p.text-secondary.line-clamp-2.leading-snug.text-xs(
          class="lg:text-sm"
        )
          span(v-html="highlightedDescription")
    
    //- Цена и статус
    .card-actions.justify-between.items-center.px-3.pb-1.mt-0
      .font-bold.text-sky-700(
        v-if="product.inStock",
        class="text-base lg:text-lg"
      ) {{ formatPrice(product.price) }} ₽
      .text-error.text-sm(v-else) нет в наличии
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

const emit = defineEmits(['toggle-favorite', 'add-to-cart'])

//- ============================================
//- Оптимизация: минимальное использование composables
//- ============================================
const app = useAppState()

//- ============================================
//- Вычисляемые свойства - мемоизированные
//- ============================================
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
  return text.replace(regex, '<mark class="bg-yellow-200 px-0.5 rounded">$1</mark>')
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
  contain-intrinsic-size: auto 200px;
}

/* Убираем лишние transition-all */
.card-body {
  transition: transform 0.2s ease;
}

/* Изображения */
.image-container {
  position: relative;
  min-height: 128px;
  background: hsl(var(--b2));
}

.product-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transition: transform 0.2s ease;
}

.group:hover .product-image {
  transform: scale(1.02);
}

/* Подсветка поиска */
:deep(mark) {
  background-color: rgba(255, 235, 59, 0.5);
  border-radius: 2px;
  padding: 0 1px;
}

.has-search-highlight {
  border-left: 3px solid #ffeb3b;
}

/* Адаптивность */
@media (max-width: 640px) {
  .image-container {
    height: 100px;
  }
  
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

/* Доступность */
button:focus-visible,
a:focus-visible {
  outline: 2px solid hsl(var(--p));
  outline-offset: 2px;
}
</style>