// Тесты migrateSeedVariants: долив сидовых вариантов товарам без них —
// в памяти, без перезаписи админских данных.
import { describe, expect, it } from 'vitest';
import { migrateSeedVariants, type Product } from '../../server/lib/productHelpers';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: '1',
    slug: 'smartfon-samsung-galaxy-s23', // в сиде есть варианты
    name: 'Тест',
    description: '',
    price: 79990,
    image: '/x.webp',
    gallery: [],
    categories: ['cat'],
    inStock: true,
    stockQuantity: 5,
    characteristics: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('migrateSeedVariants', () => {
  it('товар без вариантов получает сидовые, базовая цена = живая', () => {
    const live = product({ price: 74990 }); // админ сменил цену
    migrateSeedVariants([live]);
    expect(live.variants).toHaveLength(3);
    // первый вариант унаследовал ЖИВУЮ цену, а не сидовую
    expect(live.variants![0]!.price).toBe(74990);
    expect(live.variantName).toBe('Цвет');
  });

  it('товар с вариантами не трогается, без сид-близнеца — тоже', () => {
    const withVariants = product({
      slug: 'smartfon-samsung-galaxy-s23',
      variants: [{ id: 'custom', name: 'Админский' }],
    });
    const noSeedTwin = product({ slug: 'net-v-side', price: 100 });
    migrateSeedVariants([withVariants, noSeedTwin]);
    expect(withVariants.variants).toEqual([{ id: 'custom', name: 'Админский' }]);
    expect(noSeedTwin.variants).toBeUndefined();
  });

  it('админские переводы метки оси не перебиваются', () => {
    const live = product({ variantName: 'Моя ось' });
    migrateSeedVariants([live]);
    expect(live.variantName).toBe('Моя ось');
  });
});
