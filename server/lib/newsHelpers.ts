// server/lib/newsHelpers.ts
// Новости магазина: KV-хранилище + сид + валидация. Зеркало паттерна
// productHelpers: live-данные в KV `data:news`, при пустом KV —
// самоисцеление записью сида (best-effort: сбой записи не ломает выдачу —
// страница новостей не должна 500-ить из-за лимитов).
//
// Разбивка (этап 6): доменные типы — newsTypes.ts, сид — newsSeed.ts,
// валидация payload — newsValidation.ts. Этот файл — фасад: KV-чтение/
// запись, досадка переводов и витринные хелперы + реэкспорт публичного
// API (существующие импорты из newsHelpers не меняются).
import type { H3Event } from 'h3';
import { kvGetJSON, kvPutJSON } from './storage';
import type { Product } from './productHelpers';
import type { NewsItem } from './newsTypes';
import type { NewsWithProducts } from './newsTypes';
import { MAX_NEWS_PRODUCTS, NEWS_KEY } from './newsTypes';
import { newsSeed } from './newsSeed';

// Публичный API разбитых модулей доступен по прежнему пути импорта:
export * from './newsTypes';
export * from './newsSeed';
export * from './newsValidation';

// ─── Чтение / запись ─────────────────────────────────────────────────────

/**
 * Читает новости из KV; при пустом хранилище отдаёт сид и пытается
 * записать его в KV (best-effort — сбой записи не роняет выдачу).
 * Для уже хранящихся записей — разовая досадка переводов из сида
 * (см. mergeSeedTranslations): live-KV мог быть записан до появления
 * i18n-полей, и без досадки /en и /es показывали русский фолбэк.
 */
export async function readNews(event: H3Event): Promise<NewsItem[]> {
  const stored = await kvGetJSON<NewsItem[]>(event, NEWS_KEY);
  if (!Array.isArray(stored)) {
    const seed = newsSeed.map((n) => structuredClone(n));
    try {
      await kvPutJSON(event, NEWS_KEY, seed);
    } catch (e) {
      console.warn('news: не удалось записать сид в KV (отдаю сид без записи)', e);
    }
    return seed;
  }
  // Досадка переводов: идемпотентно — после записи в KV changed=false,
  // лишних записей в KV нет (лимит free-тарифа). best-effort: сбой записи
  // не роняет выдачу — отдаём досаженный массив без сохранения.
  const { items, changed } = mergeSeedTranslations(stored);
  if (!changed) return stored;
  try {
    await kvPutJSON(event, NEWS_KEY, items);
  } catch (e) {
    console.warn('news: не удалось записать переводы сида в KV (отдаю без записи)', e);
  }
  return items;
}

/** Единственная точка записи: массив ЦЕЛИКОМ в KV (валидация типа). */
export async function writeNews(event: H3Event, items: NewsItem[]): Promise<void> {
  if (!Array.isArray(items)) throw new Error('News must be an array');
  await kvPutJSON(event, NEWS_KEY, items);
}

/** Поля переводов, досаживаемые из сида. */
const SEED_TRANSLATION_FIELDS = [
  'titleEn',
  'titleEs',
  'excerptEn',
  'excerptEs',
  'bodyEn',
  'bodyEs',
] as const;

/**
 * Чистая: досадка переводов из сида в id-совпадающие live-записи.
 *
 * Зачем: сид перезаписывает KV только при ПУСТОМ хранилище, поэтому
 * новости, записанные в KV до появления i18n-полей, остались без
 * titleEn/titleEs/… — витрина /en и /es показывала русский фолбэк.
 *
 * Правила безопасности:
 *  - русский текст live-записи (title/excerpt/body) должен совпадать
 *    с сидом дословно: отредактированные админом новости НЕ трогаем
 *    (переводы из сида могли бы разойтись с новым текстом);
 *  - уже заполненные переводные поля НЕ перезаписываются;
 *  - записи без сид-аналога не изменяются; вход не мутируется.
 *
 * Возвращает новый массив и флаг changed (для best-effort записи).
 */
export function mergeSeedTranslations(stored: NewsItem[]): { items: NewsItem[]; changed: boolean } {
  if (!Array.isArray(stored)) return { items: [], changed: false };
  let changed = false;
  const items = stored.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const seed = newsSeed.find((n) => n.id === item.id);
    if (!seed) return item;
    // Защита правок админа: русский текст должен совпадать с сидом дословно
    const baseMatchesSeed =
      item.title === seed.title &&
      item.excerpt === seed.excerpt &&
      JSON.stringify(item.body) === JSON.stringify(seed.body);
    if (!baseMatchesSeed) return item;
    const patch: Partial<Pick<NewsItem, (typeof SEED_TRANSLATION_FIELDS)[number]>> = {};
    for (const field of SEED_TRANSLATION_FIELDS) {
      if (item[field] === undefined && seed[field] !== undefined) {
        // Присваивание через union-ключ TS требует каста: значение из той же
        // схемы NewsItem, согласованность обеспечивает сам перебор полей
        (patch as Record<string, unknown>)[field] = structuredClone(seed[field]);
      }
    }
    if (Object.keys(patch).length === 0) return item;
    changed = true;
    return { ...item, ...patch };
  });
  return { items, changed };
}

/**
 * Витринный фильтр: черновики (published === false) не показываются.
 * Старые записи и сид без поля — публикуются.
 */
export function publishedNews(items: NewsItem[]): NewsItem[] {
  return items.filter((n) => n && n.published !== false);
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
        (a, b) =>
          (b.gallery?.length ?? 0) - (a.gallery?.length ?? 0) || numericId(b) - numericId(a),
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
export function attachProducts(items: NewsItem[], products: Product[]): NewsWithProducts[] {
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
        return [
          {
            id: String(p.id),
            slug: p.slug,
            name: p.name,
            // Переводы названия — для локализации мини-карточки на витрине
            // (localizedProduct на стороне клиента/SSR).
            ...(typeof p.nameEn === 'string' && p.nameEn.trim() ? { nameEn: p.nameEn } : {}),
            ...(typeof p.nameEs === 'string' && p.nameEs.trim() ? { nameEs: p.nameEs } : {}),
            price: p.price,
            image: p.image,
            inStock: Boolean(p.inStock),
          },
        ];
      }),
    };
  });
}
