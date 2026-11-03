// Тесты чистых хелперов вариантов товара (app/utils/productVariants.ts).
// Контракт: variants[0].price === product.price; склад/цена варианта
// не заданы → наследуются от товара; id корзинной позиции —
// «productId::variantId» (сервер разбирает сам).
import { describe, expect, it } from 'vitest';
import {
  VARIANT_SEPARATOR,
  hasVariants,
  firstVariant,
  findVariant,
  cartLineId,
  parseCartLineId,
  variantPrice,
  variantStock,
  localizedVariantName,
  localizedVariantLabel,
  cartVariantTitle,
} from '../../app/utils/productVariants';

const product = {
  id: '7',
  name: 'Смартфон',
  price: 79990,
  inStock: true,
  stockQuantity: 15,
  variantName: 'Цвет',
  variantNameEn: 'Color',
  variants: [
    { id: 's23-black', name: 'Чёрный', nameEn: 'Black', price: 79990, stockQuantity: 15 },
    { id: 's23-green', name: 'Зелёный', price: 82990, stockQuantity: 3 },
    { id: 's23-soldout', name: 'Белый', price: 79990, inStock: false, stockQuantity: 0 },
    { id: 's23-inherit', name: 'Наследует склад' }, // склад товара: 15
  ],
};

describe('hasVariants / firstVariant / findVariant', () => {
  it('обнаруживает варианты и дефолт — первый', () => {
    expect(hasVariants(product)).toBe(true);
    expect(firstVariant(product)?.id).toBe('s23-black');
    expect(hasVariants({ id: '1' })).toBe(false);
    expect(hasVariants({ variants: [] })).toBe(false);
    expect(firstVariant({ id: '1' })).toBeNull();
  });

  it('findVariant находит по id и терпит отсутствие', () => {
    expect(findVariant(product, 's23-green')?.name).toBe('Зелёный');
    expect(findVariant(product, 'nope')).toBeNull();
    expect(findVariant(product, null)).toBeNull();
  });
});

describe('составной id корзинной позиции', () => {
  it('с вариантом и без — симметрично parse', () => {
    expect(cartLineId('7', 's23-black')).toBe(`7${VARIANT_SEPARATOR}s23-black`);
    expect(cartLineId('7', null)).toBe('7');
    expect(parseCartLineId('7::s23-black')).toEqual({ productId: '7', variantId: 's23-black' });
    expect(parseCartLineId('7')).toEqual({ productId: '7', variantId: null });
    expect(parseCartLineId('7::')).toEqual({ productId: '7', variantId: null });
  });
});

describe('цена и склад варианта', () => {
  it('своя цена варианта, иначе базовая', () => {
    expect(variantPrice(product, findVariant(product, 's23-green'))).toBe(82990);
    expect(variantPrice(product, findVariant(product, 's23-black'))).toBe(79990);
    expect(variantPrice(product, null)).toBe(79990);
    expect(variantPrice(product, findVariant(product, 's23-inherit'))).toBe(79990);
  });

  it('склад: свой, наследованный, недоступный', () => {
    expect(variantStock(product, findVariant(product, 's23-green'))).toEqual({
      inStock: true,
      stockQuantity: 3,
    });
    // склад не задан → наследуется от товара
    expect(variantStock(product, findVariant(product, 's23-inherit'))).toEqual({
      inStock: true,
      stockQuantity: 15,
    });
    // свой нулевой склад → недоступен
    expect(variantStock(product, findVariant(product, 's23-soldout')).inStock).toBe(false);
    // без варианта — как у товара
    expect(variantStock(product, null)).toEqual({ inStock: true, stockQuantity: 15 });
  });
});

describe('локализация вариантов', () => {
  it('имя: en/es с фолбэком на русскую базу', () => {
    const black = findVariant(product, 's23-black')!;
    expect(localizedVariantName(black, 'ru')).toBe('Чёрный');
    expect(localizedVariantName(black, 'en')).toBe('Black');
    expect(localizedVariantName(black, 'es')).toBe('Чёрный'); // перевода нет
    expect(localizedVariantName(null, 'ru')).toBe('');
  });

  it('метка оси вариантов с фолбэком', () => {
    expect(localizedVariantLabel(product, 'ru')).toBe('Цвет');
    expect(localizedVariantLabel(product, 'en')).toBe('Color');
    // variantNameEs в фикстуре нет → фолбэк на русскую базу
    expect(localizedVariantLabel(product, 'es')).toBe('Цвет');
    expect(localizedVariantLabel({}, 'en')).toBe('');
  });

  it('cartVariantTitle — строка для позиции корзины', () => {
    expect(cartVariantTitle(findVariant(product, 's23-black'), 'en')).toBe('Black');
    expect(cartVariantTitle(null, 'ru')).toBeNull();
  });
});
