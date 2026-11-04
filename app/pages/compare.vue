<!-- app/pages/compare.vue — сравнение товаров (№9 из аудита).
     Данные — снапшоты useCompare (localStorage): страница не ходит в сеть,
     таблица собирается из характеристик, цены и рейтинга, снятых в момент
     добавления. Рендер только на клиенте (ClientOnly) — на SSR localStorage
     недоступен, иначе hydration mismatch. -->
<template lang="pug">
.compare-page.min-h-screen.bg-base-100.flex.flex-col
  Header

  main.flex-1.flex.flex-col.max-w-7xl.w-full.mx-auto.px-3.py-4(class="lg:px-6 lg:py-8")
    nav.breadcrumbs.text-sm.mb-3(:aria-label="$t('catalog.breadcrumbs')")
      ul
        li
          NuxtLink(class="text-base-content/60 hover:text-primary" :to="$localePath('/')" prefetch) {{ $t('nav.home') }}
        li {{ $t('compare.title') }}

    .flex.items-center.justify-between.gap-2.flex-wrap.mb-4(class="lg:mb-6")
      div
        h1.text-2xl.font-semibold.text-base-content(class="lg:text-3xl") {{ $t('compare.title') }}
        p.text-sm.mt-1(class="text-base-content/50")
          | {{ $t('compare.count', { n: compareCount }) }}

      ClientOnly
        //- Красный деструктив — единый стиль с корзиной/избранным (аудит F14)
        button.btn.btn-ghost.btn-sm.rounded-xl.text-error(
          v-if="compareCount > 0"
          type="button"
          class="hover:bg-error/10"
          @click="clearAll"
        ) {{ $t('compare.clearAll') }}

    //- Таблица / пусто / скелетон — только клиент
    ClientOnly
      //- Достаточно товаров: таблица
      .compare-scroll.overflow-x-auto(v-if="compareCount >= 2")
        table.compare-table
          thead
            tr
              th.corner(aria-hidden="true")
              td.cell(v-for="p in compareProducts" :key="p.id")
                .flex.flex-col.gap-2
                  .relative
                    button.remove-btn(
                      type="button"
                      :aria-label="$t('compare.removeAria', { name: p.name })"
                      @click="removeOne(p.id)"
                    ) ✕
                    NuxtLink.block(:to="productUrl(p)" prefetch)
                      NuxtImg.compare-img(:src="resolveImage(p.image)" :alt="p.name" loading="lazy" width="120" height="120")
                  NuxtLink.name-link.text-sm.font-semibold.leading-snug(:to="productUrl(p)" prefetch)
                    | {{ p.name }}
          tbody
            tr
              th(scope="row") {{ $t('compare.price') }}
              td.cell(v-for="p in compareProducts" :key="p.id")
                span.font-semibold(v-if="p.inStock") {{ formatPrice(p.price) }}
                span.text-error.text-xs(v-else) {{ $t('product.outOfStock') }}
            tr(v-if="hasRatings")
              th(scope="row") {{ $t('compare.rating') }}
              td.cell(v-for="p in compareProducts" :key="p.id")
                span.inline-flex.items-center.gap-1(v-if="p.rating && p.rating.count > 0")
                  span.text-warning(aria-hidden="true") ★
                  span.font-medium {{ formatAverage(p.rating.average) }}
                  span.text-xs(class="text-base-content/50") · {{ $t('reviews.count', p.rating.count) }}
                span(v-else class="text-base-content/40") —
            tr
              th(scope="row") {{ $t('compare.stock') }}
              td.cell(v-for="p in compareProducts" :key="p.id")
                span.badge.badge-sm(v-if="p.inStock" class="badge-success") {{ $t('product.inStock') }}
                span.badge.badge-sm(v-else class="badge-error") {{ $t('product.outOfStock') }}
            tr(v-if="hasCategories")
              th(scope="row") {{ $t('catalog.categories') }}
              td.cell(v-for="p in compareProducts" :key="p.id")
                span.text-xs(class="text-base-content/70") {{ (p.categories || []).join(', ') || '—' }}
            tr(v-for="key in characteristicKeys" :key="key")
              th(scope="row") {{ key }}
              td.cell(v-for="p in compareProducts" :key="p.id")
                | {{ p.characteristics?.[key] || '—' }}

      //- Один товар — приглашение добавить
      .one-item(v-else-if="compareCount === 1")
        .card.bg-base-100.shadow-sm
          .card-body.items-center.text-center.p-6.gap-3
            p.text-sm(class="text-base-content/70") {{ $t('compare.addMore') }}
            NuxtLink.btn.btn-outline.btn-sm.rounded-xl(:to="$localePath('/')" prefetch) {{ $t('cart.goCatalog') }}

      //- Пусто
      .text-center.py-20.flex.flex-col.items-center(v-else)
        .size-18.rounded-full.flex.items-center.justify-center.mb-5(class="bg-base-200 text-base-content/65")
          svg(width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5")
            path(stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4")
        h2.text-lg.font-semibold.text-base-content {{ $t('compare.empty') }}
        p.text-sm.mb-5.max-w-sm.mx-auto(class="text-base-content/65") {{ $t('compare.emptyHint', { n: 4 }) }}
        NuxtLink.btn.btn-primary.rounded-xl(:to="$localePath('/')" prefetch) {{ $t('cart.goCatalog') }}

      template(#fallback)
        .skeleton.h-72.rounded-2xl

  //- Десктопный футер (аудит F16); на мобиле навигацию держит нижнее меню
  SiteFooter

  MobileNavFooter
</template>

<script setup>
const { t, locale } = useI18n()
const localePath = useLocalePath()
const { $notify } = useNuxtApp()

const { compareProducts, compareCount, removeCompare, clearCompare } = useCompare()

const productUrl = (p) => (p?.slug ? localePath(`/product/${p.slug}`) : localePath('/'))

/* Объединение характеристик: все ключи, что встречаются хотя бы у одного
   товара, в порядке первого появления. Пустые значения рисуем «—». */
const characteristicKeys = computed(() => {
  const keys = []
  for (const p of compareProducts.value) {
    for (const k of Object.keys(p?.characteristics ?? {})) {
      if (!keys.includes(k)) keys.push(k)
    }
  }
  return keys
})

const hasRatings = computed(() =>
  compareProducts.value.some((p) => p?.rating && p.rating.count > 0),
)
const hasCategories = computed(() =>
  compareProducts.value.some((p) => Array.isArray(p?.categories) && p.categories.length > 0),
)

const formatPrice = (price) => new Intl.NumberFormat('ru-RU').format(price || 0)
const formatAverage = (avg) =>
  new Intl.NumberFormat(locale.value, { maximumFractionDigits: 1 }).format(avg || 0)

/* Разрешение картинки — лёгкая версия карточной (data:/http:/ — как есть). */
const resolveImage = (url) => {
  if (!url || url === 'null' || url === 'undefined') return null
  if (url.startsWith('data:') || url.startsWith('http') || url.startsWith('/')) return url
  return `/images/${url}`
}

const removeOne = (id) => {
  removeCompare(id)
  $notify.success(t('compare.removed'))
}

const clearAll = () => {
  clearCompare()
  $notify.success(t('compare.cleared'))
}

useHead(() => ({ title: t('compare.title') }))
useSeoMeta({
  title: () => t('compare.title'),
  description: () => t('compare.metaDescription'),
  robots: 'noindex, follow', // служебная страница без поисковой ценности
})
</script>

<style scoped>
.compare-table {
  width: 100%;
  min-width: 640px;
  border-collapse: separate;
  border-spacing: 0;
}

.compare-table th[scope='row'],
.compare-table .corner {
  position: sticky;
  left: 0;
  z-index: 1;
  background: var(--color-base-100);
  text-align: left;
  font-weight: 500;
  font-size: 0.8125rem;
  color: var(--color-base-content);
  opacity: 0.65;
  padding: 0.75rem 1rem 0.75rem 0.25rem;
  vertical-align: middle;
  white-space: nowrap;
}

.cell {
  min-width: 9.5rem;
  max-width: 12rem;
  padding: 0.75rem;
  border-left: 1px solid var(--color-base-200);
  vertical-align: top;
  font-size: 0.875rem;
}

.compare-img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 0.875rem;
  background: var(--color-base-200);
}

.remove-btn {
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 9999px;
  border: 1px solid var(--color-base-300);
  background: var(--color-base-100);
  color: var(--color-base-content);
  font-size: 0.75rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}

@media (hover: hover) {
  .remove-btn:hover {
    border-color: var(--color-error);
    color: var(--color-error);
  }
}

.name-link {
  color: var(--color-base-content);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (hover: hover) {
  .name-link:hover {
    color: var(--color-primary);
  }
}

.one-item {
  max-width: 28rem;
  margin: 0 auto;
}
</style>
