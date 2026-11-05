// app/utils/specTranslations.ts
// ── Предзаполнение переводных spec-листов (вкладки EN/ES редактора) ─────
//
// Контракт данных (server/lib/productHelpers.ts): характеристики —
// Record<название, значение>; переводы characteristicsEn/Es — цельная
// копия списка на своём языке. Пусто/нет записи → витрина фолбэкится
// на русский characteristics (известные лейблы дополнительно переводит
// словарь specLabels.*).
//
// Проблема, которую решает mergeSpecRows: пустой редактор перевода —
// переводить «с нуля» тяжело, админ пропускает вкладку, и иностранный
// покупатель видит русские значения. Поэтому при открытии модалки
// переводной список ПРЕДЗАПОЛНЯЕТСЯ русскими строками — админ переводит
// на месте (название/значение), а не набиривает заново.
//
// Правила слияния (позиционное, как categoriesEn[i] → categories[i]):
//   saved[i] есть  → берём сохранённый перевод (правки админа не затираем);
//   saved[i] нет   → русская строка (предзаполнение, в т.ч. новые строки,
//                     добавленные в русский список после прошлого перевода);
//   saved длиннее  → хвост сохранённого остаётся (строки, добавленные
//                     админом прямо в переводе).

/** Пара «название — значение» spec-листа (форма редактора). */
export interface SpecPair {
  label: string;
  value: string;
}

/** Record характеристик (KV-форма) → массив пар для редактора. */
export function toSpecPairs(record: Record<string, unknown> | null | undefined): SpecPair[] {
  if (!record || typeof record !== 'object') return [];
  return Object.entries(record).map(([label, value]) => ({ label, value: String(value ?? '') }));
}

/**
 * Предзаполнение переводного списка: сохранённые переводы по позициям,
 * недостающее — русский список, хвост перевода (свои строки админа)
 * сохраняется. Чистая функция — вызывается при инициализации модалок.
 */
export function mergeSpecRows(saved: SpecPair[], base: SpecPair[]): SpecPair[] {
  const rows: SpecPair[] = [];
  const len = Math.max(saved.length, base.length);
  for (let i = 0; i < len; i++) rows.push(saved[i] ?? base[i]);
  return rows;
}
