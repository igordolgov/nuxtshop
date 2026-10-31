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
  updatedAt?: string
}

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

/** '2026-10-28' → «28 октября 2026» (без Intl — SSR-безопасно). */
export function formatNewsDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return iso ?? ''
  const [, y, mo, d] = m
  const month = MONTHS_GEN[Number(mo) - 1] ?? mo
  return `${Number(d)} ${month} ${y}`
}

/** Свежие сверху; при равных датах — больший числовой id. */
export function sortNewsDesc<T extends { date: string; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const d = b.date.localeCompare(a.date)
    if (d !== 0) return d
    return (Number(b.id) || 0) - (Number(a.id) || 0)
  })
}
