// server/lib/productHistory.ts
/**
 * История изменений товара (аудит) — постоянное хранилище KV.
 *
 * Зачем: adminActionLog (logger.ts) — in-memory изолята воркера, записи
 * теряются при рецикле и не группируются по товару. Здесь — отдельный
 * ключ KV на товар (`product-history:<id>`), список от новых к старым,
 * лимит PRODUCT_HISTORY_MAX записей.
 *
 * Что пишем: created/updated/deleted + кто (staff из requireStaff) +
 * построчный дифф полей (diffProduct) для updated. Удалённый товар
 * сохраняет свою историю: ключ живёт в KV и после удаления — видно,
 * кто и когда удалил. Запись best-effort: сбой KV не отменяет сохранение
 * товара (так же, как Telegram-уведомления в [id].put.ts).
 *
 * В nuxt dev / юнит-тестах биндингов KV нет — работает in-memory fallback
 * из storage.ts.
 */
import { kvGetJSON, kvPutJSON } from './storage';
import type { Product } from './productHelpers';

export type ProductHistoryAction = 'created' | 'updated' | 'deleted';

/** Одно поле-изменение: ключ поля (i18n на клиенте) + значения до/после */
export interface ProductHistoryChange {
  field: string;
  from: unknown;
  to: unknown;
}

/** Одна запись истории: когда, кто, что (действие + дифф полей) */
export interface ProductHistoryEntry {
  ts: string;
  actor: { id: string | number; email: string; role: string };
  action: ProductHistoryAction;
  /** Имя товара на момент действия (запись живёт и после удаления) */
  productName?: string;
  changes: ProductHistoryChange[];
}

// Лимит записей на товар: старые вытесняются новыми (KV-запись мала)
export const PRODUCT_HISTORY_MAX = 30;

const historyKey = (id: string | number): string => `product-history:${String(id)}`;

// ─── Дифф полей ─────────────────────────────────────────────────────────
// Скаляры сравниваются как есть; ''/null/undefined считаются одним и тем же
// («пусто») — старые записи KV могли хранить пустые строки переводов,
// а нормализатор удаляет такие поля: разницы для витрины нет.
//
// Порядок объектов (characteristics) не важен — ключи сортируются.
// Порядок МАССИВОВ важен: categories/gallery — параллельные переводы,
// variants[0] — базовый вариант (контракт каталога).
const EMPTY = '\u2205'; // ∅

function canonValue(v: unknown): string {
  if (v === undefined || v === null || v === '') return EMPTY;
  if (typeof v !== 'object') return String(v);
  if (Array.isArray(v)) return `[${v.map((item) => canonValue(item)).join('|')}]`;
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${k}:${canonValue((v as Record<string, unknown>)[k])}`).join(',')}}`;
}

/** Значение для показа: строка ≤120, элементы массива ≤60 (макс. 6 + «+N»),
 *  объект — компактный JSON (обрезанный). Записи должны быть маленькими. */
export function shortenValue(v: unknown): unknown {
  if (v === undefined || v === null || v === '') return null;
  const cap = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max)}…` : s);
  if (typeof v === 'string') return cap(v, 120);
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  if (Array.isArray(v)) {
    const items = v.slice(0, 6).map((item) => shortenValue(item));
    if (v.length > 6) items.push(`+${v.length - 6}`);
    return items;
  }
  try {
    return cap(JSON.stringify(v), 120);
  } catch {
    return '(объект)';
  }
}

// Поля, за которыми следит дифф. inStock не в списке: он выводится из
// stockQuantity на сервере (inStock = stockQuantity > 0); slug/updatedAt —
// производные (имя/время), дифф по ним — шум.
const SCALAR_FIELDS = [
  'name',
  'description',
  'price',
  'oldPrice',
  'image',
  'stockQuantity',
  'variantName',
  'variantNameEn',
  'variantNameEs',
  'nameEn',
  'nameEs',
  'descriptionEn',
  'descriptionEs',
] as const;

const ARRAY_FIELDS = ['categories', 'gallery', 'categoriesEn', 'categoriesEs'] as const;

const OBJECT_FIELDS = ['characteristics', 'characteristicsEn', 'characteristicsEs'] as const;

/** Построчный дифф двух версий товара (created/deleted не диффуют: у
 *  created не было «до», у deleted не важно «после»). Порядок полей
 *  стабильный — как в списке констант, для предсказуемого показа. */
export function diffProduct(before: Product | null, after: Product | null): ProductHistoryChange[] {
  const changes: ProductHistoryChange[] = [];
  const read = (p: Product | null, field: string): unknown => {
    if (!p) return undefined;
    return (p as unknown as Record<string, unknown>)[field];
  };

  for (const field of SCALAR_FIELDS) {
    const a = read(before, field);
    const b = read(after, field);
    if (canonValue(a) !== canonValue(b)) {
      changes.push({ field, from: shortenValue(a), to: shortenValue(b) });
    }
  }
  for (const field of ARRAY_FIELDS) {
    const a = read(before, field);
    const b = read(after, field);
    if (canonValue(a) !== canonValue(b)) {
      changes.push({ field, from: shortenValue(a), to: shortenValue(b) });
    }
  }
  for (const field of OBJECT_FIELDS) {
    const a = read(before, field);
    const b = read(after, field);
    if (canonValue(a) !== canonValue(b)) {
      // Record<string, string> для показа не разворачиваем — компактный JSON
      changes.push({ field, from: shortenValue(a), to: shortenValue(b) });
    }
  }
  // Варианты: массив объектов — порядок важен (variants[0] = база)
  const aV = read(before, 'variants');
  const bV = read(after, 'variants');
  if (canonValue(aV) !== canonValue(bV)) {
    changes.push({
      field: 'variants',
      from: Array.isArray(aV) ? aV.length : null,
      to: Array.isArray(bV) ? bV.length : null,
    });
  }
  return changes;
}

// ─── Запись и чтение (KV) ───────────────────────────────────────────────
/** Добавить запись в историю товара. Best-effort: ошибка не бросается —
 *  сохранение товара важнее аудита (сбой логируется в консоль воркера). */
export async function recordProductHistory(
  event: import('h3').H3Event,
  opts: {
    id: string | number;
    actor: { id: string | number; email: string; role: string };
    action: ProductHistoryAction;
    productName?: string;
    changes?: ProductHistoryChange[];
  },
): Promise<void> {
  try {
    const key = historyKey(opts.id);
    const list = (await kvGetJSON<ProductHistoryEntry[]>(event, key)) ?? [];
    const entry: ProductHistoryEntry = {
      ts: new Date().toISOString(),
      actor: {
        id: opts.actor.id,
        email: opts.actor.email,
        role: opts.actor.role,
      },
      action: opts.action,
      ...(opts.productName !== undefined ? { productName: opts.productName } : {}),
      changes: Array.isArray(opts.changes) ? opts.changes : [],
    };
    const next = [entry, ...list].slice(0, PRODUCT_HISTORY_MAX);
    await kvPutJSON(event, key, next);
  } catch (error) {
    console.warn('[product-history] запись истории не удалась:', error);
  }
}

/** История товара (новые первыми). Битое/чужое содержимое → []. */
export async function readProductHistory(
  event: import('h3').H3Event,
  id: string | number,
): Promise<ProductHistoryEntry[]> {
  const list = await kvGetJSON<unknown>(event, historyKey(id));
  if (!Array.isArray(list)) return [];
  return list.filter(
    (e): e is ProductHistoryEntry =>
      !!e &&
      typeof e === 'object' &&
      typeof (e as ProductHistoryEntry).ts === 'string' &&
      typeof (e as ProductHistoryEntry).action === 'string' &&
      Array.isArray((e as ProductHistoryEntry).changes),
  );
}
