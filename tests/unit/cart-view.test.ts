// Тесты cartViewMode (app/utils/cartView.ts) — состояние показа страницы
// корзины. Регрессия «мигает фото последнего товара»: скелет держится до
// фактического чтения снапшота корзины; «Корзина пуста» показывается
// только после cartLoaded, иначе на каждый /cart она вспыхивала на весь
// экран, список перестраивался повторно и фото позиций монтировались заново.
import { describe, expect, it } from 'vitest';
import { cartViewMode } from '../../app/utils/cartView';

describe('cartViewMode: скелет до реальной загрузки корзины', () => {
  it('SSR/до монтирования — скелет, даже если items внезапно есть', () => {
    expect(cartViewMode(false, false, 0)).toBe('skeleton');
    expect(cartViewMode(false, true, 3)).toBe('skeleton');
  });

  it('смонтировались, но снапшот ещё читается (fetchCart по suspense:resolve) — скелет', () => {
    // Раньше здесь показывалось «Корзина пуста» — вспышка на весь экран
    expect(cartViewMode(true, false, 0)).toBe('skeleton');
  });

  it('корзина прочитана и пуста — «пусто»', () => {
    expect(cartViewMode(true, true, 0)).toBe('empty');
  });

  it('корзина прочитана и есть позиции — список', () => {
    expect(cartViewMode(true, true, 1)).toBe('items');
    expect(cartViewMode(true, true, 7)).toBe('items');
  });

  it('отрицательное/мусорное количество — не «список»', () => {
    expect(cartViewMode(true, true, -2)).toBe('empty');
    expect(cartViewMode(true, true, Number.NaN)).toBe('empty');
  });
});
