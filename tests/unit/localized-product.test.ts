// Тесты локализации товаров: shared/utils/localizedProduct.ts (чистая
// функция витрины) и патч локализованных полей в server/lib/productHelpers.ts
// (приём переводов PUT/POST: отсутствие поля / пустая строка / значение).
import { describe, expect, it } from 'vitest';

import {
  buildCategoryLabelMap,
  localizedProduct,
} from '../../app/utils/localizedProduct';
import { localizedProduct as localizedProductServer } from '../../server/lib/localizedProduct';
import {
  applyLocalizedPatch,
  extractLocalizedPatch,
} from '../../server/lib/productHelpers';

// ─── localizedProduct ─────────────────────────────────────────────────

const baseProduct = {
  id: '1',
  slug: 'smartfon',
  name: 'Смартфон',
  description: 'Хороший смартфон',
  price: 100,
  categories: ['Электроника', 'Телефоны'],
  inStock: true,
};

describe('localizedProduct', () => {
  it('ru возвращает объект как есть (без копий и без categoriesRaw)', () => {
    expect(localizedProduct(baseProduct, 'ru')).toBe(baseProduct);
  });

  it('en: перевод есть — берутся переводные поля', () => {
    const view = localizedProduct(
      { ...baseProduct, nameEn: 'Smartphone', descriptionEn: 'Good phone', categoriesEn: ['Electronics', 'Phones'] },
      'en',
    );
    expect(view.name).toBe('Smartphone');
    expect(view.description).toBe('Good phone');
    expect(view.categories).toEqual(['Electronics', 'Phones']);
    // Сырые категории сохранены для матчинга фильтров
    expect(view.categoriesRaw).toEqual(['Электроника', 'Телефоны']);
    // Исходные поля не потеряны
    expect(view.price).toBe(100);
    expect(view.slug).toBe('smartfon');
  });

  it('en: перевода нет — фолбэк на русский', () => {
    const view = localizedProduct(baseProduct, 'en');
    expect(view.name).toBe('Смартфон');
    expect(view.description).toBe('Хороший смартфон');
    expect(view.categories).toEqual(['Электроника', 'Телефоны']);
  });

  it('en: пустые строки перевода — фолбэк на русский', () => {
    const view = localizedProduct({ ...baseProduct, nameEn: '   ', descriptionEn: '' }, 'en');
    expect(view.name).toBe('Смартфон');
    expect(view.description).toBe('Хороший смартфон');
  });

  it('es: частичный перевод категорий — поэлементный фолбэк по индексу', () => {
    const view = localizedProduct(
      { ...baseProduct, categoriesEs: ['Electrónica'] },
      'es',
    );
    expect(view.categories).toEqual(['Electrónica', 'Телефоны']);
  });

  it('es: без базовых категорий — только непустые переводы', () => {
    const view = localizedProduct(
      { id: '2', categoriesEs: ['Electrónica', ''] },
      'es',
    );
    expect(view.categories).toEqual(['Electrónica']);
    expect(view.categoriesRaw).toEqual([]);
  });

  it('неизвестная локаль и null — без изменений', () => {
    expect(localizedProduct(baseProduct, 'fr')).toBe(baseProduct);
    expect(localizedProduct(null, 'en')).toBe(null);
  });
});

describe('buildCategoryLabelMap', () => {
  const products = [
    { categories: ['Электроника', 'Телефоны'], categoriesEn: ['Electronics', 'Phones'] },
    { categories: ['Электроника'], categoriesEs: ['Electrónica'] },
  ];

  it('en: карта сырая → перевод, дубликат берёт первое вхождение', () => {
    const map = buildCategoryLabelMap(products, 'en');
    expect(map.get('Электроника')).toBe('Electronics');
    expect(map.get('Телефоны')).toBe('Phones');
    expect(map.has('undefined')).toBe(false);
  });

  it('es: только пары из es-полей', () => {
    const map = buildCategoryLabelMap(products, 'es');
    expect(map.get('Электроника')).toBe('Electrónica');
    expect(map.get('Телефоны')).toBeUndefined();
  });

  it('ru и пустой каталог — пустая карта (фолбэк на сырые подписи)', () => {
    expect(buildCategoryLabelMap(products, 'ru').size).toBe(0);
    expect(buildCategoryLabelMap([], 'en').size).toBe(0);
    expect(buildCategoryLabelMap(null, 'en').size).toBe(0);
  });
});

// ─── extractLocalizedPatch / applyLocalizedPatch (PUT/POST) ───────────

describe('extractLocalizedPatch', () => {
  it('поля не пришли — патч пуст (PUT не трогает переводы)', () => {
    expect(extractLocalizedPatch({ name: 'X' })).toEqual({});
    expect(extractLocalizedPatch(null)).toEqual({});
    expect(extractLocalizedPatch(undefined)).toEqual({});
  });

  it('строки триммятся, пустые → null (удалить перевод)', () => {
    const patch = extractLocalizedPatch({
      nameEn: '  Smartphone  ',
      nameEs: '   ',
      descriptionEn: '',
    });
    expect(patch).toEqual({ nameEn: 'Smartphone', nameEs: null, descriptionEn: null });
  });

  it('категории: массив/CSV/объекты, пустой список → null', () => {
    expect(extractLocalizedPatch({ categoriesEn: [' Electronics ', 'Phones'] })).toEqual({
      categoriesEn: ['Electronics', 'Phones'],
    });
    expect(extractLocalizedPatch({ categoriesEs: 'A, B ,A' })).toEqual({
      categoriesEs: ['A', 'B'],
    });
    expect(extractLocalizedPatch({ categoriesEn: [{ name: 'Tech' }] })).toEqual({
      categoriesEn: ['Tech'],
    });
    expect(extractLocalizedPatch({ categoriesEn: [] })).toEqual({ categoriesEn: null });
    // Явный null — тоже очистка
    expect(extractLocalizedPatch({ nameEn: null, categoriesEn: null })).toEqual({
      nameEn: null,
      categoriesEn: null,
    });
  });

  it('лимиты длины: имя 200, описание 5000', () => {
    const patch = extractLocalizedPatch({
      nameEn: 'x'.repeat(250),
      descriptionEn: 'y'.repeat(6000),
    });
    expect(patch.nameEn).toHaveLength(200);
    expect(patch.descriptionEn).toHaveLength(5000);
  });
});

describe('applyLocalizedPatch', () => {
  const product = {
    id: '1',
    name: 'Смартфон',
    nameEn: 'Old',
    categories: ['Электроника'],
    categoriesEn: ['Electronics'],
  };

  it('значение — присваивает, null — удаляет поле из записи', () => {
    const updated = applyLocalizedPatch(product, {
      nameEn: 'Smartphone',
      categoriesEn: null,
      nameEs: 'Teléfono',
    });
    expect(updated.nameEn).toBe('Smartphone');
    expect(updated.nameEs).toBe('Teléfono');
    expect('categoriesEn' in updated).toBe(false);
    // Исходная запись не мутирована
    expect(product.nameEn).toBe('Old');
    expect(product.categoriesEn).toEqual(['Electronics']);
  });

  it('пустой патч — копия без изменений', () => {
    const updated = applyLocalizedPatch(product, {});
    expect(updated).toEqual(product);
    expect(updated).not.toBe(product);
  });
});

// ─── Синхронизация копий shared ↔ server ──────────────────────────────
// server/lib/localizedProduct.ts — серверная копия app/utils/localizedProduct.ts
// (vite-SSR выносит файлы вне srcDir как внешние, nitro не бандлит shared/, см. шапки файлов).
// Дрейф контракт ловит эта матрица: обе функции обязаны давать идентичные
// результаты на всех сценариях.

describe('server/app copies are in sync', () => {
  const cases = [
    [baseProduct, 'ru'],
    [baseProduct, 'en'],
    [baseProduct, 'es'],
    [baseProduct, 'fr'],
    [{ ...baseProduct, nameEn: '  ', descriptionEn: '', categoriesEn: ['Electronics'] }, 'en'],
    [{ ...baseProduct, categoriesEs: ['Electrónica'] }, 'es'],
    [{ id: '2', categoriesEn: ['A', ''] }, 'en'],
    [null, 'en'],
    [{ id: '3' }, 'es'],
  ];

  it.each(cases)('совпадение вывода для %j, локаль %s', (input, locale) => {
    expect(localizedProductServer(input, locale)).toEqual(
      localizedProduct(input, locale),
    );
  });
});
