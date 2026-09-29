// server/lib/productHelpers.ts
import type { H3Event } from 'h3';
import { kvGetJSON, kvPutJSON } from './storage';
import productsSeed from '../data/products.json';

const PRODUCTS_KEY = 'data:products';

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  image: string;
  gallery: string[];
  categories: string[];
  inStock: boolean;
  stockQuantity: number;
  characteristics: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

export function slugify(str: string): string {
  if (!str) return `product-${Date.now()}`;
  const slug = str
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `product-${Date.now()}`;
}

/** Все товары. При первом обращении заливает сид из бандла. */
export async function readProducts(event: H3Event): Promise<Product[]> {
  const stored = await kvGetJSON<Product[]>(event, PRODUCTS_KEY);
  if (stored) return stored;
  const seed = (Array.isArray(productsSeed) ? productsSeed : []) as Product[];
  await kvPutJSON(event, PRODUCTS_KEY, seed);
  return seed;
}

export async function writeProducts(event: H3Event, products: Product[]) {
  if (!Array.isArray(products)) throw new Error('Products must be an array');
  await kvPutJSON(event, PRODUCTS_KEY, products);
}

export function generateUniqueSlug(
  baseSlug: string,
  existing: Product[],
  excludeId: string | null = null,
): string {
  const taken = new Set(existing.filter((p) => p.id !== excludeId).map((p) => p.slug));
  if (!taken.has(baseSlug)) return baseSlug;
  let i = 1;
  while (taken.has(`${baseSlug}-${i}`)) i++;
  return `${baseSlug}-${i}`;
}

export async function getProductBySlug(event: H3Event, slugOrId: string): Promise<Product | null> {
  const products = await readProducts(event);
  return products.find((p) => p.slug === slugOrId || String(p.id) === slugOrId) ?? null;
}

export async function getProductById(event: H3Event, id: string): Promise<Product | null> {
  const products = await readProducts(event);
  return products.find((p) => String(p.id) === String(id)) ?? null;
}

export async function getSimilarProducts(
  event: H3Event,
  current: Product,
  limit = 4,
): Promise<Product[]> {
  if (!current.categories?.length) return [];
  const products = await readProducts(event);
  return products
    .filter(
      (p) =>
        String(p.id) !== String(current.id) &&
        p.categories?.some((c) => current.categories.includes(c)),
    )
    .slice(0, limit);
}

export function validateProduct(product: Partial<Product>) {
  const errors: string[] = [];
  if (!product.name?.trim()) errors.push('Название обязательно');
  if (product.price === undefined || Number.isNaN(product.price)) errors.push('Цена обязательна');
  if ((product.price ?? 0) < 0) errors.push('Цена не может быть отрицательной');
  return { valid: errors.length === 0, errors };
}

export function createProductObject(data: Record<string, any>): Product {
  const now = new Date().toISOString();
  const stockQuantity = parseInt(data.stockQuantity) || 0;
  return {
    id: data.id || String(Date.now()),
    slug: data.slug || slugify(data.name),
    name: data.name?.trim() || '',
    description: data.description || '',
    price: parseFloat(data.price) || 0,
    image: data.image || '/images/products/placeholder.webp',
    gallery: Array.isArray(data.gallery) ? data.gallery : [],
    categories: Array.isArray(data.categories) ? data.categories : ['Другое'],
    inStock: stockQuantity > 0,
    stockQuantity,
    characteristics: data.characteristics || {},
    createdAt: now,
    updatedAt: now,
  };
}
