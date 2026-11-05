// server/lib/productHelpers.ts
import type { H3Event } from 'h3';
import { kvGetJSON, kvPutJSON } from './storage';
import productsSeed from '../data/products.json';
import migratedPhotos from './migratedPhotos.json';
import photoReplacementsJson from './photoReplacements.json';

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

// ── Правдоподобные фото (пересборка несоответствующих картинок) ──────────
//
// У части товаров в сиде и live-KV оказались фото, не соответствующие
// названию товара (пылесос → рис, монитор → камера Polaroid и т.п.).
// Скачаны правдоподобные аналоги (см. photoReplacements.json: ключ —
// productId, значение — карта «старое имя файла → новый локальный путь»).
// Как и миграция Unsplash, применяется ТОЛЬКО в памяти при выдаче: live-KV
// содержит старые пути, но после следующей админ-правки товар уйдёт в KV
// уже с новыми путями — без ручных операций и без перезаписи KV целиком.
const PHOTO_PATH_REPLACEMENTS = photoReplacementsJson as Record<string, Record<string, string>>;

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
  const forProduct = (p: Product): ((url: unknown) => unknown) => {
    const map = PHOTO_PATH_REPLACEMENTS[p?.id];
    return (url: unknown): unknown => {
      // 1) миграция Unsplash → локальные пути (для скачанных/мёртвых фото)
      const id = photoIdOf(url);
      let cur: unknown = url;
      if (id) {
        if (MIGRATED_PHOTO_IDS.has(id)) cur = `/images/products/${id}.webp`;
        else {
          const replacement = DEAD_PHOTO_REPLACEMENTS[id];
          if (replacement) cur = `/images/products/${replacement}.webp`;
        }
      }
      // 2) замена несоответствующих фото на правдоподобные (per-product)
      if (map && typeof cur === 'string') {
        const base = cur.split('/').pop();
        const better = base ? map[base] : undefined;
        if (better) return better;
      }
      return cur;
    };
  };
  for (const p of products) {
    if (!p || typeof p !== 'object') continue;
    const swap = forProduct(p);
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
  // Зачёркнутая «цена до скидки» для бейджа −% на витрине.
  // Должна быть БОЛЬШЕ price: цена корзины/заказов всегда считается от
  // price (скидка уже внутри), поэтому поле — чисто витринное.
  // Отсутствует/undefined → товар без скидки.
  oldPrice?: number;
  image: string;
  gallery: string[];
  categories: string[];
  inStock: boolean;
  stockQuantity: number;
  characteristics: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  // ── Необязательные переводы (этап i18n-2) ─────────────────────────
  // Русский текст живёт в базовых полях; переводы — в полях с суффиксом.
  // Нет перевода → витрина показывает русский (фолбэк в
  // shared/utils/localizedProduct.ts). Пустая строка в KV недопустима:
  // нормализация заменяет её на удаление поля (см. extractLocalizedPatch).
  nameEn?: string;
  nameEs?: string;
  descriptionEn?: string;
  descriptionEs?: string;
  // Параллельные массивы к categories: элемент i переводит categories[i]
  categoriesEn?: string[];
  categoriesEs?: string[];
  // ── Варианты (цвет/память/размер, этап variants) ────────────────────
  // Контракт: variants[0].price === price (базовая цена = «от», карточки
  // каталога и быстрый «+» работают с первым вариантом); остаток варианта
  // не задан → наследуется от товара; price варианта не задан → базовая.
  variantName?: string;
  variantNameEn?: string;
  variantNameEs?: string;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  name: string;
  nameEn?: string;
  nameEs?: string;
  price?: number;
  image?: string;
  inStock?: boolean;
  stockQuantity?: number;
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
    // локальные пути; сидовые варианты доливаем товарам без них.
    // KV НЕ перезаписываем (гонка read-modify-write);
    // в KV новые пути/варианты доезжают при следующей админ-правке (writeProducts).
    migrateProductImages(stored);
    migrateSeedVariants(stored);
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
      .map((c) => (typeof c === 'string' ? c : ((c as { name?: unknown })?.name ?? '')))
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

// ── Варианты товара (цвет/память/размер) ─────────────────────────────
//
// Тело админ-запросов — недоверенный ввод: приводим к ProductVariant,
// отбрасывая мусор. Правила:
//   id   — непустая строка ≤ 80 (уникальность в рамках товара проверяет
//          вызывающая сторона; дубликаты выкидываем здесь);
//   name — непустая строка ≤ 120 (+ nameEn/nameEs ≤ 120);
//   price — конечное число 0..10^9, иначе поле не задаётся (наследуется);
//   image — строка ≤ 500 (путь или URL), иначе не задаётся;
//   stockQuantity — целое 0..10^6, иначе наследуется от товара;
//   inStock — boolean.
// Пустой/битый вход → undefined (вариантов у товара нет).

const VARIANT_MAX = 50;

function variantString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : undefined;
}

export function sanitizeVariants(input: unknown): ProductVariant[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: ProductVariant[] = [];
  const seenIds = new Set<string>();
  for (const raw of input.slice(0, VARIANT_MAX)) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const id = variantString(rec.id, 80);
    const name = variantString(rec.name, 120);
    if (!id || !name || seenIds.has(id)) continue;
    seenIds.add(id);
    const variant: ProductVariant = { id, name };
    const nameEn = variantString(rec.nameEn, 120);
    if (nameEn) variant.nameEn = nameEn;
    const nameEs = variantString(rec.nameEs, 120);
    if (nameEs) variant.nameEs = nameEs;
    if (
      typeof rec.price === 'number' &&
      Number.isFinite(rec.price) &&
      rec.price >= 0 &&
      rec.price <= 1e9
    ) {
      variant.price = rec.price;
    }
    const image = variantString(rec.image, 500);
    if (image) variant.image = image;
    if (
      typeof rec.stockQuantity === 'number' &&
      Number.isInteger(rec.stockQuantity) &&
      rec.stockQuantity >= 0 &&
      rec.stockQuantity <= 1e6
    ) {
      variant.stockQuantity = rec.stockQuantity;
    }
    if (typeof rec.inStock === 'boolean') variant.inStock = rec.inStock;
    out.push(variant);
  }
  return out.length > 0 ? out : undefined;
}

/** Метка оси вариантов («Цвет»/«Память») с той же гигиеной ввода. */
export function sanitizeVariantLabel(value: unknown): string | undefined {
  return variantString(value, 60);
}

/**
 * Скидочная «цена до скидки» (oldPrice) из недоверенного ввода.
 * Правила (санитайзер, не валидатор — битое значение не ломает сохранение):
 *   конечное число > 0 и > price → число (скидка имеет смысл);
 *   всё прочее (null, '', мусор, 0, <= price) → undefined (без скидки).
 * Целочисленность не требуем: копейки возможны, витрина округлит форматом.
 * Верхний предел — как у price (1e9).
 */
export function sanitizeOldPrice(input: unknown, price: number): number | undefined {
  const value = typeof input === 'string' && input.trim() !== '' ? Number(input) : input;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value <= 0 || value <= price || value > 1e9) return undefined;
  return value;
}

/**
 * Доливает сидовые варианты товарам без них — ТОЛЬКО В ПАМЯТИ (тот же
 * паттерн, что migrateProductImages: readProducts нельзя писать в KV —
 * гонка read-modify-write; в KV данные доезжают при следующей админ-правке,
 * а заказы и витрина работают с merged-видом сразу).
 *
 * Зачем: каталог живёт в KV и был засеян ДО появления вариантов —
 * обновление сида само по себе прод не видит. Правила слияния:
 *  · товар уже с вариантами → не трогаем (админские правки главнее);
 *  · в сиде варианта нет → не трогаем;
 *  · variants[0].price = ЖИВАЯ базовая цена товара (контракт «базовая = от»,
 *    если админ менял цену — сидовые абсолюты не перебивают её).
 */
export function migrateSeedVariants(products: Product[]): void {
  const seed = (Array.isArray(productsSeed) ? productsSeed : []) as Product[];
  const seedBySlug = new Map(seed.map((s) => [s.slug, s]));
  for (const product of products) {
    if (product.variants?.length) continue;
    const seedProduct = seedBySlug.get(product.slug);
    if (!seedProduct?.variants?.length) continue;
    if (seedProduct.variantName && !product.variantName) {
      product.variantName = seedProduct.variantName;
    }
    if (seedProduct.variantNameEn && !product.variantNameEn) {
      product.variantNameEn = seedProduct.variantNameEn;
    }
    if (seedProduct.variantNameEs && !product.variantNameEs) {
      product.variantNameEs = seedProduct.variantNameEs;
    }
    product.variants = seedProduct.variants.map((v, index) =>
      index === 0 ? { ...v, price: product.price } : { ...v },
    );
  }
}

// ── Локализованные поля товара (nameEn/…/categoriesEs) ───────────────
//
// PUT/POST принимают переводы тем же контрактом, что и базовые поля.
// Семантика для PUT (частичное обновление):
//   поле отсутствует в теле → не трогаем;
//   null / '' / пробелы    → перевод УДАЛЯЕТСЯ из записи (фолбэк на ru);
//   непустая строка        → trim + лимит длины, сохраняем.
// Для POST «не трогаем» = поле просто не попадает в новую запись.

const LOCALIZED_TEXT_FIELDS = ['nameEn', 'nameEs', 'descriptionEn', 'descriptionEs'] as const;

const LOCALIZED_TEXT_LIMITS: Record<(typeof LOCALIZED_TEXT_FIELDS)[number], number> = {
  nameEn: 200,
  nameEs: 200,
  descriptionEn: 5000,
  descriptionEs: 5000,
};

const LOCALIZED_CATEGORY_FIELDS = ['categoriesEn', 'categoriesEs'] as const;

function normalizeLocalizedText(
  body: Record<string, unknown> | null | undefined,
  field: (typeof LOCALIZED_TEXT_FIELDS)[number],
): string | null | undefined {
  const raw = body?.[field];
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, LOCALIZED_TEXT_LIMITS[field]);
}

/** Нормализация переводных категорий: те же форматы, что normalizeCategories
 *  (массив строк / [{name}] / CSV-строка). Пустой результат = очистка
 *  перевода (null), а не ошибка — в отличие от обязательных базовых
 *  категорий. */
function normalizeLocalizedCategories(
  body: Record<string, unknown> | null | undefined,
  field: (typeof LOCALIZED_CATEGORY_FIELDS)[number],
): string[] | null | undefined {
  const raw = body?.[field];
  if (raw === undefined) return undefined;
  if (raw === null) return null;

  let list: unknown[];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'string') {
    list = raw.split(',');
  } else {
    return null;
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of list) {
    const value =
      typeof item === 'string'
        ? item.trim()
        : String((item as { name?: unknown })?.name ?? '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value.slice(0, 100));
  }
  return result.length > 0 ? result : null;
}

/**
 * Патч локализованных полей из тела запроса. Ключи со значением null
 * означают «удалить перевод из записи» — раскрывает applyLocalizedPatch.
 * Поля, не пришедшие в теле, в патч не попадают (PUT их не трогает).
 */
export function extractLocalizedPatch(
  body: Record<string, unknown> | null | undefined,
): Record<string, string | string[] | null> {
  const patch: Record<string, string | string[] | null> = {};
  for (const field of LOCALIZED_TEXT_FIELDS) {
    const value = normalizeLocalizedText(body, field);
    if (value !== undefined) patch[field] = value;
  }
  for (const field of LOCALIZED_CATEGORY_FIELDS) {
    const value = normalizeLocalizedCategories(body, field);
    if (value !== undefined) patch[field] = value;
  }
  return patch;
}

/** Применяет патч к записи товара: null удаляет поле, остальное — присваивает.
 *  Возвращает НОВЫЙ объект (записи каталога не мутируются на месте).
 *  Ограничение object, а не Record<string, unknown>: интерфейсы (Product и
 *  контентные записи siteContent) не имеют index-сигнатуры; доступ к полям —
 *  через Record-вид. */
export function applyLocalizedPatch<ProductType extends object>(
  product: ProductType,
  patch: Record<string, string | string[] | null>,
): ProductType {
  // Спред дженерика не имеет index-сигнатуры — приводим к Record-виду явно
  const result = { ...product } as Record<string, unknown>;
  for (const [field, value] of Object.entries(patch)) {
    if (value === null) delete result[field];
    else result[field] = value;
  }
  return result as ProductType;
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
