// server/lib/bulkHelpers.ts
import { createError } from 'h3';
import { normalizeCategories, type Product } from './productHelpers';

// ============================================
// Массовые операции с товарами (bulk).
// Чистые функции без обращения к KV — эндпоинты bulk.patch.js /
// bulk.delete.js читают каталог один раз, применяют патч ко всем
// выбранным товарам и пишут каталог одной записью KV (вместо N
// последовательных PUT: N чтений, N записей, частично применённое
// состояние при ошибке на середине).
// ============================================

export interface BulkPatch {
  /** Статус наличия: true — в наличии, false — нет; undefined — не менять */
  inStock?: boolean;
  /**
   * Явное количество для статуса «В наличии». null — не менять:
   * у товаров с количеством 0 будет проставлено 1 (иначе инвариант
   * inStock = stockQuantity > 0 невозможно соблюсти).
   */
  stockQuantity?: number | null;
  /** Заменить список категорий целиком */
  setCategories?: string[];
  /** Добавить категории к текущим (без дублей) */
  addCategories?: string[];
  /** Убрать категории из текущих */
  removeCategories?: string[];
  /** Есть ли хоть одно изменение — защита от пустых запросов */
  hasChanges: boolean;
}

export interface BulkSkipped {
  id: string;
  name: string;
}

export interface BulkUpdateResult {
  /** Товары, в которых что-то изменилось (уже с новым updatedAt) */
  updated: Product[];
  /**
   * Товары, у которых НЕ тронуты категории: после операции «убрать»
   * список опустел бы, а инвариант «хотя бы одна категория» (как в
   * PUT) нарушать нельзя. Остальные изменения (наличие) к ним применены.
   */
  skipped: BulkSkipped[];
}

export interface BulkDeleteResult {
  remaining: Product[];
  deleted: Product[];
}

const bad = (message: string) => createError({ statusCode: 400, message });

/**
 * Список id из тела запроса: массив строк/чисел, трим, дедуп, мусор отбрасывается.
 * Не массив (в т.ч. undefined) — null: «ids не пришли», эндпоинт ответит 400.
 */
export function normalizeIdList(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (item === null || item === undefined) continue;
    const id = String(item).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Валидирует и нормализует тело PATCH /api/products/bulk.
 * Форматы категорий — те же, что в PUT (массив строк / CSV / [{name}]),
 * поэтому переиспользуется normalizeCategories.
 * Бросает 400 при некорректных полях (клиент показывает текст сервера).
 */
export function parseBulkPatch(
  body: Record<string, unknown> | null | undefined,
): BulkPatch {
  const patch: BulkPatch = { hasChanges: false };

  // inStock — строго boolean: JS-клиент шлёт true/false, ««1»/»yes»» — ошибка
  if (body?.inStock !== undefined) {
    if (typeof body.inStock !== 'boolean') {
      throw bad('Поле inStock должно быть true или false');
    }
    patch.inStock = body.inStock;
  }

  // stockQuantity имеет смысл только со статусом «В наличии»: отдельно
  // «проставить количество» без смены статуса не отправляем, двусмысленно
  if (body?.stockQuantity !== undefined && body?.stockQuantity !== null) {
    if (patch.inStock !== true) {
      throw bad('Количество задаётся только вместе со статусом «В наличии»');
    }
    const raw = body.stockQuantity;
    const n = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
      throw bad('Количество должно быть неотрицательным числом');
    }
    patch.stockQuantity = Math.trunc(n);
  } else {
    patch.stockQuantity = null;
  }

  const set = normalizeCategories({ categories: body?.setCategories });
  if (set !== null && set.length === 0) {
    throw bad('Укажите хотя бы одну категорию для замены');
  }
  patch.setCategories = set ?? undefined;
  patch.addCategories =
    normalizeCategories({ categories: body?.addCategories }) ?? undefined;
  patch.removeCategories =
    normalizeCategories({ categories: body?.removeCategories }) ?? undefined;

  // Три режима правки категорий взаимоисключающи — иначе непонятно,
  // что значит «заменить на X и одновременно добавить Y»
  const categoryModes = [patch.setCategories, patch.addCategories, patch.removeCategories]
    .filter((v) => v !== undefined).length;
  if (categoryModes > 1) {
    throw bad('Выберите один режим изменения категорий: заменить, добавить или убрать');
  }

  // Пустые add/remove — no-op: запрос только с ними считается
  // «без изменений» и отклоняется эндпоинтом как бессмысленный
  patch.hasChanges =
    patch.inStock !== undefined ||
    patch.stockQuantity != null ||
    [patch.setCategories, patch.addCategories, patch.removeCategories].some(
      (list) => Array.isArray(list) && list.length > 0,
    );

  return patch;
}

/**
 * Применяет патч к выбранным товарам, не мутируя входной массив.
 * Возвращает НОВЫЕ объекты изменённых товаров (updated) и список
 * пропущенных по категориям (skipped). Товары без фактических
 * изменений (значения совпали с текущими) в updated не попадают.
 */
export function applyBulkPatch(
  products: Product[],
  ids: string[],
  patch: BulkPatch,
): BulkUpdateResult {
  const idSet = new Set(ids.map(String));
  const now = new Date().toISOString();
  const updated: Product[] = [];
  const skipped: BulkSkipped[] = [];

  for (const product of products) {
    if (!idSet.has(String(product.id))) continue;

    const next: Product = { ...product };
    let changed = false;

    // ── Наличие / количество ──────────────────────────────
    // inStock всегда выводится из количества (тот же инвариант, что в PUT)
    if (patch.inStock !== undefined) {
      const quantity = patch.inStock
        ? patch.stockQuantity != null
          ? Math.max(0, patch.stockQuantity)
          : Math.max(Number(product.stockQuantity) || 0, 1)
        : 0;
      if (quantity !== product.stockQuantity) {
        next.stockQuantity = quantity;
        changed = true;
      }
      if (quantity > 0 !== product.inStock) {
        next.inStock = quantity > 0;
        changed = true;
      }
    }

    // ── Категории ─────────────────────────────────────────
    let categories: string[] | null = null;
    if (patch.setCategories) {
      categories = [...patch.setCategories];
    } else if (patch.addCategories || patch.removeCategories) {
      const remove = new Set(patch.removeCategories ?? []);
      const merged = [...(product.categories ?? [])];
      for (const c of patch.addCategories ?? []) {
        if (!merged.includes(c)) merged.push(c);
      }
      categories = merged.filter((c) => !remove.has(c));
    }

    if (categories !== null) {
      if (categories.length === 0) {
        // Инвариант «хотя бы одна категория»: этот товар пропускаем
        // по категориям (наличие всё равно применяем) и отчитываемся
        skipped.push({ id: String(product.id), name: product.name });
        categories = null;
      } else if (JSON.stringify(categories) !== JSON.stringify(product.categories ?? [])) {
        next.categories = categories;
        changed = true;
      }
    }

    if (changed) {
      next.updatedAt = now;
      updated.push(next);
    }
  }

  return { updated, skipped };
}

/** Удаляет выбранные товары, не мутируя входной массив */
export function applyBulkDelete(
  products: Product[],
  ids: string[],
): BulkDeleteResult {
  const idSet = new Set(ids.map(String));
  const remaining: Product[] = [];
  const deleted: Product[] = [];
  for (const product of products) {
    (idSet.has(String(product.id)) ? deleted : remaining).push(product);
  }
  return { remaining, deleted };
}
