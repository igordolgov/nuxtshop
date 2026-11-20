// app/utils/specFacets.ts
// ── Фасетные фильтры по характеристикам (паттерн маркетплейсов) ──────────
//
// ЧИСТЫЕ функции без Vue/Nuxt: используются в useFilters (каталог) и
// в юнит-тестах (окружение vitest — node, без DOM).
//
// Модель: характеристики товара — Record<лейбл, значение> (русские тексты
// в KV; на en/es витрина видит переводной spec-лист из characteristicsEn/Es
// — localizedProduct подставляет его ДО фасетизации, поэтому фасеты строятся
// по тем же записям, что видит покупатель: на испанской витрине значения
// «Azul», на русской — «синий»).
//
// Семантика маркетплейсов (WB/Ozon):
// - выбор ВНУТРИ одной характеристики — ИЛИ (любое из отмеченных значений);
// - выбор МЕЖДУ характеристиками — И (товар обязан иметь каждое отмеченное
//   свойство с подходящим значением);
// - счётчики значений считаются по товарам, прошедшим ВСЕ прочие фильтры
//   (категория/поиск/цена/наличное), но БЕТ собственного выбора фасета —
//   поэтому счётчик выбранного значения не обнуляется.
//
// Шумодав: лейблы со свободным текстом («Экран: 6,1" AMOLED…») дают
// уникальные значения, которые бесполезны как фильтр. Если у лейбла больше
// MAX_UNIQUE_VALUES разных значений — в фасет попадают только значения,
// встречающиеся у 2+ товаров; группа без таких значений отбрасывается.
//
// Неразличающиеся характеристики: у группы ЕДИНСТВЕННОЕ значение
// («Бренд» один на всех; «GPS» — один вариант, даже если заполнена не
// у всех) — выбирать не из чего, группа не выводится независимо от
// охвата. Группа с выбранным значением не скрывается никогда:
// отмеченное надо уметь снять.

/** Выбор покупателя: лейбл характеристики → отмеченные значения. */
export type SpecSelection = Record<string, string[]>;

/** Группа фасета: лейбл, сколько товаров вообще имеет эту характеристику, значения. */
export interface SpecFacetGroup {
  label: string;
  productCount: number;
  values: SpecFacetValue[];
}

/** Одно значение фасета и сколько товаров в текущей выборке его имеют. */
interface SpecFacetValue {
  value: string;
  count: number;
}

/** Структурный тип входа: локализованная запись товара (нужен только spec-лист). */
type SpecSource = { characteristics?: Record<string, string> | null } | null | undefined;

/** Порог «шумного» лейбла: больше уникальных значений → остаются только count ≥ 2. */
const SPEC_MAX_UNIQUE_VALUES = 8;

/**
 * Фасеты по списку товаров текущей выборки (без учёта spec-выбора).
 * Выбранные значения и лейблы, выпавшие из выборки (смена категории
 * обнулила счётчики), восстанавливаются с count 0 — иначе отмеченное
 * нельзя снять. Сортировка: значения — по убыванию счётчика, лейблы —
 * по охвату (сколько товаров имеют характеристику).
 */
export const buildSpecFacets = (
  products: SpecSource[],
  selected: SpecSelection = {},
): SpecFacetGroup[] => {
  if (!Array.isArray(products) || products.length === 0) return [];

  // label → value → count
  const counts = new Map<string, Map<string, number>>();
  for (const product of products) {
    const specs = product?.characteristics;
    if (!specs || typeof specs !== 'object' || Array.isArray(specs)) continue;
    for (const [label, raw] of Object.entries(specs)) {
      if (typeof raw !== 'string') continue;
      const value = raw.trim();
      if (!value) continue;
      let values = counts.get(label);
      if (!values) {
        values = new Map();
        counts.set(label, values);
      }
      values.set(value, (values.get(value) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return [];

  const safeSelected = selected && typeof selected === 'object' ? selected : {};
  const groups: SpecFacetGroup[] = [];

  for (const [label, values] of counts) {
    let list: SpecFacetValue[] = [...values.entries()].map(([value, count]) => ({
      value,
      count,
    }));
    if (values.size > SPEC_MAX_UNIQUE_VALUES) {
      list = list.filter((entry) => entry.count > 1);
    }
    // Неразличающаяся характеристика: у группы ЕДИНСТВЕННОЕ значение
    // («Бренд» один на всех; «GPS» — один вариант даже при частичной
    // заполненности) — выбирать не из чего, группа скрыта независимо
    // от охвата. Группа с выбранным значением не скрывается никогда:
    // отмеченное надо уметь снять
    const hasSelected = (safeSelected[label] ?? []).some((sel) => typeof sel === 'string' && sel);
    const productCount = [...values.values()].reduce((sum, count) => sum + count, 0);
    if (values.size <= 1 && !hasSelected) continue;
    // Выбранные значения, выпавшие из фасета (обрезка шума/смена выборки):
    // возвращаем с count 0, чтобы галочку можно было снять
    for (const sel of safeSelected[label] ?? []) {
      if (typeof sel === 'string' && sel && !list.some((entry) => entry.value === sel)) {
        list.push({ value: sel, count: 0 });
      }
    }
    if (list.length === 0) continue;
    list.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    groups.push({ label, productCount, values: list });
  }

  // Выбранные лейблы, исчезнувшие из выборки целиком: пустая группа с
  // отмеченными значениями — единственный способ их увидеть и снять
  for (const label of Object.keys(safeSelected)) {
    const wanted = (safeSelected[label] ?? []).filter(
      (value) => typeof value === 'string' && value,
    );
    if (wanted.length === 0) continue;
    if (groups.some((group) => group.label === label)) continue;
    groups.push({
      label,
      productCount: 0,
      values: wanted.map((value) => ({ value, count: 0 })),
    });
  }

  groups.sort((a, b) => b.productCount - a.productCount || a.label.localeCompare(b.label));
  return groups;
};

/**
 * Проходит ли товар по spec-выбору: И между лейблами, ИЛИ между значениями.
 * Товар без нужной лейбла не проходит (стандарт маркетплейсов). Пустой
 * выбор проходит всё.
 */
const matchSpecFilters = (product: SpecSource, selected: SpecSelection = {}): boolean => {
  if (!selected || typeof selected !== 'object') return true;
  const labels = Object.keys(selected);
  if (labels.length === 0) return true;

  const specs = product?.characteristics;
  if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return false;

  for (const label of labels) {
    const wanted = selected[label];
    if (!Array.isArray(wanted) || wanted.length === 0) continue;
    const value = specs[label];
    if (typeof value !== 'string' || !wanted.includes(value)) return false;
  }
  return true;
};

/** matchSpecFilters для списка (удобно в useFilters). */
export const filterBySpecSelection = <T extends SpecSource>(
  products: T[],
  selected: SpecSelection = {},
): T[] => products.filter((product) => matchSpecFilters(product, selected));

/** Сколько лейблов характеристики сейчас активно (для счётчика фильтров). */
export const countActiveSpecFilters = (selected: SpecSelection = {}): number => {
  if (!selected || typeof selected !== 'object') return 0;
  return Object.values(selected).filter((values) => Array.isArray(values) && values.length > 0)
    .length;
};

// ── Счётчик активных фильтров (единый источник правды) ──────────────────
//
// Один алгоритм для ВСЕХ бейджей витрины (пилюля ProductSortBar и
// пустое состояние ProductsSection). Раньше страница и SortBar считали
// по-разному: цена, равная полному диапазону каталога, для страницы —
// «не фильтр», для SortBar — активный фильтр → бейджи расходились.

/** Структурный тип фильтров каталога (нужны только перечисленные поля). */
export interface ActiveFiltersSource {
  categories?: string[];
  onlyInStock?: boolean;
  onlyFavorites?: boolean;
  specs?: SpecSelection;
  priceRange?: { min?: number | null; max?: number | null };
}

/** Структурный тип фактического диапазона цен каталога. */
export interface PriceRangeSource {
  min?: number | null;
  max?: number | null;
}

/**
 * Является ли ценовой фильтр АКТИВНЫМ: сужает фактический диапазон каталога.
 * Диапазон, совпадающий с границами каталога, ничего не фильтрует —
 * «не фильтр» (бейдж и чип согласованы).
 */
export const isPriceFilterActive = (
  priceRange: ActiveFiltersSource['priceRange'],
  actual: PriceRangeSource | null | undefined,
): boolean => {
  const min = priceRange?.min;
  const max = priceRange?.max;
  if (min === null || min === undefined) {
    if (max === null || max === undefined) return false;
    return max < (actual?.max ?? Infinity);
  }
  if (min > (actual?.min ?? -Infinity)) return true;
  return max !== null && max !== undefined && max < (actual?.max ?? Infinity);
};

/**
 * Сколько фильтров сейчас активно: категория, «в наличии», «избранное»,
 * каждая группа характеристик и ценовой фильтр (если реально сужает
 * диапазон каталога — см. isPriceFilterActive).
 */
export const countActiveFilters = (
  filters: ActiveFiltersSource | null | undefined,
  actualPriceRange: PriceRangeSource | null | undefined,
): number => {
  if (!filters || typeof filters !== 'object') return 0;

  let count = 0;
  if (filters.categories?.length > 0) count++;
  if (filters.onlyInStock) count++;
  if (filters.onlyFavorites) count++;
  count += countActiveSpecFilters(filters.specs);
  if (isPriceFilterActive(filters.priceRange, actualPriceRange)) count++;

  return count;
};

/**
 * Spec-выбор, разрешённый при текущем категорийном фильтре.
 *
 * Секция «Характеристики» выводится ТОЛЬКО когда в фильтрах выбраны
 * категории (десктоп-сайдбар и мобильная панель): категории не выбраны —
 * секция скрыта вместе с заголовком, и висящий spec-выбор было бы нечем
 * снять, пока он продолжает фильтровать каталог. Поэтому опустение
 * категорий сбрасывает выбор (паттерн маркетплейсов: зависимые фасеты
 * очищаются вместе с родительским фильтром).
 */
export const clampSpecSelection = (
  categories: string[] | null | undefined,
  specs: SpecSelection | null | undefined,
): SpecSelection => {
  if (!Array.isArray(categories) || categories.length === 0) return {};
  return specs && typeof specs === 'object' && !Array.isArray(specs) ? specs : {};
};
