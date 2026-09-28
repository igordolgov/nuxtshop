<template lang="pug">
.product-info
  .card.bg-base-100(class="lg:shadow-none")
    .card-body.p-3.gap-3(class="lg:p-0")
      //- Заголовок и избранное
      .flex.justify-between.items-start.gap-3
        h1.text-xl.font-semibold.text-base-content.leading-snug(class="lg:text-2xl") {{ product.name }}
        ClientOnly
          button.shrink-0.size-9.rounded-full.flex.items-center.justify-center.border.transition-colors(
            :class="isFavorite ? 'bg-error text-white border-error' : 'border-base-300 text-base-content/50 hover:text-error hover:border-error/40'"
            @click="$emit('toggle-favorite')"
            :title="isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'"
          )
            svg.w-4.h-4(
              :class="isFavorite ? 'fill-current' : 'fill-none stroke-current'"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              stroke-width="1.5"
            )
              path(d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z")

      //- Категории
      .flex.flex-wrap.gap-2(v-if="product.categories?.length")
        span.px-2.py-1.rounded-full.text-xs.border.border-base-300(
          v-for="category in product.categories"
          :key="category"
          class="text-base-content/60"
        ) {{ category }}

      //- Описание
      p.text-sm.leading-relaxed(class="text-base-content/70") {{ product.description }}

      //- Цена и наличие
      .flex.items-end.justify-between.gap-4.py-1
        .price-section
          .text-3xl.font-bold.text-base-content {{ formatPrice(product.price) }}
          .text-xs.mt-1(class="text-base-content/50") Включая НДС

        .stock-section.text-right
          .inline-flex.items-center.gap-2.px-3.py-1.rounded-full.text-xs.font-medium(
            :class="product.inStock ? 'bg-success/10 text-success' : 'bg-error/10 text-error'"
          )
            span.size-2.rounded-full(:class="product.inStock ? 'bg-success' : 'bg-error'")
            span(v-if="product.inStock") В наличии
            span(v-else) Нет в наличии

          .text-xs.mt-1(
            v-if="product.inStock && product.stockQuantity"
            class="text-base-content/50"
          ) Осталось: {{ product.stockQuantity }} шт.

      //- Десктопная кнопка
      .hidden(class="lg:block" :class="isInCart ? 'b' : ''")
        button.btn.w-full.btn-lg.rounded-xl.border-0(
          :disabled="!product.inStock || isInCart"
          @click="$emit('add-to-cart')"
          :class="isInCart ? 'btn-success text-success-content' : 'btn-primary'"
        )
          span.flex.items-center.justify-center.gap-2.w-full
            span
              span(v-if="isInCart") Товар уже в корзине
              span(v-else-if="product.inStock") Добавить в корзину
              span(v-else) Товар закончился
            span.font-normal.opacity-80(v-if="!isInCart && product.inStock") · {{ formatPrice(product.price) }}

      //- Характеристики
      .rounded-2xl.border.border-base-300.overflow-hidden
        details.group
          summary.cursor-pointer.list-none.px-4.py-3.text-sm.font-medium.flex.items-center.justify-between
            span Характеристики
            svg.w-4.h-4.transition-transform(
              class="text-base-content/40 group-open:rotate-180"
              xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"
            )
              path(stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7")
          .px-4.pb-4.pt-0.space-y-0.text-sm.border-t.border-base-300
            .flex.justify-between.py-2
              span(class="text-base-content/50") Категории
              span.font-medium.text-right {{ product.categories?.join(', ') }}
            .flex.justify-between.py-2.border-t.border-base-200
              span(class="text-base-content/50") Код товара
              span.font-medium {{ product.id }}
            .flex.justify-between.py-2.border-t.border-base-200
              span(class="text-base-content/50") Статус
              span.font-medium(
                :class="product.inStock ? 'text-success' : 'text-error'"
              ) {{ product.inStock ? 'Доступен' : 'Недоступен' }}
            .flex.justify-between.py-2.border-t.border-base-200
              span(class="text-base-content/50") Дата добавления
              span.font-medium {{ formatDate(product.createdAt) }}
</template>

<script setup>
const props = defineProps({
  product: { type: Object, required: true },
  isInCart: { type: Boolean, default: false },
  isFavorite: { type: Boolean, default: false }
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

details > summary::-webkit-details-marker {
  display: none;
}

details[open] summary svg {
  transform: rotate(180deg);
}

details summary svg {
  transition: transform var(--transition-base, 0.25s);
}
</style>