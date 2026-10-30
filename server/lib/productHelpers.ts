// server/lib/productHelpers.ts
import type { H3Event } from 'h3';
import { kvGetJSON, kvPutJSON } from './storage';
import productsSeed from '../data/products.json';
import migratedPhotos from './migratedPhotos.json';

const PRODUCTS_KEY = 'data:products';

// ── Локальные фото каталога (переезд с hotlink Unsplash) ────────────────
//
// Фото из сида скачаны в /images/products/<photo-id>.webp (см. манифест).
// Живой каталог лежит в KV и туда попали ещё ДО миграции — URL в KV
// остаются unsplash. Менять KV на лету при чтении нельзя (read-modify-write
// гонки — см. историю с удалённым кэшем изолята), поэтому старые
// unsplash-URL для скачанных фото подменяются ТОЛЬКО в памяти при выдаче
// (migrateProductImages). При следующей админ-правке товар уйдёт в KV уже
// с локальным путём — данные сходятся без единой ручной операции.

const MIGRATED_PHOTO_IDS = new Set(migratedPhotos as readonly string[]);
const PHOTO_ID_RE = /(?:^|images\.unsplash\.com\/)(photo-\d+-[a-f0-9]+)/;

// Фото, удалённые с Unsplash (выдача отдаёт 404 — битая картинка на проде),
// заменяем на живые аналоги, файлы которых скачаны в /images/products/.
// Ключ — мёртвый photo-id, значение — живой.
const DEAD_PHOTO_REPLACEMENTS: Record<string, string> = {
  // Галерея «Игровая консоль PlayStation 5»: оригинал удалён с Unsplash.
  'photo-1558618666-fcd25856cd25': 'photo-1607853202273-797f1c22a38e',
};

/**
 * photo-id из unsplash-URL или голого «photo-…»; null для data-URI
 * и локальных путей.
 */
export function photoIdOf(url: unknown): string | null {
  if (typeof url !== 'string' || url.startsWith('data:') || url.startsWith('/')) return null;
  return url.match(PHOTO_ID_RE)?.[1] ?? null;
}

/**
 * Заменяет unsplash-URL товаров на локальные /images/products/<id>.webp
 * для всех фото из манифеста скачанных; фото, удалённые с Unsplash,
 * заменяются живым аналогом из DEAD_PHOTO_REPLACEMENTS. Мутирует массив
 * на месте (readProducts отдаёт свежую копию из KV, writeProducts пишет
 * после валидации — внешних держателей ссылки нет).
 */
export function migrateProductImages(products: Product[]): void {
  const swap = (url: unknown): unknown => {
    const id = photoIdOf(url);
    if (!id) return url;
    if (MIGRATED_PHOTO_IDS.has(id)) return `/images/products/${id}.webp`;
    const replacement = DEAD_PHOTO_REPLACEMENTS[id];
    return replacement ? `/images/products/${replacement}.webp` : url;
  };
  for (const p of products) {
    if (!p || typeof p !== 'object') continue;
    p.image = swap(p.image) as Product['image'];
    if (Array.isArray(p.gallery)) p.gallery = p.gallery.map(swap) as Product['gallery'];
  }
}

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

// ⚠️ TTL-кэш каталога УДАЛЁН (раньше: cached('products:all', 60_000) из
// ./cache — кэш в памяти изолята Cloudflare Workers).
//
// Почему он ломал склад: вебхук Telegram, витрина и админка попадают в
// РАЗНЫЕ изоляты, и каждый держал свою копию каталога до 60 секунд
// (cacheInvalidate сбрасывает кэш только в «своём» изоляте). Любая правка
// каталога — это read-modify-write: изолят со старой копией в памяти
// записывал её ЦЕЛИКОМ обратно в KV и затирал списания, сделанные другим
// изолятом. Со стороны это выглядело как «склад не меняется при
// подтверждении заказа» — при том что writeProducts отрабатывал без ошибок.
//
// Теперь readProducts всегда читает KV напрямую. Для каталога в десятки —
// сотни товаров это 1–2 чтения KV на запрос, что свободно укладывается в
// лимиты бесплатного тарифа (100 000 чтений/день). Плата за честность
// данных оправдана. Если лимиты чтений когда-нибудь станут проблемой,
// правильное решение — не кэш-в-изоляте, а единая точка записи
// (D1 или Durable Object) с транзакционным read-modify-write.

/**
 * Все товары. При первом обращении заливает сид из бандла.
 *
 * ⚠️ Всегда СВЕЖЕЕ чтение KV, без кеша: все мутирующие каталог сценарии
 * (списание склада в orderHelpers при подтверждении, админка, bulk)
 * начинаются с этого чтения — оно обязано видеть правки, сделанные
 * другими изолятами, иначе read-modify-write вернёт устаревший массив
 * и затрёт их при записи.
 */
export async function readProducts(event: H3Event): Promise<Product[]> {
  const stored = await kvGetJSON<Product[]>(event, PRODUCTS_KEY);
  if (stored) {
    // Самоисцеление live-данных: unsplash-URL скачанных фото отдаём как
    // локальные пути. KV НЕ перезаписываем (гонка read-modify-write);
    // в KV новые пути доезжают при следующей админ-правке (writeProducts).
    migrateProductImages(stored);
    return stored;
  }
  const seed = (Array.isArray(productsSeed) ? productsSeed : []) as Product[];
  migrateProductImages(seed);
  await kvPutJSON(event, PRODUCTS_KEY, seed);
  return seed;
}

/**
 * Единственная точка записи каталога: пишет массив ЦЕЛИКОМ в KV.
 * Вызов cacheInvalidate() больше не нужен — кэша нет. Метод оставлен,
 * чтобы все записи каталога по-прежнему шли через одну проверенную
 * точку (валидация «это точно массив товаров»).
 */
export async function writeProducts(event: H3Event, products: Product[]) {
  if (!Array.isArray(products)) throw new Error('Products must be an array');
  // Страховка: кто бы ни пришёл с записью, в KV уходят локальные пути
  // (для скачанных фото) — hotlink Unsplash не возвращается в данные.
  migrateProductImages(products);
  await kvPutJSON(event, PRODUCTS_KEY, products);
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