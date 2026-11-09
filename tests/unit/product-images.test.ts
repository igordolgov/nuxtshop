// Тесты-инварианты данных миниатюр каталога: у каждой локальной фотографии
// товара должны существовать ОБЕ версии — 800w и 400w (small/).
//
// productSrcset() (app/utils/productImage.ts) кладёт в srcset карточек
// кандидата /images/products/small/<id>.webp 400w для ЛЮБОГО файла по маске
// photo-<цифры>-<hex>.webp; браузер при слоте карточки ~300 CSS px выбирает
// именно его. Если миниатюру не добавить — 404, @error, карточка рисует
// заглушку вместо фото (кейс: тестовый товар «Нинтендо свич 2», 2026-11:
// фото добавили в public/images/products/ без пары в small/).
// Лечение: node scripts/make-small-variants.mjs.
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { productSrcset } from '../../app/utils/productImage';

const FULL_DIR = join(__dirname, '../../public/images/products');
const SMALL_DIR = join(FULL_DIR, 'small');

// Маска должна совпадать с LOCAL_PRODUCT_IMAGE_RE в productImage.ts —
// инвариант проверяем через сам productSrcset(), поэтому маска здесь только
// отбирает файлы каталога среди прочих webp в папке (news-*.webp и т.п.).
const CATALOG_FILE_RE = /^photo-\d+-[a-f0-9]+\.webp$/;

const fulls = readdirSync(FULL_DIR).filter((f) => CATALOG_FILE_RE.test(f));
const smalls = readdirSync(SMALL_DIR).filter((f) => CATALOG_FILE_RE.test(f));

describe('миниатюры каталога (srcset 400w/800w)', () => {
  it('у каждой полной фотографии есть миниатюра small/ 400w', () => {
    expect(fulls.length).toBeGreaterThan(0);
    const missing = fulls.filter((f) => !existsSync(join(SMALL_DIR, f)));
    expect(
      missing,
      'Нет миниатюр 400w — карточки покажут заглушку вместо фото. ' +
        'Сгенерируйте: node scripts/make-small-variants.mjs',
    ).toEqual([]);
  });

  it('srcset карточки указывает только на существующие файлы', () => {
    for (const f of fulls) {
      const url = `/images/products/${f}`;
      const srcset = productSrcset(url);
      // Локальные photo-*.webp обязаны попадать под маску productSrcset:
      // иначе карточка молча теряет 400w-оптимизацию (нет srcset вовсе).
      expect(
        srcset,
        `productSrcset(${url}) вернул undefined — маска в productImage.ts не покрыла файл`,
      ).toBeDefined();
      for (const candidate of srcset.split(', ')) {
        const [path] = candidate.split(' ');
        // URL-путь от корня сайта (/images/…) → на диске живёт в public/
        const onDisk = join(__dirname, '../..', 'public', path);
        expect(existsSync(onDisk), `Кандидат srcset не существует на диске: ${path}`).toBe(true);
      }
    }
  });

  it('в small/ нет осиротевших миниатюр без полного файла', () => {
    const orphans = smalls.filter((f) => !existsSync(join(FULL_DIR, f)));
    expect(
      orphans,
      'Миниатюра есть, полного файла нет: кандидат 800w отдаст 404 ' +
        'на retina-экранах. Добавьте полный файл или удалите миниатюру.',
    ).toEqual([]);
  });
});
