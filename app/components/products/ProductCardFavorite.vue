<!-- app/components/products/ProductCardFavorite.vue -->
<!-- ============================================
  Компонент: ProductCardFavorite
  Назначение: карточка товара для страницы избранного
============================================ -->
<template lang="pug">
.card.product-card.p-0.bg-base-100.shadow-xl.transition-all.duration-500.relative.group.overflow-hidden.border.rounded-xl(
  class="border-secondary/60"
)
  //- Кнопки действий
  .action-buttons.m-1
    //- Удалить из избранного
    button.btn-action.btn-remove(
      @click.stop="$emit('remove-favorite', product)"
      title="Удалить из избранного"
    )
      svg(viewBox="0 0 24 24" fill="currentColor")
        path(d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z")
    
    //- Добавить в корзину
    button.btn-action(
    v-if="product.inStock"
      :class="isInCart ? 'btn-cart-active' : 'btn-cart'"
      :disabled="!product.inStock || isInCart"
      @click.stop="$emit('add-to-cart', product)"
      :title="isInCart ? 'Добавлено' : 'В корзину'"
    )
      svg(viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3")
        path(
          v-if="!isInCart"
          stroke-linecap="round"
          d="M12 6v12M6 12h12"
        )
        path(
          v-else
          stroke-linecap="round"
          d="M5 13l4 4L19 7"
        )

  //- Ссылка на товар
  .card-content
    NuxtLink.block(:to="`/product/${product.slug}`" prefetch)
      figure.px-2.pt-2.overflow-hidden
        .image-container.relative.h-32.w-full.rounded-xl.overflow-hidden.bg-base-200.flex.items-center.justify-center
          .skeleton.absolute.inset-0.animate-pulse(v-if="imageLoading")
          
          img.product-image(
            :src="currentImage" 
            :alt="product.name"
            :class="imageLoading ? 'opacity-0' : 'opacity-100'"
            @load="onImageLoad"
            @error="onImageError"
            loading="lazy"
            decoding="async"
          )
      
      .card-body.relative.p-2.bg-base-100.transform.transition-all.duration-500.gap-y-1.pb-0.z-1(
        class="group-hover:-translate-y-2.5"
      )
        //- Название
        h2.card-title.min-h-8.text-base-content.transition-colors.duration-300.text-sm.leading-tight(
          class="lg:min-h-10 lg:text-base group-hover:text-sky-600"
        )
          span.line-clamp-2 {{ product.name }}
        
        //- Описание
        p.text-secondary.line-clamp-2.leading-snug.transition-colors.duration-300.text-xs(
          class="lg:text-sm group-hover:text-base-content/80"
        )
          | {{ product.description || product.category }}
    
    //- Цена и статус
    .card-actions.justify-between.items-center.mt-0.px-3.pb-2
      .text-base.font-bold.text-sky-700.transition-all.duration-300(
        v-if="product.inStock"
        class="lg:text-lg group-hover:scale-105"
      ) {{ formatPrice(product.price) }}
      .text-md.text-error.transition-all.duration-300(
        v-else
        class="group-hover:scale-105"
      ) нет в наличии

  //- Glow эффект
  .absolute.inset-0.rounded-xl.pointer-events-none(
    class="bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
  )
</template>

<script setup>
const props = defineProps({
  product: { type: Object, required: true },
  isInCart: { type: Boolean, default: false }
})

defineEmits(['remove-favorite', 'add-to-cart'])

const currentImage = ref('')
const imageLoading = ref(true)

const formatPrice = (price) => {
  return price ? `${price.toLocaleString('ru-RU')} ₽` : '0 ₽'
}

const getValidImageUrl = (url) => {
  if (!url || url === 'null' || url === 'undefined') return '/images/placeholder.jpg'
  if (url.startsWith('data:')) return url
  if (url.startsWith('photo-')) return `https://images.unsplash.com/${url}`
  if (url.includes('unsplash.com')) return url
  if (url.startsWith('/')) return url
  if (url.startsWith('http')) return url
  return '/images/placeholder.jpg'
}

const onImageLoad = () => {
  imageLoading.value = false
}

const onImageError = () => {
  imageLoading.value = false
  currentImage.value = '/images/placeholder.jpg'
}

onMounted(() => {
  const imageUrl = props.product?.image || props.product?.images?.[0]
  currentImage.value = getValidImageUrl(imageUrl)
})
</script>

<style scoped>
.product-card {
  width: 100%;
  max-width: 280px;
  will-change: transform;
  backface-visibility: hidden;
}

.action-buttons {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  right: 0.5rem;
  display: flex;
  justify-content: space-between;
  z-index: 10;
}

.btn-action {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.btn-action svg {
  width: 0.75rem;
  height: 0.75rem;
}

.btn-action:hover {
  transform: scale(1.1);
}

.btn-action:disabled {
  cursor: default;
  opacity: 0.7;
}

.btn-remove {
  background: #dc2626;
  color: white;
}

.btn-cart {
  background: #3b82f6;
  color: white;
}

.btn-cart-active {
  background: #16a34a;
  color: white;
}

.card-content {
  transform: translateZ(0);
}

.image-container {
  position: relative;
  min-height: 128px;
}

.product-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  background-color: hsl(var(--b2));
  transition: opacity 0.3s ease;
}

.skeleton {
  background: linear-gradient(90deg, 
    hsl(var(--b2)) 25%, 
    hsl(var(--b3)) 50%, 
    hsl(var(--b2)) 75%
  );
  background-size: 200% 100%;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (max-width: 640px) {
  .image-container {
    height: 120px;
  }
}

@media (min-width: 768px) {
  .image-container {
    height: 140px;
  }
}
</style>