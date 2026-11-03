// app/utils/productVariants.ts
// ── Варианты товара (цвет/память/размер): чистые хелперы ────────────────
//
// Контракт данных (см. ProductVariant в server/lib/productHelpers.ts):
//   variants[0].price === product.price  — базовая цена = «от», карточки
//   каталога и быстрый «+» работают с ПЕРВЫМ вариантом;
//   price/stockQuantity варианта не заданы → наследуются от товара;
//   name/nameEn/nameEs — тот же контракт переводов, что у товара.
//
// Id корзинной позиции варианта — составной «productId::variantId»:
// сервер (orderHelpers.createOrder) разбирает его сам, отдельной сущности
// «вариант товара» в API нет. Чистые функции — юнит-тесты без Vue.

/** Минимальная форма варианта товара (зеркало ProductVariant из server/lib) */
export interface ProductVariantLike {
  id: string | number;
  name?: string | null;
  nameEn?: string | null;
  nameEs?: string | null;
  price?: number | null;
  image?: string | null;
  inStock?: boolean | null;
  stockQuantity?: number | null;
}

/** Минимальная форма товара, нужная хелперам вариантов */
export interface ProductLike {
  price?: number | null;
  inStock?: boolean | null;
  stockQuantity?: number | null;
  variants?: ProductVariantLike[] | null;
  variantName?: string | null;
  variantNameEn?: string | null;
  variantNameEs?: string | null;
}

export const VARIANT_SEPARATOR = '::';

/** Есть ли у товара варианты (непустой массив). */
export const hasVariants = (product?: ProductLike | null): boolean =>
  Array.isArray(product?.variants) && product.variants.length > 0;

/** Первый вариант (он же «вариант по умолчанию») или null. */
export const firstVariant = (product?: ProductLike | null): ProductVariantLike | null =>
  hasVariants(product) ? product.variants[0] : null;

/** Найти вариант по id; null — не найден/у товара нет вариантов. */
export const findVariant = (
  product?: ProductLike | null,
  variantId?: string | number | null,
): ProductVariantLike | null => {
  if (!variantId || !hasVariants(product)) return null;
  return product.variants.find((v) => String(v.id) === String(variantId)) ?? null;
};

/** Id корзинной позиции: «productId» или «productId::variantId». */
export const cartLineId = (
  productId: string | number,
  variantId?: string | number | null,
): string => (variantId ? `${productId}${VARIANT_SEPARATOR}${variantId}` : String(productId));

/** Разобрать составной id позиции: { productId, variantId: null|string }. */
export const parseCartLineId = (
  lineId?: string | number | null,
): { productId: string; variantId: string | null } => {
  const raw = String(lineId ?? '');
  const sep = raw.indexOf(VARIANT_SEPARATOR);
  if (sep === -1) return { productId: raw, variantId: null };
  return {
    productId: raw.slice(0, sep),
    variantId: raw.slice(sep + VARIANT_SEPARATOR.length) || null,
  };
};

/** Цена позиции: у варианта своя, иначе базовая. */
export const variantPrice = (
  product?: ProductLike | null,
  variant?: ProductVariantLike | null,
): number => variant?.price ?? product?.price ?? 0;

/**
 * Склад позиции: { inStock, stockQuantity }.
 * Вариант наследует склад товара там, где не задал свой.
 */
export const variantStock = (
  product?: ProductLike | null,
  variant?: ProductVariantLike | null,
): { inStock: boolean; stockQuantity: number } => {
  const baseQty = product?.stockQuantity ?? 0;
  const baseInStock = product?.inStock ?? false;
  if (!variant) {
    return { inStock: baseInStock && baseQty > 0, stockQuantity: baseQty };
  }
  const qty = variant.stockQuantity ?? baseQty;
  const inStock = (variant.inStock ?? baseInStock) && qty > 0;
  return { inStock, stockQuantity: qty };
};

/**
 * Локализованное название варианта: nameEn/nameEs при непустом значении,
 * иначе русская база (контракт localizedProduct).
 */
export const localizedVariantName = (
  variant?: ProductVariantLike | null,
  locale = 'ru',
): string => {
  if (!variant) return '';
  if (locale === 'en' && variant.nameEn?.trim()) return variant.nameEn.trim();
  if (locale === 'es' && variant.nameEs?.trim()) return variant.nameEs.trim();
  return variant.name || '';
};

/** Метка оси вариантов («Цвет»/«Память») с фолбэком. */
export const localizedVariantLabel = (product?: ProductLike | null, locale = 'ru'): string => {
  if (!product) return '';
  if (locale === 'en' && product.variantNameEn?.trim()) return product.variantNameEn.trim();
  if (locale === 'es' && product.variantNameEs?.trim()) return product.variantNameEs.trim();
  return product.variantName || '';
};

/**
 * Название варианта для строки корзины, замороженное в момент добавления
 * (как у product.name — существующее поведение корзины).
 */
export const cartVariantTitle = (
  variant?: ProductVariantLike | null,
  locale = 'ru',
): string | null => {
  const name = localizedVariantName(variant, locale);
  return name || null;
};
