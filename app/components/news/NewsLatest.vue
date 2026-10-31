<!-- components/news/NewsLatest.vue — блок «Последние новости» на главной.
     Данные — GET /api/news (KV data:news), уже отсортированы свежие
     сверху; берём первые 3. SSR: useAsyncData отрабатывает на сервере,
     тизеры попадают в HTML и payload без мигания. Пустой ответ или
     ошибка API — блок просто не рендерится (главная не ломается).
     Клик по карточке — /news?news=<id>: витрина открывает эту новость
     в модалке. Мобайл — горизонтальная лента со snap (паттерн WB/Ozon),
     md+ — сетка в 3 колонки. -->
<template lang="pug">
section.home-news(v-if="items.length" aria-labelledby="home-news-title")
  //- Шапка блока
  .home-news-head
    h2#home-news-title.text-lg.font-semibold.text-base-content(class="lg:text-xl") Последние новости
    NuxtLink.all-link(to="/news" prefetch)
      | Все новости
      svg(width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true")
        path(d="M5 12h14m-6-6l6 6-6 6")

  //- Мобайл: горизонтальная лента со snap-прокруткой
  .news-strip
    NuxtLink.news-card(
      v-for="item in items"
      :key="item.id"
      :to="`/news?news=${item.id}`"
      :aria-label="item.title"
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
            path(:d="newsPlaceholderIcon(item.category)")
      .card-body
        .flex.items-center.gap-2.flex-wrap.mb-1
          span.badge-chip(:class="`chip-${newsTone(item.category)}`") {{ item.category }}
          span.news-date {{ formatNewsDate(item.date) }}
        h3.news-title {{ item.title }}

  //- Ссылка «Все новости» под лентой — на мобиле шапка скроллится
  //- вместе с заголовком, дублируем CTA в конце (только <md)
  .home-news-foot
    NuxtLink.all-link(to="/news" prefetch)
      | Все новости
      svg(width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true")
        path(d="M5 12h14m-6-6l6 6-6 6")
</template>

<script setup lang="ts">
import type { NewsItem } from '~/utils/news'

// SSR: сервер вызывает внутренний роут /api/news (сид при пустом KV)
// и кладёт тизеры в payload — гидратация рендерит их сразу.
const { data } = await useAsyncData('news-latest', () =>
  $fetch<{ success: boolean; news: NewsItem[] }>('/api/news'),
)

const items = computed<NewsItem[]>(() => (data.value?.news ?? []).slice(0, 3))
</script>

<style scoped>
/* ─── Блок на главной ────────────────────────────────────────── */
.home-news {
  margin-top: 0.5rem;
  /* Выравнивание по строке-пилюле каталога (у SortBar padding 0 4px) */
  padding: 0 4px;
  min-width: 0;
  /* Критично: мы — flex-элемент колонки products-container, и без
     inline-size-контейнмента intrinsic min-content ленты (~3×220px)
     распирает всю цепочку контейнеров главной до ~690px — мобильная
     сетка каталога расходится (карточки товаров 342px вместо 171px).
     contain: inline-size исключает содержимое из intrinsic-расчёта
     ширины: вклад блока в min-content родителя всегда 0, лента
     скроллится внутри своей ширины */
  contain: inline-size;
}

.home-news-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0 0.75rem;
}

.all-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
  color: var(--color-primary);
  font-size: 0.875rem;
  font-weight: 600;
}

/* ─── Лента карточек ─────────────────────────────────────────── */
.news-strip {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  /* Хвостовая прокрутка: карточка не упирается в край контейнера */
  padding-bottom: 0.25rem;
  scrollbar-width: none;
}

.news-strip::-webkit-scrollbar {
  display: none;
}

.news-card {
  flex: 0 0 220px;
  scroll-snap-align: start;
  background: var(--color-base-100);
  border: 1px solid var(--color-base-300);
  border-radius: 1rem;
  overflow: hidden;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

@media (hover: hover) {
  .news-card:hover {
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.08);
    transform: translateY(-2px);
  }
}

/* md+: сетка в 3 колонки вместо ленты */
@media (min-width: 768px) {
  .news-strip {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    overflow: visible;
  }
}

@media (min-width: 1024px) {
  .news-strip {
    gap: 1.5rem;
  }
}

/* ─── Медиа карточки ─────────────────────────────────────────── */
.card-media {
  aspect-ratio: 4 / 3;
  overflow: hidden;
}

.card-media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Плитка без фото: градиент + иконка по рубрике (код, без ассетов) */
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

/* ─── Тело карточки ──────────────────────────────────────────── */
.card-body {
  padding: 0.75rem 1rem 1rem;
}

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

.news-date {
  font-size: 0.75rem;
  color: var(--color-base-content);
  opacity: 0.5;
}

.news-title {
  font-weight: 600;
  color: var(--color-base-content);
  /* Две строки — карточки в ленте остаются одной высоты */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ─── CTA под лентой (только мобайл) ─────────────────────────── */
.home-news-foot {
  display: flex;
  justify-content: center;
  padding: 0.875rem 0 0.25rem;
}

/* Скрываем на md+: scoped-стили идут после утилит Tailwind,
   поэтому класс md:hidden перебивался display:flex выше */
@media (min-width: 768px) {
  .home-news-foot {
    display: none;
  }
}
</style>
