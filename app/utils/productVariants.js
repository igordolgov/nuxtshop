// app/utils/productVariants.js
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

export const VARIANT_SEPARATOR = '::';

/** Есть ли у товара варианты (непустой массив). */
export const hasVariants = (product) =>
  Array.isArray(product?.variants) && product.variants.length > 0;

/** Первый вариант (он же «вариант по умолчанию») или null. */
export const firstVariant = (product) =>
  hasVariants(product) ? product.variants[0] : null;

/** Найти вариант по id; null — не найден/у товара нет вариантов. */
export const findVariant = (product, variantId) => {
  if (!variantId || !hasVariants(product)) return null;
  return product.variants.find((v) => String(v.id) === String(variantId)) ?? null;
};

/** Id корзинной позиции: «productId» или «productId::variantId». */
export const cartLineId = (productId, variantId) =>
  variantId ? `${productId}${VARIANT_SEPARATOR}${variantId}` : String(productId);

/** Разобрать составной id позиции: { productId, variantId: null|string }. */
export const parseCartLineId = (lineId) => {
  const raw = String(lineId ?? '');
  const sep = raw.indexOf(VARIANT_SEPARATOR);
  if (sep === -1) return { productId: raw, variantId: null };
  return { productId: raw.slice(0, sep), variantId: raw.slice(sep + VARIANT_SEPARATOR.length) || null };
};

/** Цена позиции: у варианта своя, иначе базовая. */
export const variantPrice = (product, variant) =>
  variant?.price ?? product?.price ?? 0;

/**
 * Склад позиции: { inStock, stockQuantity }.
 * Вариант наследует склад товара там, где не задал свой.
 */
export const variantStock = (product, variant) => {
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
export const localizedVariantName = (variant, locale = 'ru') => {
  if (!variant) return '';
  if (locale === 'en' && variant.nameEn?.trim()) return variant.nameEn.trim();
  if (locale === 'es' && variant.nameEs?.trim()) return variant.nameEs.trim();
  return variant.name || '';
};

/** Метка оси вариантов («Цвет»/«Память») с фолбэком. */
export const localizedVariantLabel = (product, locale = 'ru') => {
  if (!product) return '';
  if (locale === 'en' && product.variantNameEn?.trim()) return product.variantNameEn.trim();
  if (locale === 'es' && product.variantNameEs?.trim()) return product.variantNameEs.trim();
  return product.variantName || '';
};

/**
 * Название варианта для строки корзины, замороженное в момент добавления
 * (как у product.name — существующее поведение корзины).
 */
export const cartVariantTitle = (variant, locale = 'ru') => {
  const name = localizedVariantName(variant, locale);
  return name || null;
};
