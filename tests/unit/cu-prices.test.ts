// Инвариант USD-цен кубинской копии: карта server/data/products.cu-prices.json
// обязана покрывать ВЕСЬ сид products.json (обратное — тоже: без чужих id),
// цены — положительные, oldPrice — строго больше цены, у вариантов — свои
// цены. Нарушение любого пункта = в копии останется рублёвая сумма с
// символом $ или битый бейдж скидки. Скрипт make-products-copy.mjs валится
// с той же проверкой на сборке копии — тест ловит раньше, в PR.
import { describe, expect, it } from 'vitest';
import productsSeed from '../../server/data/products.json';
import cuPrices from '../../server/data/products.cu-prices.json';

const seed = productsSeed as Array<Record<string, any>>;
const map = cuPrices as { version: string; prices: Record<string, any> };

describe('products.cu-prices.json — покрытие и валидность', () => {
  it('у карты есть непустая версия сида', () => {
    expect(typeof map.version).toBe('string');
    expect(map.version.length).toBeGreaterThan(0);
  });

  it('карта покрывает каждый товар сида и не содержит чужих id', () => {
    const seedIds = seed.map((p) => String(p.id));
    for (const id of seedIds) {
      expect(
        map.prices[id],
        `товар ${id} (${seed.find((p) => String(p.id) === id)?.slug}) без цены`,
      ).toBeTruthy();
    }
    for (const id of Object.keys(map.prices)) {
      expect(seedIds, `id ${id} из карты нет в products.json`).toContain(id);
    }
  });

  it('цены положительные, oldPrice строго больше цены', () => {
    for (const [id, m] of Object.entries(map.prices)) {
      expect(Number(m.price), `${id}: price`).toBeGreaterThan(0);
      expect(Number.isFinite(Number(m.price)), `${id}: price`).toBe(true);
      if (m.oldPrice !== undefined) {
        expect(Number(m.oldPrice), `${id}: oldPrice`).toBeGreaterThan(Number(m.price));
      }
    }
  });

  it('у товара с вариантами в карте есть цена каждого варианта', () => {
    for (const p of seed) {
      const variants = Array.isArray(p.variants) ? p.variants : [];
      if (variants.length === 0) continue;
      const m = map.prices[String(p.id)];
      expect(m.variants, `${p.id}: нет блока variants`).toBeTruthy();
      for (const v of variants) {
        expect(Number(m.variants?.[v.id]), `${p.id}: вариант ${v.id}`).toBeGreaterThan(0);
      }
    }
  });
});
