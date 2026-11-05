// shared/utils/localizedProduct.ts
// ── Локализация товарных данных (этап i18n-2: товары ru/en/es) ──────────
//
// ЧИСТАЯ функция без зависимостей от Vue/Nuxt: используется на клиенте
// (композабл useLocalizedProduct, useFilters, useAppState) и в юнит-тестах.
//
// Почему файл в app/utils, а не shared/: vite-SSR выносит модули ВНЕ
// srcDir (app/) во внешние импорты — в серверном бандле оставался сырой
// относительный путь на .ts, ломавший пререндер. Сервер использует свою
// копию server/lib/localizedProduct.ts (там nitro бандлит штатно);
// дрейф копий ловит тест 'server/app copies are in sync'.
//
// Контракт данных: товар в KV хранит русский текст в базовых полях
// (name/description/categories) и НЕОБЯЗАТЕЛЬНЫЕ переводы в полях с
// суффиксом локали (nameEn/nameEs/descriptionEn/descriptionEs/categoriesEn/
// categoriesEs). Перевода нет → фолбэк на русское значение, поэтому никакой
// миграции KV не требуется: старые записи валидны как есть.
//
// Категории — параллельные массивы: categoriesEn[i] переводит categories[i].
// Отсутствующий элемент пары (пустая строка/undefined) → элемент базового
// массива. Такой контракт позволяет админке переводить список поэлементно,
// а фильтрам каталога — продолжать матчить СЫРЫЕ значения:
// локализованная копия всегда несёт исходный список в categoriesRaw.

// Суффиксы полей-переводов. ru отсутствует: русский текст живёт в базовых
// полях, для него функция возвращает объект как есть.
const LOCALE_FIELD_SUFFIX: Record<string, string> = {
  en: 'En',
  es: 'Es',
};

/** Непустая строка → trimmed; пустая/не строка → null (сигнал фолбэка). */
function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Непустой Record характеристик → как есть; пустой/не объект/массив → null
 *  (сигнал фолбэка на русский spec-лист). */
function nonEmptySpecRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.keys(value as Record<string, unknown>).length > 0
    ? (value as Record<string, string>)
    : null;
}

/**
 * Локализованная копия товара для витрины.
 * - ru → объект как есть (нулевые накладные расходы на русский каталог);
 * - en/es → { ...product, name, description, categories, characteristics }
 *   из переводных полей с фолбэком на русский; исходный список категорий
 *   сохраняется в categoriesRaw (фильтры матчят сырые значения).
 * Переводной spec-лист (characteristicsEn/Es) цельный: есть и непуст →
 * показывается целиком (админ сам перевёл названия и значения); нет →
 * русский список (известные лейблы дополнительно переводит витрина
 * словарём specLabels.*).
 * Объект не мутируется: карточки/списки получают поверхностную копию.
 */
export function localizedProduct<T extends Record<string, unknown>>(
  product: T | null | undefined,
  locale: string,
): T {
  if (!product || typeof product !== 'object') return product as T;

  const suffix = LOCALE_FIELD_SUFFIX[locale];
  if (!suffix) return product;

  const name = nonEmpty(product[`name${suffix}`]) ?? (product.name as T['name']);
  const description =
    nonEmpty(product[`description${suffix}`]) ?? (product.description as T['description']);

  const rawCategories = Array.isArray(product.categories)
    ? (product.categories as string[])
    : undefined;
  const translated = product[`categories${suffix}`];

  let categories = rawCategories;
  if (Array.isArray(translated) && translated.length > 0) {
    const localizedList = (translated as unknown[]).map((item) => nonEmpty(item));
    if (rawCategories) {
      // Параллельный массив: перевод по индексу, пропуски → русский элемент
      categories = rawCategories.map((raw, i) => localizedList[i] ?? raw);
    } else {
      categories = localizedList.filter((c): c is string => c !== null);
    }
  }

  // Spec-лист: цельный переводной Record или фолбэк на русский
  const localizedSpecs = nonEmptySpecRecord(product[`characteristics${suffix}`]);
  const characteristics = localizedSpecs ?? (product.characteristics as T['characteristics']);

  return {
    ...product,
    name,
    description,
    categories,
    characteristics,
    categoriesRaw: rawCategories ?? [],
  } as T;
}

/**
 * Карта «сырая категория → локализованная» из списка товаров.
 * Источник пары — каждый товар (categories[i] ↔ categoriesEn[i]/categoriesEs[i]).
 * Используется чипами фильтров каталога: значения фильтров остаются сырыми
 * (текст из KV), а подписи чипов локализуются. Категории без перевода
 * фолбэкаются на сырые — карта это переживает.
 */
export function buildCategoryLabelMap(
  products: Array<Record<string, unknown>> | null | undefined,
  locale: string,
): Map<string, string> {
  const map = new Map<string, string>();
  const suffix = LOCALE_FIELD_SUFFIX[locale];
  if (!suffix || !Array.isArray(products)) return map;

  for (const product of products) {
    if (!product || typeof product !== 'object') continue;
    const raw = product.categories;
    const translated = product[`categories${suffix}`];
    if (!Array.isArray(raw) || !Array.isArray(translated)) continue;
    raw.forEach((rawCat, i) => {
      if (typeof rawCat !== 'string' || !rawCat) return;
      const label = nonEmpty(translated[i]);
      if (label && !map.has(rawCat)) map.set(rawCat, label);
    });
  }
  return map;
}
