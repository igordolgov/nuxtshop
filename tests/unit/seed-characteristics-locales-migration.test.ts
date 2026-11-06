// Тесты migrateSeedCharacteristicLocales: долив сидовых переводов
// spec-листа (characteristicsEn/Es) товарам без них — в памяти, без
// перезаписи админских данных.
import { describe, expect, it } from 'vitest';
import { migrateSeedCharacteristicLocales, type Product } from '../../server/lib/productHelpers';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: '1',
    slug: 'smartfon-samsung-galaxy-s23', // в сиде есть characteristicsEn/Es
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

describe('migrateSeedCharacteristicLocales', () => {
  it('товар без переводов получает сидовые En и Es целиком', () => {
    const live = product();
    migrateSeedCharacteristicLocales([live]);
    expect(Object.keys(live.characteristicsEs!).length).toBeGreaterThan(0);
    expect(Object.keys(live.characteristicsEn!).length).toBeGreaterThan(0);
    // переводы ЗНАЧЕНИЙ, не русский список: ключи локализованы
    expect(live.characteristicsEs).toHaveProperty('Marca');
    expect(live.characteristicsEs).not.toHaveProperty('Бренд');
    expect(live.characteristicsEn).toHaveProperty('Brand');
    expect(live.characteristicsEn).not.toHaveProperty('Бренд');
  });

  it('заполненные админские переводы не перебиваются, пустые — доливаются', () => {
    const adminEn = product({ characteristicsEn: { Brand: 'My brand' } });
    const emptyEs = product({ characteristicsEs: {} });
    const noSeedTwin = product({ slug: 'net-v-side' });
    migrateSeedCharacteristicLocales([adminEn, emptyEs, noSeedTwin]);
    // админский En не тронут, а недостающий Es долился из сида (локали независимы)
    expect(adminEn.characteristicsEn).toEqual({ Brand: 'My brand' });
    expect(adminEn.characteristicsEs).toHaveProperty('Marca');
    expect(emptyEs.characteristicsEs).toHaveProperty('Marca');
    expect(emptyEs.characteristicsEn).toHaveProperty('Brand');
    expect(noSeedTwin.characteristicsEn).toBeUndefined();
    expect(noSeedTwin.characteristicsEs).toBeUndefined();
  });

  it('доливка идемпотентна: повторный вызов ничего не меняет', () => {
    const live = product();
    migrateSeedCharacteristicLocales([live]);
    const firstEn = { ...live.characteristicsEn };
    const firstEs = { ...live.characteristicsEs };
    migrateSeedCharacteristicLocales([live]);
    expect(live.characteristicsEn).toEqual(firstEn);
    expect(live.characteristicsEs).toEqual(firstEs);
  });
});
