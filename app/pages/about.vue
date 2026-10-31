<!-- app/pages/about.vue — страница «О магазине».
     Витрина доверия в стиле крупных маркетплейсов: hero со статистикой,
     преимущества, как мы работаем, история компании и витрина категорий.
     Контент статический (SSR-friendly), иконки — inline SVG без ассетов. -->
<template lang="pug">
.about-page.min-h-screen.bg-base-100.flex.flex-col.mobile-nav-safe
  Header

  main.flex-1.flex.flex-col.max-w-7xl.w-full.mx-auto.px-3.py-4(class="lg:px-6 lg:py-8")
    //- Хлебные крошки
    nav.breadcrumbs.text-sm.mb-3(aria-label="Хлебные крошки")
      ul
        li
          NuxtLink(class="text-base-content/60 hover:text-primary" to="/" prefetch) Главная
        li О магазине

    //- Заголовок
    .mb-5(class="lg:mb-8")
      h1.text-2xl.font-semibold.text-base-content(class="lg:text-3xl") О магазине
      p.text-sm.mt-1.max-w-2xl(class="text-base-content/50 lg:text-base")
        | Техника, которой доверяют: интернет-магазин с оффлайн-шоурумами,
        | гарантией 2 года и доставкой от одного дня.

    //- HERO: приветствие + статистика
    section.hero-band.mb-8(class="lg:mb-12")
      .hero-inner
        h2.text-xl.font-semibold(class="lg:text-2xl")
          | Продаём то, чем пользуемся сами
        p.mt-2(class="lg:text-lg")
          | Мы продаём смартфоны, ноутбуки, аудио и фототехнику с 2018 года.
          | Каждое устройство можно посмотреть и потрогать в шоуруме, а перед
          | покупкой — получить честную консультацию без навязывания.
      .stats-grid
        .stat-card(v-for="stat in stats" :key="stat.label")
          .stat-value {{ stat.value }}
          .stat-label {{ stat.label }}

    //- Преимущества
    section.mb-8(class="lg:mb-12")
      h2.section-title Почему покупают у нас
      .advantages-grid
        .advantage-card(v-for="adv in advantages" :key="adv.title")
          .advantage-icon(v-html="adv.icon")
          h3.font-semibold.text-base-content {{ adv.title }}
          p.text-sm(class="text-base-content/55") {{ adv.text }}

    //- Как мы работаем
    section.mb-8(class="lg:mb-12")
      h2.section-title Как мы работаем
      .steps-grid
        .step-card(v-for="(step, i) in steps" :key="step.title")
          .step-number {{ i + 1 }}
          .step-content
            h3.font-semibold.text-base-content {{ step.title }}
            p.text-sm(class="text-base-content/55") {{ step.text }}

    //- История
    section.mb-8(class="lg:mb-12")
      h2.section-title Наша история
      .timeline
        .timeline-item(v-for="event in history" :key="event.year")
          .timeline-marker(aria-hidden="true")
          .timeline-card
            .timeline-year {{ event.year }}
            p.text-sm(class="text-base-content/70") {{ event.text }}

    //- Витрина категорий
    section.mb-8(class="lg:mb-12")
      h2.section-title Что у нас есть
      .categories-grid
        NuxtLink.category-tile(
          v-for="cat in showcase"
          :key="cat.name"
          to="/"
          prefetch
        )
          .category-icon(v-html="cat.icon")
          span.category-name {{ cat.name }}
          span.category-count {{ cat.count }}

    //- CTA
    section.cta-band
      .cta-inner
        div
          h3.text-lg.font-semibold.text-base-content Остались вопросы?
          p.text-sm.mt-1(class="text-base-content/60")
            | Расскажем о доставке, гарантии и возврате — на связи каждый день.
        .flex.gap-3.flex-wrap
          NuxtLink.btn.btn-primary.rounded-xl(to="/contacts" prefetch) Контакты
          NuxtLink.btn.btn-outline.rounded-xl(to="/" prefetch) В каталог

  MobileNavFooter(v-if="isMobile")
</template>

<script setup>
const { isMobile } = useMobileDetection()

const stats = [
  { value: '8 лет', label: 'на рынке техники' },
  { value: '12 000+', label: 'довольных клиентов' },
  { value: '30+', label: 'брендов в каталоге' },
  { value: '4', label: 'пункта выдачи' },
]

/* Иконки — inline SVG (stroke наследует currentColor контейнера) */
const iconWrap = (paths) =>
  `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

const advantages = [
  {
    title: 'Гарантия 2 года',
    text: 'Добавляем к стандартной гарантии производителя ещё один год — за наш счёт, без доплат за сервис.',
    icon: iconWrap('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>'),
  },
  {
    title: 'Оффлайн-шоурумы',
    text: 'Технику можно посмотреть, потрогать и сравнить вживую — как в обычном магазине.',
    icon: iconWrap('<path d="M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6"/>'),
  },
  {
    title: 'Доставка от 1 дня',
    text: 'Курьером до двери или в пункт выдачи. Заказы до 18:00 отправляем в день оформления.',
    icon: iconWrap('<path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 2.3c-.6.6-.2 1.7.7 1.7H17"/><circle cx="9" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>'),
  },
  {
    title: 'Возврат 14 дней',
    text: 'Не подошло — вернём деньги без лишних вопросов. Товар должен сохранить товарный вид.',
    icon: iconWrap('<path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
  },
  {
    title: 'Безопасная оплата',
    text: 'Картой онлайн с защитой платежа или наличными при получении — как вам удобнее.',
    icon: iconWrap('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'),
  },
  {
    title: 'Поддержка без выходных',
    text: 'Чат, телефон и почта — отвечаем в течение 15 минут в рабочее время.',
    icon: iconWrap('<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/>'),
  },
]

const steps = [
  { title: 'Выбираете', text: 'Каталог с честными характеристиками и реальными фото. Сомневаетесь — подскажем в чате.' },
  { title: 'Оформляете', text: 'Две минуты на заказ: доставка курьером или в пункт выдачи, оплата онлайн или при получении.' },
  { title: 'Получаете', text: 'Проверяете технику при получении — курьер или сотрудник пункта выдачи ждёт и помогает.' },
  { title: 'Пользуетесь', text: 'Гарантия 2 года и поддержка без выходных. Что-то случилось — решаем за наш счёт.' },
]

const history = [
  { year: '2018', text: 'Открыли первый магазин техники с принципом «покажи и расскажи честно».' },
  { year: '2020', text: 'Запустили интернет-магазин с доставкой по стране — покупки стали доступнее.' },
  { year: '2023', text: 'Четыре пункта выдачи и собственная курьерская служба: доставка от одного дня.' },
  { year: '2026', text: 'Программа гарантии 2 года на всю технику и 12 000+ довольных клиентов.' },
]

const showcase = [
  { name: 'Смартфоны', count: 'от 19 990 ₽', icon: iconWrap('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>') },
  { name: 'Ноутбуки', count: 'от 54 990 ₽', icon: iconWrap('<path d="M4 5h16v11H4z"/><path d="M2 19h20"/>') },
  { name: 'Наушники', count: 'от 4 990 ₽', icon: iconWrap('<path d="M4 14v-2a8 8 0 0116 0v2"/><rect x="2" y="14" width="5" height="7" rx="1.5"/><rect x="17" y="14" width="5" height="7" rx="1.5"/>') },
  { name: 'Фототехника', count: 'от 39 990 ₽', icon: iconWrap('<path d="M3 8a2 2 0 012-2h2l2-2h6l2 2h2a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/><circle cx="12" cy="13" r="4"/>') },
  { name: 'Умные часы', count: 'от 14 990 ₽', icon: iconWrap('<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 2h6M9 22h6"/>') },
  { name: 'Консоли и игры', count: 'от 44 990 ₽', icon: iconWrap('<path d="M6 9h4m-2-2v4m7 0h.01M17 11h.01M7.5 17h9a4.5 4.5 0 000-9h-9a4.5 4.5 0 000 9z"/>') },
]

useHead({ title: 'О магазине' })
useSeoMeta({
  title: 'О магазине',
  description:
    'Интернет-магазин техники с 2018 года: оффлайн-шоурумы, гарантия 2 года, доставка от 1 дня, возврат 14 дней и поддержка без выходных.',
})
</script>

<style scoped>
/* ─── Заголовки секций ────────────────────────────────────── */
.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-base-content);
  margin-bottom: 1.25rem;
}

@media (min-width: 1024px) {
  .section-title {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
  }
}

/* ─── HERO-блок ───────────────────────────────────────────── */
.hero-band {
  border-radius: 1.25rem;
  background: linear-gradient(120deg,
    color-mix(in oklab, var(--color-primary) 16%, var(--color-base-100)),
    color-mix(in oklab, var(--color-primary) 5%, var(--color-base-100)));
  border: 1px solid color-mix(in oklab, var(--color-primary) 18%, transparent);
  padding: 1.5rem;
}

@media (min-width: 1024px) {
  .hero-band {
    padding: 2.5rem;
  }
}

.hero-inner h2 {
  color: var(--color-base-content);
}

.hero-inner p {
  color: color-mix(in oklab, var(--color-base-content) 75%, transparent);
  max-width: 42rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 1.5rem;
}

@media (min-width: 640px) {
  .stats-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.stat-card {
  background: var(--color-base-100);
  border-radius: 0.875rem;
  padding: 1rem;
  text-align: center;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
}

.stat-value {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--color-primary);
}

@media (min-width: 1024px) {
  .stat-value {
    font-size: 1.625rem;
  }
}

.stat-label {
  font-size: 0.8125rem;
  color: var(--color-base-content);
  opacity: 0.65;
  margin-top: 0.25rem;
}

/* ─── Преимущества ────────────────────────────────────────── */
.advantages-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 640px) {
  .advantages-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .advantages-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.advantage-card {
  border: 1px solid var(--color-base-300);
  border-radius: 1rem;
  padding: 1.25rem;
  background: var(--color-base-100);
}

.advantage-icon {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.875rem;
  background: color-mix(in oklab, var(--color-primary) 12%, transparent);
  color: var(--color-primary);
}

.advantage-card p {
  margin-top: 0.375rem;
  line-height: 1.55;
}

/* ─── Шаги ────────────────────────────────────────────────── */
.steps-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  counter-reset: step;
}

@media (min-width: 640px) {
  .steps-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .steps-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.step-card {
  display: flex;
  gap: 0.875rem;
  border: 1px solid var(--color-base-300);
  border-radius: 1rem;
  padding: 1.125rem;
  background: var(--color-base-100);
}

.step-number {
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 9999px;
  background: var(--color-primary);
  color: var(--color-primary-content);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.step-card p {
  margin-top: 0.25rem;
  line-height: 1.5;
}

/* ─── Таймлайн истории ────────────────────────────────────── */
.timeline {
  position: relative;
  padding-left: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 0.5rem;
  top: 0.5rem;
  bottom: 0.5rem;
  width: 2px;
  background: color-mix(in oklab, var(--color-primary) 30%, transparent);
}

.timeline-item {
  position: relative;
}

.timeline-marker {
  position: absolute;
  left: -1.5rem;
  top: 1.125rem;
  width: 1rem;
  height: 1rem;
  border-radius: 9999px;
  background: var(--color-primary);
  border: 3px solid var(--color-base-100);
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--color-primary) 40%, transparent);
}

.timeline-card {
  border: 1px solid var(--color-base-300);
  border-radius: 1rem;
  padding: 1rem 1.25rem;
  background: var(--color-base-100);
}

.timeline-year {
  font-weight: 700;
  color: var(--color-primary);
  margin-bottom: 0.25rem;
}

/* ─── Витрина категорий ───────────────────────────────────── */
.categories-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.875rem;
}

@media (min-width: 640px) {
  .categories-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .categories-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

.category-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.25rem 0.75rem;
  border: 1px solid var(--color-base-300);
  border-radius: 1rem;
  background: var(--color-base-100);
  text-align: center;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

@media (hover: hover) {
  .category-tile:hover {
    border-color: color-mix(in oklab, var(--color-primary) 45%, transparent);
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.07);
    transform: translateY(-2px);
  }
}

.category-icon {
  color: var(--color-primary);
}

.category-name {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--color-base-content);
}

.category-count {
  font-size: 0.8125rem;
  color: var(--color-base-content);
  opacity: 0.55;
}

/* ─── CTA ─────────────────────────────────────────────────── */
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
