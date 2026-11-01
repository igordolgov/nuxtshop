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

/** Суффиксы переводных полей; ru отсутствует (русский текст в базовых полях). */
const LOCALE_FIELD_SUFFIX: Record<string, string> = {
  en: 'En',
  es: 'Es',
};

/**
 * Локализованная копия товара: en/es → переводы с поэлементным фолбэком
 * на русский; ru → объект как есть. Исходные категории — в categoriesRaw.
 * Контракт данных и поведение — см. app/utils/localizedProduct.ts.
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
    nonEmpty(product[`description${suffix}`]) ??
    (product.description as T['description']);

  const rawCategories = Array.isArray(product.categories)
    ? (product.categories as string[])
    : undefined;
  const translated = product[`categories${suffix}`];

  let categories = rawCategories;
  if (Array.isArray(translated) && translated.length > 0) {
    const localizedList = (translated as unknown[]).map((item) =>
      nonEmpty(item),
    );
    if (rawCategories) {
      categories = rawCategories.map((raw, i) => localizedList[i] ?? raw);
    } else {
      categories = localizedList.filter((c): c is string => c !== null);
    }
  }

  return {
    ...product,
    name,
    description,
    categories,
    categoriesRaw: rawCategories ?? [],
  } as T;
}
