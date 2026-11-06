// Тесты migrateSeedCharacteristicsEs: долив сидового ES-перевода spec-листа
// товарам без него — в памяти, без перезаписи админских данных.
import { describe, expect, it } from 'vitest';
import { migrateSeedCharacteristicsEs, type Product } from '../../server/lib/productHelpers';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: '1',
    slug: 'smartfon-samsung-galaxy-s23', // в сиде есть characteristicsEs
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

describe('migrateSeedCharacteristicsEs', () => {
  it('товар без ES-перевода получает сидовой Record целиком', () => {
    const live = product();
    migrateSeedCharacteristicsEs([live]);
    expect(live.characteristicsEs).toBeDefined();
    expect(Object.keys(live.characteristicsEs!).length).toBeGreaterThan(0);
    // сидовой перевод значений, не русский список: ключи — испанские
    expect(live.characteristicsEs).toHaveProperty('Marca');
    expect(live.characteristicsEs).not.toHaveProperty('Бренд');
  });

  it('заполненный админский перевод не перебивается, пустой — доливается', () => {
    const adminEs = product({ characteristicsEs: { Marca: 'Mi marca' } });
    const emptyEs = product({ characteristicsEs: {} });
    const noSeedTwin = product({ slug: 'net-v-side' });
    migrateSeedCharacteristicsEs([adminEs, emptyEs, noSeedTwin]);
    expect(adminEs.characteristicsEs).toEqual({ Marca: 'Mi marca' });
    expect(emptyEs.characteristicsEs).toHaveProperty('Marca');
    expect(noSeedTwin.characteristicsEs).toBeUndefined();
  });

  it('доливка идемпотентна: Record у товара заменяется равным сидовым', () => {
    const live = product();
    migrateSeedCharacteristicsEs([live]);
    const first = { ...live.characteristicsEs };
    migrateSeedCharacteristicsEs([live]);
    expect(live.characteristicsEs).toEqual(first);
  });
});
