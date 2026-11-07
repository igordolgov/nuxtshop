// app/utils/categorySuggestions.ts
// ── Локализованные подсказки категорий в админке ──────────────────────────
//
// Справочник категорий — СЫРЫЕ русские значения из KV (контракт витрины:
// фильтры матчят сырые значения). Переводы живут на товарах параллельными
// массивами (categoriesEn[i] → categories[i]); карта «сырое значение →
// перевод» строится buildCategoryLabelMap (app/utils/localizedProduct.ts).
//
// Пикер категорий в модалках админки на вкладках en/es показывает
// подсказки в языке вкладки: каждое сырое значение заменяется переводом,
// непереведённые (не встречаются ни в одном товаре с переводом) остаются
// сырыми — тот же фолбэк, что у витрины. Базовая вкладка (ru) показывает
// сырые значения как есть.
//
// Чистая функция без зависимостей от Vue/Nuxt — тестируется в vitest.

export function localizedCategorySuggestions(
  allCategories: readonly string[],
  labelMap: ReadonlyMap<string, string> | null | undefined,
): string[] {
  if (!labelMap || labelMap.size === 0) return [...allCategories];
  const out = allCategories.map((raw) => labelMap.get(raw) ?? raw);
  // Коллизия переводов (два сырых значения → один перевод) не дублирует строку
  return [...new Set(out)];
}
