// server/lib/localizedProduct.ts
// ── Серверная копия shared/utils/localizedProduct.ts ────────────────────
//
// Чистая функция локализации товара нужна и серверу (JSON-LD карточки
// в server/api/product/[slug].js), и клиенту (shared/utils/localizedProduct.ts,
// композабл useLocalizedProduct).
//
// Почему КОПИЯ, а не импорт из shared/: nitro (Nuxt 4.6, preset
// cloudflare-module) выносил файл из shared/ во внешний импорт с
// относительным путём от cache-buildDir (node_modules/.cache/nuxt/.nuxt) —
// путь ломался на пререндере («Could not resolve …/shared/utils/…»).
// externals.inline не помог. Файл в server/ nitro бандлит штатно.
//
// ⚠️ СИНХРОНИЗАЦИЯ: при изменении контракта править ОБЕ копии. Дрейф
// ловит юнит-тест tests/unit/localized-product.test.ts (describe
// 'server/shared copies are in sync'): обе функции прогоняются на одной
// матрице фикстур и обязаны давать идентичные результаты.

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

/** Суффиксы переводных полей; ru отсутствует (русский текст в базовых полях). */
const LOCALE_FIELD_SUFFIX: Record<string, string> = {
  en: 'En',
  es: 'Es',
};

/**
 * Локализованная копия товара: en/es → переводы с фолбэком на русский;
 * ru → объект как есть. Исходные категории — в categoriesRaw. Переводной
 * spec-лист (characteristicsEn/Es) цельный: есть и непуст → показывается
 * целиком; нет → русский characteristics (контракт и поведение —
 * см. app/utils/localizedProduct.ts).
 */
export function localizedProduct<T extends object>(
  product: T | null | undefined,
  locale: string,
): T {
  if (product === null || product === undefined || typeof product !== 'object') {
    // Runtime-договорённость: битый вход возвращаем как есть;
    // тип T непустой, поэтому двойной каст.
    return product as unknown as T;
  }
  // Индексный доступ по вычисляемому ключу — только через Record-вид
  const rec = product as Record<string, unknown>;

  const suffix = LOCALE_FIELD_SUFFIX[locale];
  if (!suffix) return product;

  const name = nonEmpty(rec[`name${suffix}`]) ?? rec.name;
  const description = nonEmpty(rec[`description${suffix}`]) ?? rec.description;

  const rawCategories = Array.isArray(rec.categories) ? (rec.categories as string[]) : undefined;
  const translated = rec[`categories${suffix}`];

  let categories = rawCategories;
  if (Array.isArray(translated) && translated.length > 0) {
    const localizedList = (translated as unknown[]).map((item) => nonEmpty(item));
    if (rawCategories) {
      categories = rawCategories.map((raw, i) => localizedList[i] ?? raw);
    } else {
      categories = localizedList.filter((c): c is string => c !== null);
    }
  }

  // Spec-лист: цельный переводной Record (characteristicsEn/Es) или
  // фолбэк на русский characteristics — см. app/utils/localizedProduct.ts
  const localizedSpecs = nonEmptySpecRecord(rec[`characteristics${suffix}`]);
  const characteristics = localizedSpecs ?? rec.characteristics;

  return {
    ...product,
    name,
    description,
    categories,
    characteristics,
    categoriesRaw: rawCategories ?? [],
  } as T;
}
