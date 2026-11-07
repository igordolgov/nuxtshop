// tests/unit/catalog-card.test.ts
// toCatalogCardProduct — карточный слепок для лёгкого SSR-payload:
// белые списки полей (галереи/характеристики остаются серверу),
// isFullCatalogProduct — эвристика «это слепок или полный товар».
import { describe, expect, it } from 'vitest';
import {
  CATALOG_CARD_FIELDS,
  isFullCatalogProduct,
  toCatalogCardProduct,
} from '../../app/utils/catalogCard';
import type { CatalogProduct } from '../../app/composables/catalogProduct';

const fullProduct = {
  id: '920000100012',
  slug: 'aspiradora-robot-xiaomi',
  name: 'Робот-пылесос Xiaomi',
  nameEn: 'Xiaomi Robot Vacuum',
  nameEs: 'Aspiradora robot Xiaomi',
  description: 'Сухая и влажная уборка',
  descriptionEn: 'Dry and wet cleaning',
  descriptionEs: 'Limpieza en seco y húmedo',
  price: 19999,
  oldPrice: 24999,
  image: '/images/products/photo-920000100012-b59b25fbd2.webp',
  gallery: ['/images/products/photo-920000100012-b59b25fbd2.webp', '/images/products/extra.webp'],
  categories: ['Техника для дома'],
  categoriesEn: ['Home appliances'],
  categoriesEs: ['Electrodomésticos'],
  inStock: true,
  stockQuantity: 7,
  characteristics: { Гарантия: '12 месяцев' },
  characteristicsEn: { Warranty: '12 months' },
  characteristicsEs: { Garantía: '12 meses' },
  variants: [{ id: 'v1', name: 'Чёрный', price: 19999, inStock: true, stockQuantity: 3 }],
  variantName: 'Цвет',
  rating: { count: 4, average: 4.5 },
  isFavorite: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
} as unknown as CatalogProduct;

describe('toCatalogCardProduct — карточный слепок SSR-payload', () => {
  it('оставляет все поля витрины каталога', () => {
    const card = toCatalogCardProduct(fullProduct);
    expect(card.id).toBe('920000100012');
    expect(card.slug).toBe('aspiradora-robot-xiaomi');
    expect(card.nameEs).toBe('Aspiradora robot Xiaomi');
    expect(card.descriptionEs).toBe('Limpieza en seco y húmedo');
    expect(card.price).toBe(19999);
    expect(card.oldPrice).toBe(24999);
    expect(card.inStock).toBe(true);
    expect(card.stockQuantity).toBe(7);
    expect(card.categoriesEs).toEqual(['Electrodomésticos']);
    expect(card.rating).toEqual({ count: 4, average: 4.5 });
    expect(card.variants).toHaveLength(1);
    expect(card.isFavorite).toBe(false);
    expect(card.createdAt).toContain('2026-01-01');
  });

  it('отрезает галереи и характеристики (главные тяжеловесы payload)', () => {
    const card = toCatalogCardProduct(fullProduct) as unknown as Record<string, unknown>;
    expect(card).not.toHaveProperty('gallery');
    expect(card).not.toHaveProperty('characteristics');
    expect(card).not.toHaveProperty('characteristicsEn');
    expect(card).not.toHaveProperty('characteristicsEs');
  });

  it('undefined-поля не попадают в слепок (меньше мусора в payload)', () => {
    const card = toCatalogCardProduct({
      ...fullProduct,
      oldPrice: undefined,
      variants: undefined,
    } as unknown as CatalogProduct) as unknown as Record<string, unknown>;
    expect(card).not.toHaveProperty('oldPrice');
    expect(card).not.toHaveProperty('variants');
  });

  it('белый список покрывает все поля, нужные карточкам/корзине/избранному', () => {
    // Случайное сужение списка сломало бы витрину — фиксируем состав
    expect([...CATALOG_CARD_FIELDS].sort()).toEqual(
      [
        '_id',
        'categories',
        'categoriesEn',
        'categoriesEs',
        'createdAt',
        'description',
        'descriptionEn',
        'descriptionEs',
        'id',
        'image',
        'inStock',
        'isFavorite',
        'name',
        'nameEn',
        'nameEs',
        'oldPrice',
        'price',
        'rating',
        'slug',
        'stockQuantity',
        'updatedAt',
        'variantName',
        'variantNameEn',
        'variantNameEs',
        'variants',
      ].sort(),
    );
  });
});

describe('isFullCatalogProduct — слепок или полный товар', () => {
  it('товар с характеристиками — полный', () => {
    expect(isFullCatalogProduct(fullProduct)).toBe(true);
  });

  it('товар с галереей, но без характеристик — полный', () => {
    const noChars = { ...fullProduct } as Partial<CatalogProduct>;
    delete noChars.characteristics;
    delete noChars.characteristicsEn;
    delete noChars.characteristicsEs;
    expect(isFullCatalogProduct(noChars as CatalogProduct)).toBe(true);
  });

  it('карточный слепок — не полный', () => {
    expect(
      isFullCatalogProduct(toCatalogCardProduct(fullProduct) as unknown as CatalogProduct),
    ).toBe(false);
  });

  it('пустота — не полный', () => {
    expect(isFullCatalogProduct(null)).toBe(false);
    expect(isFullCatalogProduct(undefined)).toBe(false);
  });
});
