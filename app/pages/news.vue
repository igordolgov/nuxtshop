<!-- app/pages/news.vue — страница «Новости и акции».
     Данные — сервер (KV `data:news` через GET /api/news), при пустом
     хранилище API отдаёт сид. Редактирование — админка /admin/news.
     Лента в стиле витрин крупных магазинов: featured-карточка + сетка,
     фильтр по категориям, полная новость в модальном окне.
     Фото — реальные товары каталога (small 400×300 в карточках,
     full 800×600 в модалке). -->
<template lang="pug">
.news-page.min-h-screen.bg-base-100.flex.flex-col.mobile-nav-safe
  Header

  main.flex-1.flex.flex-col.max-w-7xl.w-full.mx-auto.px-3.py-4(class="lg:px-6 lg:py-8")
    //- Хлебные крошки
    nav.breadcrumbs.text-sm.mb-3(aria-label="Хлебные крошки")
      ul
        li
          NuxtLink(class="text-base-content/60 hover:text-primary" to="/" prefetch) Главная
        li Новости и акции

    //- Заголовок
    .mb-5(class="lg:mb-8")
      h1.text-2xl.font-semibold.text-base-content(class="lg:text-3xl") Новости и акции
      p.text-sm.mt-1(class="text-base-content/50 lg:text-base")
        | Скидки, новинки каталога и события магазина — всё самое свежее.

    //- Скелетон первой загрузки
    template(v-if="pending && !items.length")
      .skeleton.h-8.w-72.mb-5.round-lg
      .skeleton.h-56.rounded-2xl.mb-4
      .grid.grid-cols-1.gap-4(class="sm:grid-cols-2 lg:grid-cols-3 lg:gap-6")
        .skeleton.h-72.rounded-2xl(v-for="i in 3" :key="i")

    //- Ошибка загрузки
    .text-center.py-16.flex.flex-col.items-center(v-else-if="error")
      p.text-base-content/50.mb-4 Не удалось загрузить новости
      button.btn.btn-primary.rounded-xl(type="button" @click="refresh()") Повторить

    template(v-else)
      //- Фильтр по категориям
      .flex.gap-2.overflow-x-auto.pb-1.mb-5(class="lg:mb-6 lg:flex-wrap" role="tablist" aria-label="Фильтр новостей")
        button.chip(
          v-for="cat in categories"
          :key="cat"
          type="button"
          role="tab"
          :aria-selected="activeCategory === cat"
          :class="{ 'chip-active': activeCategory === cat }"
          @click="activeCategory = cat"
        ) {{ cat }}

      //- Featured — первая новость подборки
      article.news-card.news-featured.mb-4(
        v-if="featuredNews"
        class="lg:mb-6"
        @click="openNews(featuredNews)"
      )
        .featured-media
          img(
            v-if="featuredNews.image"
            :src="featuredNews.image"
            :srcset="`${featuredNews.image.replace('/products/', '/products/small/')} 400w, ${featuredNews.image} 800w`"
            sizes="(min-width: 1024px) 560px, 100vw"
            width="800" height="600"
            :alt="featuredNews.title"
            loading="eager"
          )
          .media-placeholder(v-else :class="`placeholder-${newsTone(featuredNews.category)}`")
            svg(width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true")
              path(:d="placeholderIcon(featuredNews.category)")
        .featured-body
          .flex.items-center.gap-2.flex-wrap.mb-2
            span.badge-chip(:class="`chip-${newsTone(featuredNews.category)}`") {{ featuredNews.category }}
            span.text-xs(class="text-base-content/50") {{ formatNewsDate(featuredNews.date) }}
          h2.text-lg.font-semibold.text-base-content(class="lg:text-2xl") {{ featuredNews.title }}
          p.text-sm.mt-2(class="text-base-content/60 lg:text-base") {{ featuredNews.excerpt }}
          span.read-more Читать
            svg(width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true")
              path(d="M5 12h14m-6-6l6 6-6 6")

      //- Сетка остальных новостей
      .grid.grid-cols-1.gap-4(class="sm:grid-cols-2 lg:grid-cols-3 lg:gap-6")
        article.news-card(
          v-for="item in restNews"
          :key="item.id"
          @click="openNews(item)"
        )
          .card-media
            img(
              v-if="item.image"
              :src="item.image.replace('/products/', '/products/small/')"
              width="400" height="300"
              :alt="item.title"
              loading="lazy"
            )
            .media-placeholder(v-else :class="`placeholder-${newsTone(item.category)}`")
              svg(width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true")
                path(:d="placeholderIcon(item.category)")
          .card-body
            .flex.items-center.gap-2.flex-wrap.mb-2
              span.badge-chip(:class="`chip-${newsTone(item.category)}`") {{ item.category }}
              span.text-xs(class="text-base-content/50") {{ formatNewsDate(item.date) }}
            h3.font-semibold.text-base-content(class="line-clamp-2") {{ item.title }}
            p.text-sm.mt-1(class="text-base-content/50 line-clamp-2") {{ item.excerpt }}
            span.read-more Читать
              svg(width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true")
                path(d="M5 12h14m-6-6l6 6-6 6")

      //- Пустое состояние фильтра
      .text-center.py-16(v-if="filteredNews.length === 0")
        p(class="text-base-content/50") В этой рубрике пока пусто — загляните позже.

      //- CTA в контакты
      .cta-band.mt-8(class="lg:mt-12")
        .cta-inner
          div
            h3.text-lg.font-semibold.text-base-content Следите за скидками
            p.text-sm.mt-1(class="text-base-content/60") Вопросы об акции и доставке? Мы на связи каждый день.
          NuxtLink.btn.btn-primary.rounded-xl(to="/contacts" prefetch) Связаться с нами

    //- Модальное окно с полным текстом новости
    .modal(:class="{ 'modal-open': activeNews }" role="dialog" aria-modal="true" @click.self="closeNews")
      .modal-box.max-w-2xl.p-0.overflow-hidden
        figure(v-if="activeNews && activeNews.image")
          img.w-full(
            :src="activeNews.image"
            width="800" height="600"
            :alt="activeNews.title"
          )
        .p-5(class="lg:p-8")
          .flex.items-center.gap-2.flex-wrap.mb-3(v-if="activeNews")
            span.badge-chip(:class="`chip-${newsTone(activeNews.category)}`") {{ activeNews.category }}
            span.text-sm(class="text-base-content/50") {{ formatNewsDate(activeNews.date) }}
          h3.text-xl.font-semibold.text-base-content.mb-4(class="lg:text-2xl") {{ activeNews?.title }}
          template(v-if="activeNews")
            p.text-base.leading-relaxed.mb-3(
              v-for="(para, i) in activeNews.body"
              :key="i"
              class="text-base-content/80"
            ) {{ para }}

            //- Товары из новости (перелинковка с каталогом): джойн на
            //- сервере, карточка ведёт на страницу товара
            .news-products(v-if="activeNews.products?.length")
              h4.news-products-title Товары из новости
              .news-products-grid
                NuxtLink.news-product(
                  v-for="p in activeNews.products"
                  :key="p.id"
                  :to="`/product/${p.id}`"
                )
                  .np-media
                    img(
                      :src="productImgSmall(p.image)"
                      width="400" height="300"
                      :alt="p.name"
                      loading="lazy"
                      @error="onProductImgError($event, p.image)"
                    )
                  .np-body
                    .np-name {{ p.name }}
                    .np-meta
                      span.np-price {{ formatPrice(p.price) }} ₽
                      span.np-stock(v-if="!p.inStock") Нет в наличии
                  span.np-link Перейти
                    svg(width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true")
                      path(d="M5 12h14m-6-6l6 6-6 6")

          .modal-action
            button.btn.rounded-xl(type="button" @click="closeNews") Закрыть

  MobileNavFooter(v-if="isMobile")
</template>

<script setup lang="ts">
import type { NewsWithProducts } from '~/utils/news'

const { isMobile } = useMobileDetection()
const route = useRoute()
const router = useRouter()
const { formatPrice, getSafeImage } = useProductUtils()

// ─── Данные: сервер (KV) вместо статичного массива ───────────────────────
// SSR: useAsyncData выполняется на сервере (внутренний вызов роута),
// клиент получает готовый payload — без мигания и лишнего запроса.
const {
  data: newsData,
  pending,
  error,
  refresh,
} = await useAsyncData('news-list', () => $fetch<{ success: boolean; news: NewsWithProducts[] }>('/api/news'))

const items = computed<NewsWithProducts[]>(() => newsData.value?.news ?? [])

const categories = ['Все', 'Акции', 'Новинки', 'Компания', 'Обзоры']
const activeCategory = ref('Все')

const filteredNews = computed<NewsWithProducts[]>(() =>
  activeCategory.value === 'Все'
    ? items.value
    : items.value.filter((n) => n.category === activeCategory.value)
)

const featuredNews = computed(() => filteredNews.value[0] || null)
const restNews = computed(() => filteredNews.value.slice(1))

// Иконка плитки без фото — по рубрике (общий хелпер app/utils/news.ts,
// используется и блоком «Последние новости» на главной)
const placeholderIcon = newsPlaceholderIcon

// Мини-карточка товара: small-вариант фото, при 404 — полноразмерный
// (у части товаров small-версии нет). Фолбэк через @error
const productImg = (image: string) => getSafeImage(image)
const productImgSmall = (image: string) =>
  getSafeImage(image.replace('/products/', '/products/small/'))
const onProductImgError = (e: Event, image: string) => {
  const el = e.target as HTMLImageElement
  if (el && el.src !== productImg(image)) el.src = productImg(image)
}

const activeNews = ref<NewsWithProducts | null>(null)
const openNews = (item: NewsWithProducts) => {
  activeNews.value = item
}
const closeNews = () => {
  activeNews.value = null
}

//- Диплинк с главной: карточка блока «Последние новости» ведёт на
//- /news?news=<id> — открываем эту новость в модалке сразу после
//- загрузки данных. Только на клиенте (после гидратации), затем
//- убираем ?news из URL — перезагрузка не переоткрывает модалку
onMounted(() => {
  const id = route.query.news
  if (!id) return
  const found = items.value.find((n) => n.id === String(id))
  if (found) openNews(found)
  router.replace({ query: { ...route.query, news: undefined } })
})

useHead({ title: 'Новости и акции' })
useSeoMeta({
  title: 'Новости и акции',
  description:
    'Скидки, новинки каталога и события магазина: акции на смартфоны и ноутбуки, обзоры техники, новые пункты выдачи.',
})
</script>

<style scoped>
/* ─── Фильтр-чипы ─────────────────────────────────────────── */
.chip {
  flex-shrink: 0;
  padding: 0.375rem 1rem;
  border-radius: 9999px;
  border: 1px solid var(--color-base-300);
  background: var(--color-base-100);
  color: var(--color-base-content);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

@media (hover: hover) {
  .chip:hover {
    border-color: color-mix(in oklab, var(--color-primary) 45%, transparent);
  }
}

.chip-active {
  border-color: var(--color-primary);
  background: color-mix(in oklab, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
  font-weight: 600;
}

/* ─── Категорийные бейджи (тонкие тинты, согласованы с темой) ── */
.badge-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.25rem;
}

.chip-sale {
  background: color-mix(in oklab, var(--color-error) 12%, transparent);
  color: var(--color-error);
}

.chip-new {
  background: color-mix(in oklab, var(--color-success) 14%, transparent);
  color: var(--color-success);
}

.chip-company {
  background: color-mix(in oklab, var(--color-info) 14%, transparent);
  color: var(--color-info);
}

.chip-review {
  background: color-mix(in oklab, var(--color-secondary) 14%, transparent);
  color: var(--color-secondary);
}

/* ─── Карточки новостей ───────────────────────────────────── */
.news-card {
  background: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  border-radius: 1rem;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

@media (hover: hover) {
  .news-card:hover {
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.08);
    transform: translateY(-2px);
  }
}

.card-media img,
.featured-media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-media {
  aspect-ratio: 4 / 3;
  overflow: hidden;
}

.featured-media {
  aspect-ratio: 16 / 10;
  overflow: hidden;
}

/* Плитка без фото: градиент + иконка (код, без ассетов) */
.media-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.85;
}

.placeholder-company {
  background: linear-gradient(135deg,
    color-mix(in oklab, var(--color-info) 22%, var(--color-base-100)),
    color-mix(in oklab, var(--color-info) 45%, var(--color-base-100)));
  color: var(--color-info);
}

.placeholder-sale {
  background: linear-gradient(135deg,
    color-mix(in oklab, var(--color-error) 18%, var(--color-base-100)),
    color-mix(in oklab, var(--color-error) 40%, var(--color-base-100)));
  color: var(--color-error);
}

.placeholder-new {
  background: linear-gradient(135deg,
    color-mix(in oklab, var(--color-success) 18%, var(--color-base-100)),
    color-mix(in oklab, var(--color-success) 40%, var(--color-base-100)));
  color: var(--color-success);
}

.placeholder-review {
  background: linear-gradient(135deg,
    color-mix(in oklab, var(--color-secondary) 18%, var(--color-base-100)),
    color-mix(in oklab, var(--color-secondary) 40%, var(--color-base-100)));
  color: var(--color-secondary);
}

/* ─── Featured-карточка: на md+ фото слева, текст справа ──── */
@media (min-width: 768px) {
  .news-featured {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  }

  .featured-body {
    padding: 1.5rem 2rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
}

.featured-body {
  padding: 1rem 1.25rem;
}

.card-body {
  padding: 1rem 1.25rem 1.25rem;
}

.read-more {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.75rem;
  color: var(--color-primary);
  font-size: 0.875rem;
  font-weight: 600;
}

/* ─── Товары из новости (модалка) ─────────────────────────── */
.news-products {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-base-300);
}

.news-products-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-base-content);
  margin-bottom: 0.75rem;
}

.news-products-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

@media (min-width: 640px) {
  .news-products-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.news-product {
  display: flex;
  flex-direction: column;
  background: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  border-radius: 0.875rem;
  overflow: hidden;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

@media (hover: hover) {
  .news-product:hover {
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.08);
    transform: translateY(-2px);
  }
}

.np-media {
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--color-base-200);
}

.np-media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.np-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 0.25rem;
  padding: 0.625rem 0.75rem 0.75rem;
}

.np-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-base-content);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.np-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: auto;
}

.np-price {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-primary);
}

.np-stock {
  font-size: 0.6875rem;
  color: var(--color-error);
}

.np-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-primary);
}

/* ─── CTA-плашка ──────────────────────────────────────────── */
.cta-band {
  border-radius: 1.25rem;
  background: linear-gradient(120deg,
    color-mix(in oklab, var(--color-primary) 14%, var(--color-base-100)),
    color-mix(in oklab, var(--color-primary) 4%, var(--color-base-100)));
  border: 1px solid color-mix(in oklab, var(--color-primary) 20%, transparent);
}

.cta-inner {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
}

@media (min-width: 640px) {
  .cta-inner {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 2rem;
  }
}
</style>
