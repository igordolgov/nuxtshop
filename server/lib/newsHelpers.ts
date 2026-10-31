// server/lib/newsHelpers.ts
// Новости магазина: KV-хранилище + сид + валидация.
// Зеркало паттерна productHelpers: live-данные в KV `data:news`,
// при пустом KV — самоисцеление записью сида (best-effort: сбой записи
// не ломает выдачу — страница новостей не должна 500-ить из-за лимитов).
import type { H3Event } from 'h3';
import { kvGetJSON, kvPutJSON } from './storage';
import type { Product } from './productHelpers';

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
  updatedAt: string;
}

/** Максимум товаров в одной новости — от переполненных payload и UI. */
export const MAX_NEWS_PRODUCTS = 6;

/** Мини-карточка товара для витрины новости (джойн на GET /api/news). */
export interface NewsProductCard {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  inStock: boolean;
}

// ─── Сид: те же 9 новостей, что были статикой на витрине ────────────────
// Дата — ISO; витрина форматирует по-русски (без toLocaleDateString —
// одинаково на сервере и клиенте).
export const newsSeed: NewsItem[] = [
  {
    id: '1',
    date: '2026-10-28',
    category: 'Акции',
    title: 'Осенняя распродажа: до −25% на смартфоны и ноутбуки',
    excerpt:
      'Неделя скидок на самые востребованные категории: смартфоны, ноутбуки и аксессуары.',
    body: [
      'С 28 октября по 5 ноября действует осенняя распродажа: скидки до 25% на смартфоны Samsung Galaxy, ноутбуки Apple MacBook и популярные аксессуары. Количество товаров по акционным ценам ограничено.',
      'Скидка применяется в корзине автоматически — промокоды не нужны. Для участников программы лояльности акционные цены суммируются с бонусными баллами.',
      'Подборка акционных товаров собрана на главной странице каталога.',
    ],
    image: '/images/products/photo-1511707171634-5f897ff02aa9.webp',
    // Смартфоны/ноутбуки/планшет — суть акции (id из data:products)
    productIds: ['1', '2', '28'],
    updatedAt: '2026-10-28T09:00:00.000Z',
  },
  {
    id: '2',
    date: '2026-10-21',
    category: 'Новинки',
    title: 'PlayStation 5 Slim в наличии: комплект с двумя геймпадами',
    excerpt:
      'Ожидаемая консоль добралась до склада — комплект с двумя DualSense уже в каталоге.',
    body: [
      'В продажу поступила PlayStation 5 Slim в комплекте с двумя беспроводными геймпадами DualSense. Консоль на 30% компактнее предыдущей версии и оснащена SSD на 1 ТБ.',
      'Отдельно отметим: комплект дешевле, чем консоль и второй геймпад по отдельности. Количество ограничено — успейте оформить заказ с доставкой на ближайший день.',
    ],
    image: '/images/products/photo-1606813907291-d86efa9b94db.webp',
    // Консоли из новости: PS5 + Nintendo Switch
    productIds: ['6', '27'],
    updatedAt: '2026-10-21T09:00:00.000Z',
  },
  {
    id: '3',
    date: '2026-10-14',
    category: 'Компания',
    title: 'Новый пункт выдачи в центре: заберите заказ за 15 минут',
    excerpt: 'Третий пункт выдачи открылся в шаговой доступности от метро.',
    body: [
      'Мы открыли третий пункт выдачи — теперь в центре города, в пяти минутах от метро. Заказы, оформленные до 18:00, будут ждать вас там уже на следующий день.',
      'В пункте выдачи можно проверить технику при получении, оформить возврат и получить консультацию. Адрес и часы работы — на странице «Контакты».',
    ],
    image: '',
    updatedAt: '2026-10-14T09:00:00.000Z',
  },
  {
    id: '4',
    date: '2026-09-30',
    category: 'Обзоры',
    title: 'Sony WH-1000XM4: почему их берут для перелётов',
    excerpt: 'Разбираем флагманские наушники: шумоподавление, автономность и комфорт.',
    body: [
      'WH-1000XM4 — те самые наушники, которые чаще всего советуют частым путешественникам. Активное шумоподавление глушит гул самолёта почти полностью, а 30 часов автономности хватает на дальний перелёт и обратно.',
      'Из приятного: сенсорное управление, одновременное подключение к двум устройствам и быстрая зарядка — 10 минут на зарядке дают 5 часов воспроизведения.',
      'Полные характеристики и цены — в карточке товара в каталоге.',
    ],
    image: '/images/products/photo-1505740420928-5e560c06d30e.webp',
    // Герой обзора + альтернатива из той же категории
    productIds: ['3', '25'],
    updatedAt: '2026-09-30T09:00:00.000Z',
  },
  {
    id: '5',
    date: '2026-09-18',
    category: 'Акции',
    title: 'Учебный сезон: скидки до −20% на ноутбуки',
    excerpt: 'Подбираем машину для учёбы и работы: от лёгких моделей до мощных станций.',
    body: [
      'До конца сентября — скидки до 20% на ноутбуки для учёбы и удалённой работы. В подборке — от лёгких моделей для учёбы до мощных станций для монтажа.',
      'Консультанты помогут выбрать конфигурацию под задачи и бюджет: напишите нам или приходите в шоурум.',
    ],
    image: '/images/products/photo-1541807084-5c52b6b3adef.webp',
    // Ноутбук для учёбы + монитор и внешнее хранилище к нему
    productIds: ['2', '19', '20'],
    updatedAt: '2026-09-18T09:00:00.000Z',
  },
  {
    id: '6',
    date: '2026-09-05',
    category: 'Компания',
    title: 'Гарантия 2 года на всю технику — теперь официально',
    excerpt: 'Расширяем стандартную гарантию производителя — за наш счёт.',
    body: [
      'С сентября мы добавляем к стандартной гарантии производителей ещё один год — теперь на всю технику в каталоге действует гарантия 2 года.',
      'Всё просто: не нужно доплачивать за расширенный сервис. Обращаетесь в любой наш пункт выдачи, а мы сами свяжемся с сервисным центром и проконтролируем ремонт.',
    ],
    image: '',
    updatedAt: '2026-09-05T09:00:00.000Z',
  },
  {
    id: '7',
    date: '2026-08-22',
    category: 'Новинки',
    title: 'Apple Watch Series 9: все цвета в наличии',
    excerpt: 'Популярную модель снова можно забрать в день заказа.',
    body: [
      'Пополнен запас Apple Watch Series 9: в наличии все расцветки корпуса и ремешков. Как и раньше, часы можно примерить в шоуруме перед покупкой.',
      'Напоминаем: на часы действует программа гарантии 2 года, а при получении поможем с первичной настройкой.',
    ],
    image: '/images/products/photo-1544117519-31a4b719223d.webp',
    // Часы из новости + альтернативы в тех же категориях
    productIds: ['5', '26', '16'],
    updatedAt: '2026-08-22T09:00:00.000Z',
  },
  {
    id: '8',
    date: '2026-08-10',
    category: 'Обзоры',
    title: 'Canon EOS R6 для начинающих: с чего начать',
    excerpt: 'Первая беззеркалка без страха: режимы, объективы и первые кадры.',
    body: [
      'EOS R6 часто становится первой «серьёзной» камерой. Рассказываем, с каких режимов начать, какой объектив взять первым делом и почему автофокус этой камеры прощает новичку почти всё.',
      'Камеру можно потрогать и протестировать в шоуруме — приносите свою карту памяти.',
    ],
    image: '/images/products/photo-1502920917128-1aa500764cbd.webp',
    // Камера из обзора
    productIds: ['4'],
    updatedAt: '2026-08-10T09:00:00.000Z',
  },
  {
    id: '9',
    date: '2026-07-28',
    category: 'Компания',
    title: 'Итоги июля: 1 200 заказов и доставка за 1,5 дня',
    excerpt: 'Спасибо каждому покупателю: делимся цифрами месяца.',
    body: [
      'Июль стал рекордным: 1 200 заказов, средний срок доставки — 1,5 дня, 98% заказов доставлены в срок.',
      'Спасибо, что выбираете нас. В августе ускорим обработку заказов и добавим новые пункты выдачи — следите за новостями.',
    ],
    image: '',
    updatedAt: '2026-07-28T09:00:00.000Z',
  },
];

// ─── Чтение / запись ─────────────────────────────────────────────────────

/**
 * Читает новости из KV; при пустом хранилище отдаёт сид и пытается
 * записать его в KV (best-effort — сбой записи не роняет выдачу).
 */
export async function readNews(event: H3Event): Promise<NewsItem[]> {
  const stored = await kvGetJSON<NewsItem[]>(event, NEWS_KEY);
  if (Array.isArray(stored)) return stored;
  const seed = newsSeed.map((n) => structuredClone(n));
  try {
    await kvPutJSON(event, NEWS_KEY, seed);
  } catch (e) {
    console.warn('news: не удалось записать сид в KV (отдаю сид без записи)', e);
  }
  return seed;
}

/** Единственная точка записи: массив ЦЕЛИКОМ в KV (валидация типа). */
export async function writeNews(event: H3Event, items: NewsItem[]): Promise<void> {
  if (!Array.isArray(items)) throw new Error('News must be an array');
  await kvPutJSON(event, NEWS_KEY, items);
}

// ─── Валидация / нормализация (чистые функции — покрыты тестами) ─────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PARAGRAPHS = 20;
const MAX_PARAGRAPH_LEN = 2000;

export class NewsValidationError extends Error {}

/**
 * Список id товаров из новости: строки, тримминг, без пустых и дублей,
 * не больше MAX_NEWS_PRODUCTS. Мягкая нормализация (без ошибок):
 * несуществующие id безвредны — при показе просто не джойнятся.
 */
export function normalizeNewsProductIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const raw of input) {
    const id = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
    if (id && !out.includes(id)) out.push(id);
    if (out.length >= MAX_NEWS_PRODUCTS) break;
  }
  return out;
}

/**
 * Тело новости: строка (переносы строк = абзацы) или массив строк.
 * Тримминг, пустые отбрасываются, лимиты на количество и длину.
 */
export function normalizeNewsBody(input: unknown): string[] {
  const raw =
    Array.isArray(input) ? input.map(String) : typeof input === 'string' ? input.split(/\r?\n/) : [];

  const paras = raw
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .slice(0, MAX_PARAGRAPHS);

  if (paras.length === 0) {
    throw new NewsValidationError('Добавьте хотя бы один абзац полного текста');
  }
  for (const p of paras) {
    if (p.length > MAX_PARAGRAPH_LEN) {
      throw new NewsValidationError(`Абзац длиннее ${MAX_PARAGRAPH_LEN} символов — разбейте его`);
    }
  }
  return paras;
}

/**
 * Приводит полезную нагрузку формы к NewsItem. `existing` — для PUT
 * (updatedAt сбрасывается в обоих случаях). Кидает NewsValidationError
 * с сообщением на русском — endpoints отдают их как 400.
 */
export function sanitizeNewsItem(raw: Record<string, unknown>): Omit<NewsItem, 'id'> {
  const title = typeof raw?.title === 'string' ? raw.title.trim() : '';
  if (title.length < 5 || title.length > 120) {
    throw new NewsValidationError('Заголовок — от 5 до 120 символов');
  }

  const category = typeof raw?.category === 'string' ? raw.category.trim() : '';
  if (!NEWS_CATEGORIES.includes(category as NewsCategory)) {
    throw new NewsValidationError(`Рубрика должна быть одной из: ${NEWS_CATEGORIES.join(', ')}`);
  }

  const date = typeof raw?.date === 'string' ? raw.date.trim() : '';
  if (!ISO_DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
    throw new NewsValidationError('Дата обязательна в формате ГГГГ-ММ-ДД');
  }

  const excerpt = typeof raw?.excerpt === 'string' ? raw.excerpt.trim() : '';
  if (excerpt.length > 220) {
    throw new NewsValidationError('Краткое описание — не длиннее 220 символов');
  }

  const body = normalizeNewsBody(raw?.body);

  let image = typeof raw?.image === 'string' ? raw.image.trim() : '';
  if (image && !/^(\/|data:image\/|https?:\/\/)/.test(image)) {
    throw new NewsValidationError('Изображение: путь (/…), data-URI или http(s):// URL');
  }

  return {
    date,
    category: category as NewsCategory,
    title,
    excerpt,
    body,
    image,
    productIds: normalizeNewsProductIds(raw?.productIds),
    updatedAt: new Date().toISOString(),
  };
}

/** Свежие сверху; при равных датах — больший id (стабильно). */
export function sortNewsDesc(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    if (d !== 0) return d;
    return (Number(b.id) || 0) - (Number(a.id) || 0);
  });
}

/** Следующий свободный числовой id (как у товаров). */
export function nextNewsId(items: NewsItem[]): string {
  return items.length > 0 ? String(Math.max(...items.map((n) => Number(n.id) || 0)) + 1) : '1';
}

/** Новость с уже джойненными товарами (для витрины). */
export type NewsWithProducts = NewsItem & { products: NewsProductCard[] };

// ─── Автоподбор товаров по рубрике (пустой productIds → правило рубрики) ─
//
// Новости без ручного выбора не должны оставаться без перелинковки:
// витрина подбирает товары сама, по рубрике новости. Правила
// детерминированные (без Date.now/random — SSR-выдача и тесты стабильны)
// и опираются на реальные данные каталога. Ручной выбор в админке всегда
// приоритетнее — автоподбор только заполняет пробел.

const numericId = (p: Product): number => Number(p.id) || 0;

/**
 * Автоподбор товаров новости по её рубрике: возвращает id (до
 * MAX_NEWS_PRODUCTS) в порядке показа. Чистая функция — вход не мутируется
 * (фильтр копирует, сортируется копия), покрыта тестами.
 *
 * - Акции    → в наличии, от самого доступного по цене (выгодные предложения);
 * - Новинки  → свежие добавления каталога (больше числовой id — позже добавлен);
 * - Обзоры   → самые подробные карточки (больше фото в галерее);
 * - Компания → хиты склада (больше запас — активнее продвигаем);
 * - неизвестная рубрика → [] (секция на витрине просто не рендерится).
 */
export function autopickProductIds(category: string, products: Product[]): string[] {
  const pool = products.filter((p) => p && typeof p === 'object');
  let picked: Product[] = [];
  switch (category) {
    case 'Акции':
      picked = pool
        .filter((p) => p.inStock)
        .sort((a, b) => a.price - b.price || numericId(a) - numericId(b));
      break;
    case 'Новинки':
      picked = pool.sort((a, b) => numericId(b) - numericId(a));
      break;
    case 'Обзоры':
      picked = pool.sort(
        (a, b) => (b.gallery?.length ?? 0) - (a.gallery?.length ?? 0) || numericId(b) - numericId(a),
      );
      break;
    case 'Компания':
      picked = pool.sort(
        (a, b) => (b.stockQuantity ?? 0) - (a.stockQuantity ?? 0) || numericId(a) - numericId(b),
      );
      break;
    default:
      picked = [];
  }
  return picked.slice(0, MAX_NEWS_PRODUCTS).map((p) => String(p.id));
}

/**
 * Перелинковка: к каждой новости — её товары из каталога. Порядок ручного
 * productIds сохраняется, несуществующие/удалённые id пропускаются; пустой
 * список → автоподбор по рубрике новости (autopickProductIds), секция на
 * витрине не пропадает. Чистая функция — покрыта тестами; на GET /api/news
 * джойнит readProducts.
 */
export function attachProducts(
  items: NewsItem[],
  products: Product[],
): NewsWithProducts[] {
  const byId = new Map(products.map((p) => [String(p.id), p]));
  return items.map((item) => {
    // Ручной выбор приоритетен; пусто → автоподбор по рубрике.
    // В ответ отдаём только карточки: сохранённые productIds не подменяем.
    const ids = item.productIds?.length
      ? item.productIds
      : autopickProductIds(item.category, products);
    return {
      ...item,
      products: ids.flatMap((id) => {
        const p = byId.get(String(id));
        if (!p) return [];
        return [{
          id: String(p.id),
          slug: p.slug,
          name: p.name,
          price: p.price,
          image: p.image,
          inStock: Boolean(p.inStock),
        }];
      }),
    };
  });
}
