<!-- app/components/products/ProductImageActions.vue -->
<!-- ============================================
  Компонент: ProductImageActions
  Назначение: действия товара ПОВЕРХ фото галереи (как в WB/Ozon):
  поиск, шаринг, сравнение, избранное — полупрозрачные круги ЦВЕТА
  ПОВЕРХНОСТИ темы с блюром и тенью в правом верхнем углу зоны галереи
  (светлая тема — светлые круги, тёмная — тёмные: как карточки блока
  «Похожие товары», bg-base-100).
  Размещение: внутри .image-wrapper (position:relative) — свободный
  угол: стрелки листания по центру боков, зум/точки/счётчик снизу.
  Props: product, isFavorite
  Emits: open-search, toggle-favorite
  Клики не должны доходить до слайдера (свайп-жесты контейнера):
  stop на mousedown/touchstart/click — иначе тап по кнопке стартует
  трекинг свайпа (useGallerySlider слушает контейнер целиком).
  ClientOnly: isFavorite/isCompared из глобального state — SSR не
  знает их (гидратационный рассинхрон), кнопки появляются после
  гидратации (как раньше в ProductInfo).
============================================ -->
<template lang="pug">
ClientOnly
  .product-image-actions.flex.gap-2.absolute.top-2.right-2.z-30
    //- Тач-цель 36px (size-9, десктоп 40px) + тень: контраст на любом фото
    //- Иконки — ИНЛАЙН-SVG (не UnoCSS-маска .iconify): у маски толщина
    //- штриха зашита в data-URI и не поднимается CSS. Инлайн — контролируемый
    //- stroke-width="2" («пожирнее», отзыв)
    button.action-btn(
      type="button"
      :title="$t('catalog.search')"
      :aria-label="$t('catalog.search')"
      @click.stop="$emit('open-search')"
      @mousedown.stop
      @touchstart.stop
    )
      svg(class="w-[18px] h-[18px]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2")
        path(stroke-linecap="round" stroke-linejoin="round" d="m21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607")

    //- Шаринг: Web Share API на мобиле (нативный шер-шит), фолбэк —
    //- ссылка в буфер обмена + тост (AbortError — шит закрыли, молча)
    button.action-btn(
      type="button"
      :title="$t('product.share')"
      :aria-label="$t('product.share')"
      @click.stop="shareProduct"
      @mousedown.stop
      @touchstart.stop
    )
      svg(class="w-[18px] h-[18px]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2")
        path(stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186a2.25 2.25 0 0 0-3.935-2.186m0-12.814a2.25 2.25 0 1 0 3.933-2.185a2.25 2.25 0 0 0-3.933 2.185")

    button.action-btn(
      type="button"
      :class="{ 'is-active-compare': isComparedNow }"
      :title="$t('compare.toggleAria')"
      :aria-label="$t('compare.toggleAria')"
      @click.stop="onCompareClick"
      @mousedown.stop
      @touchstart.stop
    )
      svg(class="w-[18px] h-[18px]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2")
        path(stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5")

    //- Избранное: bg-heart (токен main.css) — глубокий красный на обеих
    //- темах; fav-pop — упругая анимация при добавлении (глобальный класс)
    button.action-btn(
      type="button"
      :class="{ 'is-heart': isFavorite, 'fav-pop': isFavorite }"
      :title="isFavorite ? $t('product.favRemove') : $t('product.favAdd')"
      :aria-label="isFavorite ? $t('product.favRemove') : $t('product.favAdd')"
      @click.stop="$emit('toggle-favorite')"
      @mousedown.stop
      @touchstart.stop
    )
      svg(class="w-[18px] h-[18px]" :class="isFavorite ? 'fill-current' : 'fill-none stroke-current'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="2")
        path(d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z")
</template>

<script setup>
// Шаринг/сравнение переехали из ProductInfo (ряд действий у заголовка)
// на фото — логика та же, позиция новая (отзыв: «как в маркетплейсах»)
const props = defineProps({
  product: { type: Object, required: true },
  isFavorite: { type: Boolean, default: false },
})

defineEmits(['open-search', 'toggle-favorite'])

const { $notify } = useNuxtApp()
const { t } = useI18n()

//- ── Сравнение + «синяя точка» к меню шапки (utils/compareFly.ts) ──────
const { isCompared, toggleCompare } = useCompare()
const isComparedNow = computed(() => isCompared(props.product.id))

const onCompareClick = (event) => {
  const status = toggleCompare(props.product)
  if (status === 'added') {
    $notify.success(t('compare.added'))
    emitCompareFly(event?.currentTarget)
  }
  if (status === 'full') $notify.warning(t('compare.limit', { n: 4 }))
}

//- ── Шаринг товара ──────────────────────────────────────────────────────
// Web Share API (мобильные — нативный шер-шит) — прямой канал трафика;
// AbortError — пользователь закрыл шер-шит, это не ошибка (тост не нужен).
// Десктоп без navigator.share — копируем ссылку в буфер обмена с тостом
const shareProduct = async () => {
  const url = window.location.href
  if (navigator.share) {
    try {
      await navigator.share({ title: props.product?.name || '', url })
      return
    } catch (error) {
      if (error?.name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    $notify.success(t('product.linkCopied'))
  } catch {
    $notify.error(t('product.linkCopyError'))
  }
}
</script>

<style scoped>
.action-btn {
  width: 2.25rem; /* 36px — тач-цель WCAG с учётом gap-2 между кнопками */
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  /* Круг ЦВЕТА ПОВЕРХНОСТИ ТЕМЫ (отзыв: «тёмные на тёмной теме, светлые
    на светлой — как у раздела Похожие товары», там карточки bg-base-100):
    corporate base-100 белый → светлый круг с тёмной иконкой (base-content
    тёмный), business base-100 тёмный → тёмный круг со светлой иконкой
    (base-content светлый). Фон полупрозрачный (55%) + блюр: фото
    просвечивает, снимок остаётся главным. color-mix — то же, во что
    Tailwind компилирует bg-base-100/55. Тонкая обводка цвета текста
    отделяет круг от совпадающего с ним по яркости участка снимка. */
  background-color: color-mix(in oklab, var(--color-base-100) 55%, transparent);
  color: var(--color-base-content);
  border: 1px solid color-mix(in oklab, var(--color-base-content) 16%, transparent);
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.25);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.15s ease;
}
/* Иконки пожирнее (отзыв): инлайн-SVG со stroke-width="2" на корне
   (у heroicons outline в маске UnoCSS толщина зашита в data-URI —
   поэтому все 4 иконки заменены на инлайн-SVG). Страховка: CSS на
   svg перебивал бы presentation-атрибут. */
.action-btn :deep(svg) {
  stroke-width: 2;
}
.action-btn:hover {
  background-color: color-mix(in oklab, var(--color-base-100) 80%, transparent);
  transform: scale(1.06);
}
.action-btn:active {
  transform: scale(0.94);
}
/* Активные состояния — ТОЛЬКО здесь (scoped-стили вне @layer перебили
   бы утилиты bg-heart/bg-primary — как с .badge подсветки), поэтому
   состояния — отдельные классы, а не утилиты в :class. Обводка —
   transparent: цветной круг чистый, без серой рамки. */
.action-btn.is-heart,
.action-btn.is-heart:hover {
  background-color: var(--color-heart);
  color: #fff;
  border-color: transparent;
}
.action-btn.is-active-compare,
.action-btn.is-active-compare:hover {
  background-color: var(--color-primary);
  color: var(--color-primary-content);
  border-color: transparent;
}
@media (min-width: 1024px) {
  .action-btn {
    width: 2.5rem; /* 40px — как было в ряду у заголовка */
    height: 2.5rem;
  }
}
</style>
