<!-- app/components/products/ProductImageActions.vue -->
<!-- ============================================
  Компонент: ProductImageActions
  Назначение: действия товара ПОВЕРХ фото галереи (как в WB/Ozon):
  поиск, шаринг, сравнение, избранное — белые полупрозрачные круги
  с тенью в правом верхнем углу зоны галереи.
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
    button.action-btn(
      type="button"
      :title="$t('catalog.search')"
      :aria-label="$t('catalog.search')"
      @click.stop="$emit('open-search')"
      @mousedown.stop
      @touchstart.stop
    )
      icon(name="heroicons:magnifying-glass" size="18")

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
      icon(name="heroicons:share" size="18")

    button.action-btn(
      type="button"
      :class="{ 'is-active-compare': isComparedNow }"
      :title="$t('compare.toggleAria')"
      :aria-label="$t('compare.toggleAria')"
      @click.stop="onCompareClick"
      @mousedown.stop
      @touchstart.stop
    )
      icon(name="heroicons:arrows-right-left" size="18")

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
      svg(class="w-[18px] h-[18px]" :class="isFavorite ? 'fill-current' : 'fill-none stroke-current'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.5")
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
  /* Белый полупрозрачный круг + блюр: читаем на любом фото (WB/Ozon),
    тень отделяет от светлых участков снимка; на тёмной теме — тот же
    белый: фон кнопки = фото, а не тема */
  background-color: rgb(255 255 255 / 0.9);
  color: var(--color-base-content);
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.25);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.15s ease;
}
.action-btn:hover {
  background-color: rgb(255 255 255 / 1);
  transform: scale(1.06);
}
.action-btn:active {
  transform: scale(0.94);
}
/* Активные состояния — ТОЛЬКО здесь (scoped-стили вне @layer перебили
   бы утилиты bg-heart/bg-primary — как с .badge подсветки), поэтому
   состояния — отдельные классы, а не утилиты в :class */
.action-btn.is-heart,
.action-btn.is-heart:hover {
  background-color: var(--color-heart);
  color: #fff;
}
.action-btn.is-active-compare,
.action-btn.is-active-compare:hover {
  background-color: var(--color-primary);
  color: var(--color-primary-content);
}
@media (min-width: 1024px) {
  .action-btn {
    width: 2.5rem; /* 40px — как было в ряду у заголовка */
    height: 2.5rem;
  }
}
</style>
