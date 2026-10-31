<!-- app/pages/news.vue — страница «Новости и акции».
     Лента в стиле витрин крупных магазинов: featured-карточка + сетка,
     фильтр по категориям, полная новость в модальном окне.
     Контент статический (SSR-friendly), фото — реальные товары каталога
     (small-варианты 400×300 в карточках, full 800×600 в модалке). -->
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
        .media-placeholder(v-else :class="`placeholder-${featuredNews.tone}`")
          svg(width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true")
            path(d="M3 11l18-7-4 16-6-4-3 3v-5z")
      .featured-body
        .flex.items-center.gap-2.flex-wrap.mb-2
          span.badge-chip(:class="`chip-${featuredNews.tone}`") {{ featuredNews.category }}
          span.text-xs(class="text-base-content/50") {{ featuredNews.date }}
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
          .media-placeholder(v-else :class="`placeholder-${item.tone}`")
            svg(width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true")
              path(v-if="item.icon === 'store'" d="M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6")
              path(v-else-if="item.icon === 'shield'" d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z")
              path(v-else d="M3 17l6-6 4 4 8-8m0 0h-5m5 0v5")
        .card-body
          .flex.items-center.gap-2.flex-wrap.mb-2
            span.badge-chip(:class="`chip-${item.tone}`") {{ item.category }}
            span.text-xs(class="text-base-content/50") {{ item.date }}
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
          span.badge-chip(:class="`chip-${activeNews.tone}`") {{ activeNews.category }}
          span.text-sm(class="text-base-content/50") {{ activeNews.date }}
        h3.text-xl.font-semibold.text-base-content.mb-4(class="lg:text-2xl") {{ activeNews?.title }}
        template(v-if="activeNews")
          p.text-base.leading-relaxed.mb-3(
            v-for="(para, i) in activeNews.body"
            :key="i"
            class="text-base-content/80"
          ) {{ para }}
        .modal-action
          button.btn.rounded-xl(type="button" @click="closeNews") Закрыть

  MobileNavFooter(v-if="isMobile")
</template>

<script setup>
const { isMobile } = useMobileDetection()

/**
 * Новости магазина. Даты хранятся готовыми строками (не Date):
 * одинаково рендерятся на сервере и клиенте — без hydration-мисматчей.
 * Фото — реальные товары каталога (public/images/products), чтобы лента
 * выглядела живой без дополнительных ассетов.
 */
const newsItems = [
  {
    id: 1,
    date: '28 октября 2026',
    category: 'Акции',
    tone: 'sale',
    icon: 'megaphone',
    image: '/images/products/photo-1511707171634-5f897ff02aa9.webp',
    title: 'Осенняя распродажа: до −25% на смартфоны и ноутбуки',
    excerpt: 'Неделя скидок на самые востребованные категории: смартфоны, ноутбуки и аксессуары.',
    body: [
      'С 28 октября по 5 ноября действует осенняя распродажа: скидки до 25% на смартфоны Samsung Galaxy, ноутбуки Apple MacBook и популярные аксессуары. Количество товаров по акционным ценам ограничено.',
      'Скидка применяется в корзине автоматически — промокоды не нужны. Для участников программы лояльности акционные цены суммируются с бонусными баллами.',
      'Подборка акционных товаров собрана на главной странице каталога.',
    ],
  },
  {
    id: 2,
    date: '21 октября 2026',
    category: 'Новинки',
    tone: 'new',
    icon: 'megaphone',
    image: '/images/products/photo-1606813907291-d86efa9b94db.webp',
    title: 'PlayStation 5 Slim в наличии: комплект с двумя геймпадами',
    excerpt: 'Ожидаемая консоль добралась до склада — комплект с двумя DualSense уже в каталоге.',
    body: [
      'В продажу поступила PlayStation 5 Slim в комплекте с двумя беспроводными геймпадами DualSense. Консоль на 30% компактнее предыдущей версии и оснащена SSD на 1 ТБ.',
      'Отдельно отметим: комплект дешевле, чем консоль и второй геймпад по отдельности. Количество ограничено — успейте оформить заказ с доставкой на ближайший день.',
    ],
  },
  {
    id: 3,
    date: '14 октября 2026',
    category: 'Компания',
    tone: 'company',
    icon: 'store',
    image: null,
    title: 'Новый пункт выдачи в центре: заберите заказ за 15 минут',
    excerpt: 'Третий пункт выдачи открылся в шаговой доступности от метро.',
    body: [
      'Мы открыли третий пункт выдачи — теперь в центре города, в пяти минутах от метро. Заказы, оформленные до 18:00, будут ждать вас там уже на следующий день.',
      'В пункте выдачи можно проверить технику при получении, оформить возврат и получить консультацию. Адрес и часы работы — на странице «Контакты».',
    ],
  },
  {
    id: 4,
    date: '30 сентября 2026',
    category: 'Обзоры',
    tone: 'review',
    icon: 'megaphone',
    image: '/images/products/photo-1505740420928-5e560c06d30e.webp',
    title: 'Sony WH-1000XM4: почему их берут для перелётов',
    excerpt: 'Разбираем флагманские наушники: шумоподавление, автономность и комфорт.',
    body: [
      'WH-1000XM4 — те самые наушники, которые чаще всего советуют частым путешественникам. Активное шумоподавление глушит гул самолёта почти полностью, а 30 часов автономности хватает на дальний перелёт и обратно.',
      'Из приятного: сенсорное управление, одновременное подключение к двум устройствам и быстрая зарядка — 10 минут на зарядке дают 5 часов воспроизведения.',
      'Полные характеристики и цены — в карточке товара в каталоге.',
    ],
  },
  {
    id: 5,
    date: '18 сентября 2026',
    category: 'Акции',
    tone: 'sale',
    icon: 'megaphone',
    image: '/images/products/photo-1541807084-5c52b6b3adef.webp',
    title: 'Учебный сезон: скидки до −20% на ноутбуки',
    excerpt: 'Подбираем машину для учёбы и работы: от лёгких моделей до мощных станций.',
    body: [
      'До конца сентября — скидки до 20% на ноутбуки для учёбы и удалённой работы. В подборке — от лёгких моделей для учёбы до мощных станций для монтажа.',
      'Консультанты помогут выбрать конфигурацию под задачи и бюджет: напишите нам или приходите в шоурум.',
    ],
  },
  {
    id: 6,
    date: '5 сентября 2026',
    category: 'Компания',
    tone: 'company',
    icon: 'shield',
    image: null,
    title: 'Гарантия 2 года на всю технику — теперь официально',
    excerpt: 'Расширяем стандартную гарантию производителя — за наш счёт.',
    body: [
      'С сентября мы добавляем к стандартной гарантии производителей ещё один год — теперь на всю технику в каталоге действует гарантия 2 года.',
      'Всё просто: не нужно доплачивать за расширенный сервис. Обращаетесь в любой наш пункт выдачи, а мы сами свяжемся с сервисным центром и проконтролируем ремонт.',
    ],
  },
  {
    id: 7,
    date: '22 августа 2026',
    category: 'Новинки',
    tone: 'new',
    icon: 'megaphone',
    image: '/images/products/photo-1544117519-31a4b719223d.webp',
    title: 'Apple Watch Series 9: все цвета в наличии',
    excerpt: 'Популярную модель снова можно забрать в день заказа.',
    body: [
      'Пополнен запас Apple Watch Series 9: в наличии все расцветки корпуса и ремешков. Как и раньше, часы можно примерить в шоуруме перед покупкой.',
      'Напоминаем: на часы действует программа гарантии 2 года, а при получении поможем с первичной настройкой.',
    ],
  },
  {
    id: 8,
    date: '10 августа 2026',
    category: 'Обзоры',
    tone: 'review',
    icon: 'megaphone',
    image: '/images/products/photo-1502920917128-1aa500764cbd.webp',
    title: 'Canon EOS R6 для начинающих: с чего начать',
    excerpt: 'Первая беззеркалка без страха: режимы, объективы и первые кадры.',
    body: [
      'EOS R6 часто становится первой «серьёзной» камерой. Рассказываем, с каких режимов начать, какой объектив взять первым делом и почему автофокус этой камеры прощает новичку почти всё.',
      'Камеру можно потрогать и протестировать в шоуруме — приносите свою карту памяти.',
    ],
  },
  {
    id: 9,
    date: '28 июля 2026',
    category: 'Компания',
    tone: 'company',
    icon: 'chart',
    image: null,
    title: 'Итоги июля: 1 200 заказов и доставка за 1,5 дня',
    excerpt: 'Спасибо каждому покупателю: делимся цифрами месяца.',
    body: [
      'Июль стал рекордным: 1 200 заказов, средний срок доставки — 1,5 дня, 98% заказов доставлены в срок.',
      'Спасибо, что выбираете нас. В августе ускорим обработку заказов и добавим новые пункты выдачи — следите за новостями.',
    ],
  },
]

const categories = ['Все', 'Акции', 'Новинки', 'Компания', 'Обзоры']
const activeCategory = ref('Все')

const filteredNews = computed(() =>
  activeCategory.value === 'Все'
    ? newsItems
    : newsItems.filter((n) => n.category === activeCategory.value)
)

const featuredNews = computed(() => filteredNews.value[0] || null)
const restNews = computed(() => filteredNews.value.slice(1))

const activeNews = ref(null)
const openNews = (item) => {
  activeNews.value = item
}
const closeNews = () => {
  activeNews.value = null
}

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
