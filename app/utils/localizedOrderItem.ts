// app/utils/localizedOrderItem.ts
// ── Локализация позиций заказа (ЛК /user/orders, админка /admin/orders) ──
//
// Позиция заказа — СЕРВЕРНЫЙ снапшот на момент покупки: живой товар мог
// быть переименован или удалён, поэтому локализовать через localizedProduct
// по id нельзя (нет джойна с каталогом). Вместо этого createOrder кладёт
// в позицию переводы названия (nameEn/nameEs) и метки варианта
// (variantNameEn/variantNameEs) вместе с русскими базовыми полями —
// контракт как у товаров: перевода нет/пусто → фолбэк на русский name.
// Старые заказы (до появления снапшотов) показывают русское название —
// валидно по тому же контракту, миграция KV не требуется.
//
// Файл в app/utils (не shared/): утилита нужна только витринным страницам;
// сервер сам решает, что класть в снапшот (server/lib/orderHelpers.ts).

// Суффиксы полей-переводов. ru отсутствует: русский текст живёт в базовых
// полях, для него возвращаем их как есть.
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

/** Базовый вид позиции заказа — ровно те поля, которые читают функции. */
export interface LocalizableOrderItem {
  name: string;
  nameEn?: string;
  nameEs?: string;
  variantName?: string | null;
  variantNameEn?: string | null;
  variantNameEs?: string | null;
}

/** Название позиции на языке locale (en/es) с фолбэком на русский name. */
export function localizedOrderItemName<T extends LocalizableOrderItem>(
  item: T | null | undefined,
  locale: string,
): string {
  if (!item) return '';
  const suffix = LOCALE_FIELD_SUFFIX[locale];
  if (!suffix) return item.name;
  return nonEmpty(item[`name${suffix}`]) ?? item.name;
}

/** Метка варианта позиции (цвет/память) с фолбэком на variantName;
 *  варианта нет (null/пусто) → ''. */
export function localizedOrderVariantName<T extends LocalizableOrderItem>(
  item: T | null | undefined,
  locale: string,
): string {
  if (!item) return '';
  const base = nonEmpty(item.variantName);
  if (!base) return '';
  const suffix = LOCALE_FIELD_SUFFIX[locale];
  if (!suffix) return base;
  return nonEmpty(item[`variantName${suffix}`]) ?? base;
}
