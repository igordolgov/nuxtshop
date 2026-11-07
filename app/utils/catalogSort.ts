// app/utils/catalogSort.ts
// ── Сортировка каталога (чистая функция, без Vue/Nuxt) ────────────────────
//
// Используется в useFilters (sortProducts → displayedProducts) и в
// юнит-тестах (окружение vitest — node, без DOM).
//
// ИСТОРИЯ БАГА: раньше при отсутствии даты компаратор подставлял id вместо
// даты — new Date(product.createdAt || product.id). Движки парсят голые
// числа непредсказуемо: '12' → декабрь 2001, '33' → 2033 год (будущее!),
// '27'…'30' → Invalid Date. NaN в компараторе ломает инварианты сортировки
// (TimSort в V8): реально добавленный товар с честным createdAt оказывался
// 31-м из 32 при сортировке «сначала новые».
//
// КОНТРАКТ:
// - дата есть и валидна → сравнение по времени;
// - даты нет / строка не парсится → товар «без даты»: при любом направлении
//   уходит ВНИЗ (неизвестное не может быть «новейшим»);
// - тайбрейк — числовой id (больший id «новее»: сиды добавлялись по порядку).

/** Конфиг сортировки каталога (структурно совместим с CatalogSortConfig
 *  из useFilters — там свой тип с теми же полями). */
type SortableProduct = {
  id?: string | number;
  name?: string;
  price?: number | string;
  [key: string]: unknown;
};

/** Числовое значение id ('34' → 34; мусор → 0). */
const idNumber = (product: SortableProduct): number => parseInt(String(product?.id ?? ''), 10) || 0;

/** Время поля-даты или null — если даты нет или строка не парсится
 *  (раньше вместо null было непредсказуемое new Date(id)). */
const dateFieldTime = (product: SortableProduct, field: string): number | null => {
  const raw = product?.[field];
  if (typeof raw === 'string' && raw.trim()) {
    const time = new Date(raw).getTime();
    if (!Number.isNaN(time)) return time;
  }
  return null;
};

/** Тайбрейк по числовому id: desc — больший id выше, asc — меньший. */
const compareById = (a: SortableProduct, b: SortableProduct, desc: boolean): number =>
  desc ? idNumber(b) - idNumber(a) : idNumber(a) - idNumber(b);

/** Даты: валидные — по времени, «без даты» — всегда внизу списка. */
const compareByDateField = (
  a: SortableProduct,
  b: SortableProduct,
  field: string,
  desc: boolean,
): number => {
  const aTime = dateFieldTime(a, field);
  const bTime = dateFieldTime(b, field);
  if (aTime === null && bTime === null) return compareById(a, b, desc);
  if (aTime === null) return 1;
  if (bTime === null) return -1;
  const diff = aTime - bTime;
  return diff !== 0 ? (desc ? -diff : diff) : compareById(a, b, desc);
};

/**
 * Сортировка копии списка товаров по конфигу каталога.
 * Без конфига — дефолт витрины «сначала новые» (createdAt desc).
 * Поддерживаются поля: createdAt/updatedAt (даты), id/price (числовые),
 * name (строковое), прочие — сравнение строк/чисел как раньше.
 */
export const sortProductsByConfig = <T extends SortableProduct>(
  list: T[],
  config?: { field?: string; order?: string } | null,
): T[] => {
  const field = config?.field;

  if (!field) {
    return [...list].sort((a, b) => compareByDateField(a, b, 'createdAt', true));
  }

  const desc = config?.order === 'desc';

  return [...list].sort((a, b) => {
    if (field === 'createdAt' || field === 'updatedAt') {
      return compareByDateField(a, b, field, desc);
    }

    if (field === 'id') {
      return compareById(a, b, desc);
    }

    if (field === 'price') {
      const aNum = Number(a.price) || 0;
      const bNum = Number(b.price) || 0;
      return desc ? bNum - aNum : aNum - bNum;
    }

    if (field === 'name') {
      const aStr = String(a.name ?? '').toLowerCase();
      const bStr = String(b.name ?? '').toLowerCase();
      return desc ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr);
    }

    let aVal: unknown = a[field];
    let bVal: unknown = b[field];
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();

    const aCmp = aVal as string | number;
    const bCmp = bVal as string | number;
    if (aCmp < bCmp) return desc ? 1 : -1;
    if (aCmp > bCmp) return desc ? -1 : 1;
    return 0;
  });
};
