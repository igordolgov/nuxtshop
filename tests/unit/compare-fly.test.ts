// Тесты хелперов «синей точки» сравнения (app/utils/compareFly.ts):
// расчёт точки старта полёта и выбор видимого приёмника [data-fly-compare].
// Сам полёт (Web Animations API) и бейдж покрыты кодом Header.vue /.prod.
import { describe, expect, it } from 'vitest';
import {
  COMPARE_FLY_EVENT,
  elementCenter,
  getFlyOrigin,
  resolveFlyTarget,
} from '../../app/utils/compareFly';

const rect = (left, top, width, height) => ({ left, top, width, height });

describe('getFlyOrigin', () => {
  it('приоритет — координаты клика', () => {
    const origin = getFlyOrigin(
      { x: 120, y: 300, rect: rect(0, 0, 50, 50) },
      { width: 400, height: 800 },
    );
    expect(origin).toEqual({ x: 120, y: 300 });
  });

  it('без клика — центр прямоугольника кнопки', () => {
    const origin = getFlyOrigin({ rect: rect(10, 20, 40, 30) });
    expect(origin).toEqual({ x: 30, y: 35 });
  });

  it('фолбэк — низ экрана по центру', () => {
    const origin = getFlyOrigin({}, { width: 400, height: 800 });
    expect(origin).toEqual({ x: 200, y: 776 });
  });

  it('без всего — (0, 0), без бросков', () => {
    expect(getFlyOrigin()).toEqual({ x: 0, y: 0 });
    expect(getFlyOrigin(null)).toEqual({ x: 0, y: 0 });
    expect(getFlyOrigin({ rect: { left: NaN, top: 0, width: 1, height: 1 } })).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('resolveFlyTarget', () => {
  const fake = (rects) => ({ getClientRects: () => rects });

  it('пропускает скрытые (display:none → нет клиентских прямоугольников)', () => {
    const hidden = fake([]);
    const visible = fake([rect(0, 0, 10, 10)]);
    expect(resolveFlyTarget([hidden, visible])).toBe(visible);
  });

  it('на мобиле первый видимый — бургер, скрытая десктоп-ссылка пропущена', () => {
    const burger = fake([rect(4, 4, 44, 44)]);
    const desktopLink = fake([]);
    expect(resolveFlyTarget([burger, desktopLink])).toBe(burger);
  });

  it('на десктопе наоборот: скрытый бургер пропущен, летит в «Сравнение»', () => {
    const burger = fake([]);
    const desktopLink = fake([rect(500, 8, 120, 36)]);
    expect(resolveFlyTarget([burger, desktopLink])).toBe(desktopLink);
  });

  it('нет видимых — null; мусор на входе — без бросков', () => {
    expect(resolveFlyTarget([fake([]), fake([])])).toBeNull();
    expect(resolveFlyTarget([null, undefined])).toBeNull();
    expect(resolveFlyTarget(null)).toBeNull();
  });
});

describe('elementCenter', () => {
  it('центр по getBoundingClientRect', () => {
    const el = { getBoundingClientRect: () => rect(100, 50, 44, 44) };
    expect(elementCenter(el)).toEqual({ x: 122, y: 72 });
  });

  it('нет элемента/метода — null', () => {
    expect(elementCenter(null)).toBeNull();
    expect(elementCenter({})).toBeNull();
  });
});

describe('событие', () => {
  it('имя стабильно (на него подписан Header)', () => {
    expect(COMPARE_FLY_EVENT).toBe('shop:compare-fly');
  });
});
