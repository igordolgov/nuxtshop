<!-- app/components/products/ProductCardSkeleton.vue — скелетон карточки товара.
    Два варианта геометрии под реальные карточки:
      'grid' — ProductCardGrid: квадратное изображение, 2 строки названия,
              2 строки описания, цена;
      'list' — ProductCardList: горизонтальная карточка, квадрат 96px слева,
              название/описание/бейджи справа.
    Подмена скелетона реальной карточкой не даёт layout-shift.
    Анимация shimmer — глобальный .skeleton из main.css
    (prefers-reduced-motion гасится там же автоматически).
    aria-hidden: скелетон — декорация для скринридеров. -->
<template lang="pug">
//- ─── Вариант GRID (десктоп): повторяет ProductCardGrid ────
.card.product-card.p-0.bg-base-100.rounded-2xl.border.overflow-hidden(
  v-if="variant === 'grid'"
  aria-hidden="true"
  class="border-base-300"
)
  .relative.w-full.aspect-square.overflow-hidden.bg-base-200
    .skeleton.absolute.inset-0
  .p-3.gap-1.flex.flex-col
    //- Название: 2 строки (вторая короче — как реальный line-clamp-2)
    .skeleton(class="rounded w-full h-4")
    .skeleton(class="rounded w-3/4 h-4")
    //- Описание: 2 строки
    .skeleton.mt-1(class="rounded w-full h-3")
    .skeleton(class="rounded w-5/6 h-3")
    //- Цена
    .flex.items-center.justify-between.pt-2
      .skeleton(class="rounded w-20 h-5")
      .skeleton(class="rounded-full w-8 h-8")

//- ─── Вариант LIST (мобильные): повторяет ProductCardList ──
.card.product-card.bg-base-100.rounded-xl.border.overflow-hidden(
  v-else
  aria-hidden="true"
  class="border-base-300"
)
  .flex.p-2.gap-3.items-start
    //- Квадрат изображения (w-24 = 96px, как figure в ProductCardList)
    .skeleton.w-20.h-20.rounded-xl.flex-shrink-0(class="sm:w-24 sm:h-24")
    .flex-1.min-w-0.gap-2.flex.flex-col
      //- Название
      .skeleton(class="rounded w-3/4 h-4")
      //- Описание (в реальной карточке line-clamp-3)
      .skeleton(class="rounded w-full h-3")
      .skeleton(class="rounded w-5/6 h-3")
      //- Бейджи категорий
      .flex.gap-1
        .skeleton(class="rounded-full w-12 h-4")
        .skeleton(class="rounded-full w-16 h-4")
</template>

<script setup>
/**
 * Скелетон карточки товара.
 * @prop {('grid'|'list')} variant — геометрия под соответствующую карточку
 */
defineProps({
  variant: {
    type: String,
    default: 'grid',
  },
})
</script>