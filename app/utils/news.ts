// app/utils/news.ts
// Общие хелперы новостей для витрины (/news) и админки (/admin/news):
// рубрики, тон-классы бейджей, форматирование даты.
// Форматирование БЕЗ toLocaleDateString/Intl: сервер (Node) и браузер
// дают разные тексты → hydration-мисматчи. Статическая карта месяцев
// рендерится одинаково везде.

export interface NewsItem {
  id: string
  /** ISO-дата YYYY-MM-DD */
  date: string
  category: string
  title: string
  excerpt: string
  body: string[]
  /** Путь/URL изображения; '' — плитка без фото. */
  image: string
  /**
   * Товары из новости (перелинковка с каталогом): id из data:products.
   * На витрину приходят уже джойненные товары (products). */
  productIds?: string[]
  updatedAt?: string
}

/** Мини-карточка товара из новости (джойн на сервере, GET /api/news). */
export interface NewsProductCard {
  id: string
  slug: string
  name: string
  price: number
  image: string
  inStock: boolean
}

/** Новость в ответе API — с товарами (перелинковка). */
export type NewsWithProducts = NewsItem & { products: NewsProductCard[] }

export const NEWS_CATEGORIES = ['Акции', 'Новинки', 'Компания', 'Обзоры'] as const

/** рубрика → тон бейджа/плитки (scoped-классы .chip-*, .placeholder-*). */
export function newsTone(category: string): 'sale' | 'new' | 'company' | 'review' {
  switch (category) {
    case 'Акции':
      return 'sale'
    case 'Новинки':
      return 'new'
    case 'Обзоры':
      return 'review'
    default:
      return 'company'
  }
}

const MONTHS_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const

// Месяцы и шаблон строки для локалей витрины (en/es). Формат по-прежнему
// без Intl: чистая конкатенация одинакова на сервере и клиенте (нет
// hydration-мисматчей). Фолбэк при неизвестной локали — русский.
const MONTHS_BY_LOCALE: Record<string, { months: readonly string[]; template: (d: string, m: string, y: string) => string }> = {
  ru: { months: MONTHS_GEN, template: (d, m, y) => `${d} ${m} ${y}` },
  en: {
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    template: (d, m, y) => `${m} ${d}, ${y}`,
  },
  es: {
    months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    template: (d, m, y) => `${d} de ${m} de ${y}`,
  },
}

/** '2026-10-28' → «28 октября 2026» / «October 28, 2026» / «28 de octubre de 2026».
 *  Локаль — код i18n ('ru' | 'en' | 'es'); пусто/неизвестно → русский. */
export function formatNewsDate(iso: string, locale = 'ru'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return iso ?? ''
  const [, y, mo, d] = m
  const pack = MONTHS_BY_LOCALE[locale] ?? MONTHS_BY_LOCALE.ru
  const month = pack.months[Number(mo) - 1] ?? mo
  return pack.template(String(Number(d)), month, y)
}

/** Свежие сверху; при равных датах — больший числовой id. */
export function sortNewsDesc<T extends { date: string; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const d = b.date.localeCompare(a.date)
    if (d !== 0) return d
    return (Number(b.id) || 0) - (Number(a.id) || 0)
  })
}

/**
 * SVG-путь иконки плитки без фото — по рубрике (код вместо ассетов).
 * Используется на витрине /news и в блоке «Последние новости» на главной.
 */
export function newsPlaceholderIcon(category: string): string {
  if (category === 'Акции') return 'M3 11l18-7-4 16-6-4-3 3v-5z'
  if (category === 'Новинки')
    return 'M12 2l2.4 6.2L21 9.5l-5 4.4 1.5 6.6L12 17l-5.5 3.5L8 13.9l-5-4.4 6.6-1.3L12 2z'
  if (category === 'Обзоры') return 'M3 17l6-6 4 4 8-8m0 0h-5m5 0v5'
  return 'M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6'
}
