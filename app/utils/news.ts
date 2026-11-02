// app/utils/news.ts
// Общие хелперы новостей для витрины (/news) и админки (/admin/news):
// рубрики, тон-классы бейджей, форматирование даты.
// Форматирование БЕЗ toLocaleDateString/Intl: сервер (Node) и браузер
// дают разные тексты → hydration-мисматчи. Статическая карта месяцев
// рендерится одинаково везде.

export interface NewsItem {
  id: string;
  /** ISO-дата YYYY-MM-DD */
  date: string;
  category: string;
  title: string;
  excerpt: string;
  body: string[];
  /** Путь/URL изображения; '' — плитка без фото. */
  image: string;
  /**
   * Товары из новости (перелинковка с каталогом): id из data:products.
   * На витрину приходят уже джойненные товары (products). */
  productIds?: string[];
  // Переводы (i18n): нет поля/пусто → фолбэк на русский (см. localizedNews).
  titleEn?: string;
  titleEs?: string;
  excerptEn?: string;
  excerptEs?: string;
  /** Перевод полного текста: список абзацев целиком замещает body. */
  bodyEn?: string[];
  bodyEs?: string[];
  updatedAt?: string;
}

/** Мини-карточка товара из новости (джойн на сервере, GET /api/news). */
export interface NewsProductCard {
  id: string;
  slug: string;
  name: string;
  /** Переводы названия — локализуются через localizedProduct. */
  nameEn?: string;
  nameEs?: string;
  price: number;
  image: string;
  inStock: boolean;
}

/** Новость в ответе API — с товарами (перелинковка). */
export type NewsWithProducts = NewsItem & { products: NewsProductCard[] };

export const NEWS_CATEGORIES = ['Акции', 'Новинки', 'Компания', 'Обзоры'] as const;

/**
 * Рубрика → ключ словаря (news.categories.*). Значения рубрик в KV —
 * русские данные, отображение на витрине локализуется словарём.
 * «Все» — значение фильтра, не рубрика записи.
 */
export const NEWS_CATEGORY_KEYS: Record<string, string> = {
  Все: 'all',
  Акции: 'promo',
  Новинки: 'new',
  Компания: 'company',
  Обзоры: 'reviews',
};

/** Локализованная подпись рубрики: нет ключа → сырое значение (данные). */
export function newsCategoryLabel(category: string, t: (key: string) => string): string {
  const key = NEWS_CATEGORY_KEYS[category];
  return key ? t(`news.categories.${key}`) : category;
}

// Суффиксы переводных полей (как у товаров). ru отсутствует: русский
// текст живёт в базовых полях, для него функция возвращает объект как есть.
const LOCALE_FIELD_SUFFIX: Record<string, string> = {
  en: 'En',
  es: 'Es',
};

/** Непустая строка → сама строка; иначе null (сигнал фолбэка). */
function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Локализованная копия новости для витрины (title/excerpt/body).
 * - ru → объект как есть (нулевые накладные расходы);
 * - en/es → переводы из полей с суффиксом, нет перевода → русский текст.
 *   body замещается ТОЛЬКО целиком: если в переводе нет ни одного
 *   непустого абзаца — показываем русский список.
 * Объект не мутируется: карточки/списки получают поверхностную копию.
 */
export function localizedNews<T extends Record<string, unknown>>(
  item: T | null | undefined,
  locale: string,
): T {
  if (!item || typeof item !== 'object') return item as T;

  const suffix = LOCALE_FIELD_SUFFIX[locale];
  if (!suffix) return item;

  const title = nonEmpty(item[`title${suffix}`]) ?? (item.title as T['title']);
  const excerpt = nonEmpty(item[`excerpt${suffix}`]) ?? (item.excerpt as T['excerpt']);

  const rawBody = Array.isArray(item.body) ? (item.body as string[]) : undefined;
  const translated = item[`body${suffix}`];
  const translatedList = Array.isArray(translated)
    ? (translated as unknown[]).filter((p): p is string => nonEmpty(p) !== null)
    : [];
  const body = translatedList.length > 0 ? translatedList : rawBody;

  return { ...item, title, excerpt, body } as T;
}

/** рубрика → тон бейджа/плитки (scoped-классы .chip-*, .placeholder-*). */
export function newsTone(category: string): 'sale' | 'new' | 'company' | 'review' {
  switch (category) {
    case 'Акции':
      return 'sale';
    case 'Новинки':
      return 'new';
    case 'Обзоры':
      return 'review';
    default:
      return 'company';
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
] as const;

// Месяцы и шаблон строки для локалей витрины (en/es). Формат по-прежнему
// без Intl: чистая конкатенация одинакова на сервере и клиенте (нет
// hydration-мисматчей). Фолбэк при неизвестной локали — русский.
const MONTHS_BY_LOCALE: Record<
  string,
  { months: readonly string[]; template: (d: string, m: string, y: string) => string }
> = {
  ru: { months: MONTHS_GEN, template: (d, m, y) => `${d} ${m} ${y}` },
  en: {
    months: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    template: (d, m, y) => `${m} ${d}, ${y}`,
  },
  es: {
    months: [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ],
    template: (d, m, y) => `${d} de ${m} de ${y}`,
  },
};

/** '2026-10-28' → «28 октября 2026» / «October 28, 2026» / «28 de octubre de 2026».
 *  Локаль — код i18n ('ru' | 'en' | 'es'); пусто/неизвестно → русский. */
export function formatNewsDate(iso: string, locale = 'ru'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return iso ?? '';
  const [, y, mo, d] = m;
  const pack = MONTHS_BY_LOCALE[locale] ?? MONTHS_BY_LOCALE.ru;
  const month = pack.months[Number(mo) - 1] ?? mo;
  return pack.template(String(Number(d)), month, y);
}

/** Свежие сверху; при равных датах — больший числовой id. */
export function sortNewsDesc<T extends { date: string; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    if (d !== 0) return d;
    return (Number(b.id) || 0) - (Number(a.id) || 0);
  });
}

/**
 * SVG-путь иконки плитки без фото — по рубрике (код вместо ассетов).
 * Используется на витрине /news и в блоке «Последние новости» на главной.
 */
export function newsPlaceholderIcon(category: string): string {
  if (category === 'Акции') return 'M3 11l18-7-4 16-6-4-3 3v-5z';
  if (category === 'Новинки')
    return 'M12 2l2.4 6.2L21 9.5l-5 4.4 1.5 6.6L12 17l-5.5 3.5L8 13.9l-5-4.4 6.6-1.3L12 2z';
  if (category === 'Обзоры') return 'M3 17l6-6 4 4 8-8m0 0h-5m5 0v5';
  return 'M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6';
}
