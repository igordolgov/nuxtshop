<template lang="pug">
.product-info
  .card.bg-base-100.shadow-lg(class="lg:shadow-none")
    .card-body.p-2.mt-0(class="lg:p-4 lg:pb-0")
      //- Заголовок и избранное
      .flex.justify-between.items-center.mb-1(class="lg:mb-4")
        h1.card-title.text-xl.text-base-content(class="lg:text-2xl") {{ product.name }}
        ClientOnly
          button.btn.btn-circle.btn-xs(
            :class="isFavorite ? 'btn-error text-error-content' : 'btn-ghost'"
            @click="$emit('toggle-favorite')"
            :title="isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'"
            class="lg:btn-sm"
          )
            svg.w-4.h-4(
              :class="isFavorite ? 'fill-current' : 'fill-none stroke-current'"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              stroke-width="1.5"
            )
              path(d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z")

      //- Категории
      .flex.flex-wrap.gap-1.mb-1(class="lg:gap-2 lg:mb-4")
        .badge.badge-sm.border-base-300.rounded-sm(
          v-for="category in product.categories"
          :key="category"
          class="border-base-content/70"
        )
          span(class="text-base-content/70") {{ category }}

      //- Описание
      .text-base-content.mb-1(class="lg:mb-4")
        p.text-xs(class="lg:text-sm") {{ product.description }}

      //- Цена и наличие
      .flex.items-center.gap-3(class="lg:flex-row lg:items-center lg:justify-between lg:mb-6")
        .flex.items-center.justify-between
          .price-section
            .text-2xl.font-bold.text-sky-600 {{ formatPrice(product.price) }}
            .text-xs(class="text-base-content/70") Включая НДС
          
          .stock-section.ml-8.mt-1
            .badge.rounded-sm(
              :class="product.inStock ? 'badge-success text-success-content' : 'badge-error text-error-content'"
              class="lg:badge-lg"
            )
              span(v-if="product.inStock") ✓ В наличии
              span(v-else) ✗ Нет в наличии
            
            .text-xs.mt-1(
              v-if="product.inStock && product.stockQuantity"
              class="text-base-content/70"
            ) Осталось: {{ product.stockQuantity }} шт.

      //- Десктопная кнопка
      .hidden(class="lg:block lg:mb-0")
        button.btn.w-full.btn-lg.rounded-lg(
          :disabled="!product.inStock || isInCart"
          @click="$emit('add-to-cart')"
          :class="isInCart ? 'btn-success text-success-content' : 'btn-primary'"
        )
          span.flex.items-center.justify-center.w-full
            span.mr-2 {{ isInCart ? '✅' : '🛒' }}
            span
              span(v-if="isInCart") Товар уже в корзине
              span(v-else-if="product.inStock") Добавить в корзину
              span(v-else) Товар закончился
            span.ml-2.text-md.font-normal(v-if="!isInCart && product.inStock") {{ formatPrice(product.price) }}

      //- Характеристики
      .join.join-vertical.w-full.bg-base-200.mt-1
        details.join-item
          summary.cursor-pointer.p-0.pl-2(class="lg:p-4 lg:pb-0 text-base font-medium lg:text-lg") Характеристики
          .p-2.pt-2(class="lg:p-4")
            .space-y-0
              .flex.justify-between.py-1.border-b(class="border-base-content/10")
                span.text-xs(class="lg:text-sm text-base-content/70") Категории:
                span.text-xs.font-medium.text-right(class="lg:text-sm") {{ product.categories?.join(', ') }}
              .flex.justify-between.py-1.border-b(class="border-base-content/10")
                span.text-xs(class="lg:text-sm text-base-content/70") Код товара:
                span.text-xs.font-medium(class="lg:text-sm") \#{{ product.id }}
              .flex.justify-between.py-1.border-b(class="border-base-content/10")
                span.text-xs(class="lg:text-sm text-base-content/70") Статус:
                span.text-xs.font-medium(
                  :class="product.inStock ? 'text-success' : 'text-error'"
                  class="lg:text-sm"
                ) {{ product.inStock ? 'Доступен' : 'Недоступен' }}
              .flex.justify-between.py-1.border-b(class="border-base-content/10")
                span.text-xs(class="lg:text-sm text-base-content/70") Дата добавления:
                span.text-xs.font-medium(class="lg:text-sm") {{ formatDate(product.createdAt) }}
</template>

<script setup>
const props = defineProps({
  product: { type: Object, required: true },
  isInCart: { type: Boolean, default: false },
  isFavorite: { type: Boolean, default: false }  // ← Добавлен prop
})

defineEmits(['toggle-favorite', 'add-to-cart'])

const formatPrice = (price) => {
  if (!price && price !== 0) return '0 ₽'
  return `${price.toLocaleString('ru-RU')} ₽`
}

const formatDate = (dateString) => {
  if (!dateString) return 'Неизвестно'
  return new Date(dateString).toLocaleDateString('ru-RU')
}
</script>

<style scoped>
.product-info {
  width: 100%;
}
</style>