<!-- app/components/products/ProductCardSkeleton.vue — скелетон карточки товара.
    Геометрия — ТОЧНЫЙ слепок ProductCardGrid (единственной реальной
    карточки каталога: и на десктопе, и на телефоне сетка рендерит её,
    бывшая мобильная «списочная» карточка удалена — скелетон-вариант
    'list' повторял несуществующую карточку и давал прыжок при подмене):
      квадратное изображение (aspect-square, bg-base-200) →
      название 2 строки (зона ровно min-h-9/lg:min-h-10) →
      описание 2 строки → цена + бейдж (как плашка скидки).
    Подмена скелетона реальной карточкой не даёт layout-shift: ширины
    слотов задает одна и та же сетка .products-grid.
    Класс-хук skeleton-card: ProductsSection по нему меряет, доехал ли
    пользователь до призраков догрузки (удержание вместо слепого таймера).
    Анимация shimmer — глобальный .skeleton из main.css
    (prefers-reduced-motion гасится там же автоматически).
    aria-hidden: скелетон — декорация для скринридеров. -->
<template lang="pug">
.card.product-card.skeleton-card.p-0.bg-base-100.rounded-2xl.border.overflow-hidden(
  aria-hidden="true"
  class="border-base-300"
)
  //- Изображение: квадрат, как .image-container реальной карточки
  .relative.w-full.aspect-square.overflow-hidden.bg-base-200
    .skeleton.absolute.inset-0

  //- Тело: название (зона min-h-9/lg:min-h-10 — ровно как line-clamp-2
  //- у h2) и описание (2 строки; на lg реальный p — text-sm
  //- с leading-snug ≈ 19-20px на строку → h-5, на мобиле text-xs → h-4)
  .card-body.p-3.gap-y-1
    .min-h-9.flex.flex-col.justify-center.gap-1(class="lg:min-h-10")
      .skeleton(class="rounded w-full h-4")
      .skeleton(class="rounded w-3/4 h-4")
    .skeleton(class="rounded w-full h-4 lg:h-5")
    .skeleton(class="rounded w-5/6 h-4 lg:h-5")

  //- Цена (text-base/lg:text-lg → строка 24px/28px) + призрак бейджа
  //- скидки справа: у карточек без скидки строка той же высоты — сдвига нет
  .card-actions.flex.items-center.justify-between.gap-2.px-3.pb-3.pt-1
    .skeleton(class="rounded w-20 h-6 lg:h-7")
    .skeleton(class="rounded-md w-10 h-5")
</template>
