// app/composables/catalogProduct.ts
// Домен каталога на клиенте: тип CatalogProduct и ЧИСТЫЕ утилиты
// (без стейта и запросов). Разбивка useProducts (этап 6): стейт и
// API-мутации остались в useProducts.ts / useProductMutations.ts,
// переиспользуемые чистые функции — здесь.

/** Товар каталога на клиенте: серверный Product + рейтинг отзывов + флаг избранного.
 *  type-alias (не interface): нужен неявный index signature для передачи в
 *  localizedProduct/buildCategoryLabelMap (T extends Record<string, unknown>). */
export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  gallery?: Array<string | null | undefined>;
  categories?: string[];
  inStock: boolean;
  stockQuantity: number;
  characteristics?: Record<string, string>;
  variants?: Array<{
    id: string | number;
    name?: string | null;
    nameEn?: string | null;
    nameEs?: string | null;
    price?: number | null;
    inStock?: boolean | null;
    stockQuantity?: number | null;
  }>;
  variantName?: string | null;
  variantNameEn?: string | null;
  variantNameEs?: string | null;
  // Локализованные поля (nameEn/…/categoriesEs) — см. productHelpers
  nameEn?: string | null;
  nameEs?: string | null;
  descriptionEn?: string | null;
  descriptionEs?: string | null;
  categoriesEn?: string[] | null;
  categoriesEs?: string[] | null;
  rating?: { count: number; average: number } | null;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
  // Legacy-поле из старых схем данных (toggleFavorite читает на всякий случай)
  _id?: string | number | null;
};

/** Фильтры каталога для filterProducts */
export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  search?: string;
}

/** Путь к картинке-плейсхолдеру для товаров без валидной картинки. */
const PLACEHOLDER = '/images/placeholder.jpg';

/**
 * Нормализует путь картинки товара: legacy-форматы (photo-… с Unsplash,
 * «images/foo.jpg» без слэша, «data:», http) → рабочий URL или плейсхолдер.
 */
export const fixImageUrl = (url?: string | null): string => {
  if (!url || url === 'null' || url === 'undefined') return PLACEHOLDER;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('photo-') || url.match(/^photo-[a-zA-Z0-9-]+/))
    return `https://images.unsplash.com/${url}`;
  if (url.includes('unsplash.com')) return url;
  if (url.startsWith('images/') || url.startsWith('products/')) return `/${url}`;
  if (url.includes('.') && !url.includes('/')) return `/images/${url}`;
  if (url.startsWith('/')) return url;
  if (url.startsWith('http')) return url;
  return PLACEHOLDER;
};

/** fixImageUrl для товара: картинка + галерея (пустые слоты выбрасываются). */
export const fixProductImages = <
  T extends { image?: string | null; gallery?: Array<string | null | undefined> | null },
>(
  product?: T | null,
): T | null => {
  if (!product) return product;
  const fixed = { ...product };
  if (fixed.image) fixed.image = fixImageUrl(fixed.image);
  if (Array.isArray(fixed.gallery)) {
    fixed.gallery = fixed.gallery
      .map((img) => fixImageUrl(img))
      .filter((img) => img && img !== PLACEHOLDER);
  }
  return fixed;
};

/** inStock выводится из stockQuantity (единый источник истины — остаток). */
export const updateProductStockStatus = <T extends { stockQuantity?: number | null }>(
  product: T,
): T & { inStock: boolean } => ({
  ...product,
  inStock: (product.stockQuantity ?? 0) > 0,
});

/**
 * Подготовка списка к localStorage: гигантские data-URI (>100 КБ) заменяются
 * плейсхолдером — квота localStorage не резиновая (см. persist в useProducts).
 */
export const cleanProductsForStorage = (list: CatalogProduct[]): CatalogProduct[] => {
  if (!Array.isArray(list)) return [];
  return list.map((product) => {
    const cleaned = { ...product };
    if (cleaned.image?.startsWith('data:') && cleaned.image.length > 100000) {
      cleaned.image = PLACEHOLDER;
    }
    if (Array.isArray(cleaned.gallery)) {
      cleaned.gallery = cleaned.gallery
        .map((img) => (img?.startsWith('data:') && img.length > 100000 ? PLACEHOLDER : img))
        .filter((img): img is string => Boolean(img));
    }
    return cleaned;
  });
};

/** Подборка по категории: без категории — весь список. */
export const catalogProductsByCategory = (
  list: CatalogProduct[],
  category?: string | null,
): CatalogProduct[] => {
  if (!category) return list;
  return list.filter((p) => p.categories?.includes(category));
};

/** Поиск по названию/описанию/категориям; пустой запрос — весь список. */
export const searchCatalogProducts = (
  list: CatalogProduct[],
  query?: string | null,
): CatalogProduct[] => {
  if (!query) return list;
  const term = query.toLowerCase();
  return list.filter(
    (p) =>
      p.name?.toLowerCase().includes(term) ||
      p.description?.toLowerCase().includes(term) ||
      p.categories?.some((c) => c.toLowerCase().includes(term)),
  );
};

/** Фильтры витрины: категория, ценовой коридор, наличие, строка поиска. */
export const filterCatalogProducts = (
  list: CatalogProduct[],
  filters: ProductFilters,
): CatalogProduct[] => {
  let filtered = list;
  if (filters.category) filtered = filtered.filter((p) => p.categories?.includes(filters.category));
  if (filters.minPrice !== undefined)
    filtered = filtered.filter((p) => p.price >= (filters.minPrice ?? 0));
  if (filters.maxPrice !== undefined)
    filtered = filtered.filter((p) => p.price <= (filters.maxPrice ?? Infinity));
  if (filters.inStock !== undefined)
    filtered = filtered.filter((p) => p.inStock === filters.inStock);
  if (filters.search) {
    const term = filters.search.toLowerCase();
    filtered = filtered.filter(
      (p) => p.name?.toLowerCase().includes(term) || p.description?.toLowerCase().includes(term),
    );
  }
  return filtered;
};

/** Сортировка копии списка по полю (name/price/date) и направлению. */
export const sortCatalogProducts = (
  list: CatalogProduct[],
  sortBy?: { field?: string; direction?: 'asc' | 'desc' },
): CatalogProduct[] => {
  if (!sortBy?.field) return list;
  const { field, direction = 'asc' } = sortBy;
  const mult = direction === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => {
    switch (field) {
      case 'name':
        return mult * a.name.localeCompare(b.name);
      case 'price':
        return mult * (a.price - b.price);
      case 'date':
        return mult * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      default:
        return 0;
    }
  });
};
