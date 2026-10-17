// server/lib/productHelpers.ts
import type { H3Event } from 'h3';
import { kvGetJSON, kvPutJSON } from './storage';
import { cached, cacheInvalidate } from './cache';
import productsSeed from '../data/products.json';

const PRODUCTS_KEY = 'data:products';

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  image: string;
  gallery: string[];
  categories: string[];
  inStock: boolean;
  stockQuantity: number;
  characteristics: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

export function slugify(str: string): string {
  if (!str) return `product-${Date.now()}`;
  const slug = str
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `product-${Date.now()}`;
}

// Кэш каталога: 1 чтение KV за TTL на изолят вместо чтения на каждый запрос
// (каталог, карточка, similar, sitemap, редиректы — всё идёт через readProducts).
// TTL = окну глобальной консистентности KV (~60 c), поэтому дополнительной
// «устареваемости» по сравнению с KV без кэша не появляется.
const PRODUCTS_CACHE_KEY = 'products:all';
const PRODUCTS_CACHE_TTL_MS = 60_000; // ⚙️ НАСТРОЙКА: TTL кэша каталога, мс

/**
 * Все товары. При первом обращении заливает сид из бандла.
 * Читается через TTL-кэш изолята (cache.ts): мутации возвращённого
 * массива (sort/filter) не затрагивают кэш — cached отдаёт копию.
 */
export async function readProducts(event: H3Event): Promise<Product[]> {
  return cached(PRODUCTS_CACHE_KEY, PRODUCTS_CACHE_TTL_MS, async () => {
    const stored = await kvGetJSON<Product[]>(event, PRODUCTS_KEY);
    if (stored) return stored;
    const seed = (Array.isArray(productsSeed) ? productsSeed : []) as Product[];
    await kvPutJSON(event, PRODUCTS_KEY, seed);
    return seed;
  });
}

export async function writeProducts(event: H3Event, products: Product[]) {
  if (!Array.isArray(products)) throw new Error('Products must be an array');
  await kvPutJSON(event, PRODUCTS_KEY, products);
  // Все три маршрута админки (создание/правка/удаление) идут через эту точку,
  // поэтому одной инвалидации здесь достаточно. Кэш других изолятов устареет
  // не позже TTL — это то же окно, что и у глобальной консистентности KV.
  cacheInvalidate(PRODUCTS_CACHE_KEY);
}

export function generateUniqueSlug(
  baseSlug: string,
  existing: Product[],
  excludeId: string | null = null,
): string {
  const taken = new Set(existing.filter((p) => p.id !== excludeId).map((p) => p.slug));
  if (!taken.has(baseSlug)) return baseSlug;
  let i = 1;
  while (taken.has(`${baseSlug}-${i}`)) i++;
  return `${baseSlug}-${i}`;
}

/**
 * Нормализует категории из любого поддерживаемого формата → массив строк:
 *   categories: ['Электроника']         — массив строк
 *   categories: [{ name: 'Электроника' }] — массив объектов { name }
 *   categories: 'Электроника, Техника'  — строка через запятую (CSV)
 *   categoriesInput: '...'              — алиас CSV (старая форма админки)
 * Пробелы по краям срезаются, пустые элементы отбрасываются, дубликаты
 * схлопываются (последнее вхождение сохраняет порядок первого).
 * Возвращает null, если поле вообще не пришло в теле запроса —
 * для PUT это сигнал «категории не трогаем»; для POST null трактуется
 * как пустой список и отклоняется валидацией.
 */
export function normalizeCategories(
  body: Record<string, unknown> | null | undefined,
): string[] | null {
  const raw = body?.categories ?? body?.categoriesInput;
  if (raw === undefined) return null;
  let list: string[];
  if (Array.isArray(raw)) {
    list = raw
      .map((c) => (typeof c === 'string' ? c : (c as { name?: unknown })?.name ?? ''))
      .map((c) => String(c).trim());
  } else if (typeof raw === 'string') {
    list = raw.split(',').map((c) => c.trim());
  } else {
    list = [];
  }
  const seen = new Set<string>();
  return list.filter((c) => {
    if (!c) return false;
    if (seen.has(c)) return false;
    seen.add(c);
    return true;
  });
}

export async function getProductBySlug(event: H3Event, slugOrId: string): Promise<Product | null> {
  const products = await readProducts(event);
  return products.find((p) => p.slug === slugOrId || String(p.id) === slugOrId) ?? null;
}

export async function getSimilarProducts(
  event: H3Event,
  current: Product,
  limit = 4,
): Promise<Product[]> {
  if (!current.categories?.length) return [];
  const products = await readProducts(event);
  return products
    .filter(
      (p) =>
        String(p.id) !== String(current.id) &&
        p.categories?.some((c) => current.categories.includes(c)),
    )
    .slice(0, limit);
}