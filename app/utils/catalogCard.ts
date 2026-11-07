// app/utils/catalogCard.ts
// Карточный слепок CatalogProduct: белый список полей для SSR-payload.
//
// Зачем: useAsyncData главной кладёт ВЕСЬ каталог в payload страницы
// (151 КБ из 303 КБ HTML). Половина веса — поля, которые витрина на
// странице каталога не читает: галереи товара (45 КБ) и характеристики
// в трёх локалях (25 КБ) нужны карточке товара, сравнению и админке,
// но не карточкам каталога. На сервере state обрезается до белого
// списка, клиент после гидратации добирает полные данные фоновым
// запросом (ensureFullProducts в useProducts).
//
// Белый список вместо чёрного: новые тяжёлые поля сервера по умолчанию
// НЕ попадут в payload, пока кто-то явно не добавит их сюда.

import type { CatalogProduct } from '~/composables/catalogProduct';

export const CATALOG_CARD_FIELDS = [
  'id',
  '_id',
  'slug',
  'name',
  'nameEn',
  'nameEs',
  'description',
  'descriptionEn',
  'descriptionEs',
  'price',
  'oldPrice',
  'image',
  'inStock',
  'stockQuantity',
  'categories',
  'categoriesEn',
  'categoriesEs',
  'rating',
  // Варианты: добавление в корзину прямо из карточки каталога
  'variants',
  'variantName',
  'variantNameEn',
  'variantNameEs',
  'isFavorite',
  'createdAt',
  'updatedAt',
] as const;

export type CatalogCardProduct = Pick<CatalogProduct, (typeof CATALOG_CARD_FIELDS)[number]>;

/** Карточный слепок товара: только поля витрины каталога. */
export const toCatalogCardProduct = (product: CatalogProduct): CatalogCardProduct => {
  const card: Record<string, unknown> = {};
  for (const field of CATALOG_CARD_FIELDS) {
    const value = (product as unknown as Record<string, unknown>)[field];
    if (value !== undefined) card[field] = value;
  }
  return card as unknown as CatalogCardProduct;
};

/** Похоже ли, что товар — карточный слепок (без характеристик и галереи).
 *  Эвристика: у «простого» полного товара характеристик тоже может не быть —
 *  тогда лишний ensureFullProducts просто дедуплицируется, хуже не будет. */
export const isFullCatalogProduct = (product?: CatalogProduct | null): boolean =>
  !!product && ('characteristics' in product || 'gallery' in product);

// ── Приоритет загрузки картинок карточек каталога ────────────────────────
//
// Сетка витрины: на мобильном 2 колонки → первый ряд (карточки 0–1) целиком
// в первом экране; карточки 2–3 (второй ряд) обычно НИЖЕ фолда. На десктопе
// первый ряд — 4–5 карточек. Раньше fetchpriority=high получали все первые
// 4: на мобильном две картинки ниже фолда конкурировали за трафик с
// LCP-картинкой первого ряда и оттягивали её загрузку.

/** loading картинки карточки по её позиции в списке: первый ряд (4 шт.,
 *  видимый без скролла на десктопе) — eager, остальное — lazy. */
export const catalogCardImageLoading = (index: number): 'eager' | 'lazy' =>
  index >= 0 && index < 4 ? 'eager' : 'lazy';

/** fetchpriority картинки карточки: первые 2 (мобильный первый экран) —
 *  high, вторые 2 (второй ряд) — auto (eager без форса), дальше — low. */
export const catalogCardImagePriority = (index: number): 'high' | 'auto' | 'low' => {
  if (index >= 0 && index < 2) return 'high';
  if (index >= 2 && index < 4) return 'auto';
  return 'low';
};
