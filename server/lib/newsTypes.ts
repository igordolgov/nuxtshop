// server/lib/newsTypes.ts
// Доменные типы и константы новостей. Разбивка newsHelpers (этап 6):
// типы — отдельно от сида (newsSeed.ts), KV-логики и валидации
// (newsValidation.ts), фасад с KV-чтением/записью — newsHelpers.ts.

/** KV-ключ live-данных новостей (сид пишется сюда при пустом хранилище). */
export const NEWS_KEY = 'data:news';

/** Рубрики — единый список для API, админки и витрины. */
export const NEWS_CATEGORIES = ['Акции', 'Новинки', 'Компания', 'Обзоры'] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export interface NewsItem {
  id: string;
  /** ISO-дата YYYY-MM-DD (input type=date); на витрине форматируется. */
  date: string;
  category: NewsCategory;
  title: string;
  excerpt: string;
  /** Абзацы полного текста (пустые не хранятся). */
  body: string[];
  /** Путь ('/…'), data-URI или внешний URL; '' — плитка без фото. */
  image: string;
  /**
   * Товары из новости (перелинковка с каталогом): id из data:products,
   * порядок = порядок показа. Необязательно; несуществующие id при
   * показе просто пропускаются (товар мог быть удалён).
   */
  productIds?: string[];
  /**
   * Опубликовано? false — черновик: виден только в админке, на витрине
   * фильтруется (publishedNews). undefined — опубликовано (обратная
   * совместимость со старыми записями и сидом).
   */
  published?: boolean;
  // ── Переводы (i18n): контракт как у товаров — базовые поля хранят
  // русский текст, переводы необязательны; нет перевода → витрина
  // показывает русский (фолбэк). Миграция KV не требуется.
  titleEn?: string;
  titleEs?: string;
  excerptEn?: string;
  excerptEs?: string;
  /** Перевод полного текста: список абзацев ЦЕЛИКОМ замещает body. */
  bodyEn?: string[];
  bodyEs?: string[];
  updatedAt: string;
}

/** Максимум товаров в одной новости — от переполненных payload и UI. */
export const MAX_NEWS_PRODUCTS = 6;

/** Мини-карточка товара для витрины новости (джойн на GET /api/news). */
export interface NewsProductCard {
  id: string;
  slug: string;
  name: string;
  /** Переводы названия — витрина локализует карточку по локали URL. */
  nameEn?: string;
  nameEs?: string;
  price: number;
  image: string;
  inStock: boolean;
}

/** Новость с уже джойненными товарами (для витрины). */
export type NewsWithProducts = NewsItem & { products: NewsProductCard[] };
