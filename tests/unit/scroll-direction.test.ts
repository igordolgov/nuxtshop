// tests/unit/scroll-direction.test.ts
// decideFloatingVisibility — чистое решение видимости плавающих
// элементов (кнопка «наверх», нижняя CTA карточки товара).
// Режим 'position' — фикс жалобы «кнопка Наверх не всегда появляется
// при скроллинге вниз»: дальше порога видна в ЛЮБОМ направлении.
import { describe, expect, it } from 'vitest';
import { decideFloatingVisibility } from '../../app/composables/useScrollDirection';

describe('decideFloatingVisibility — режим position (кнопка «наверх», atTop: hide)', () => {
  const opts = { follow: 'position' as const, atTop: 'hide' as const, threshold: 200 };

  it('у верха страницы скрыта (<= threshold), включая самый верх', () => {
    expect(decideFloatingVisibility({ ...opts, top: 0, baseline: null })).toBe(false);
    expect(decideFloatingVisibility({ ...opts, top: 150, baseline: 900 })).toBe(false);
    expect(decideFloatingVisibility({ ...opts, top: 200, baseline: 900 })).toBe(false);
  });

  it('первое событие без baseline: прокрутили дальше порога — появляется', () => {
    expect(decideFloatingVisibility({ ...opts, top: 201, baseline: null })).toBe(true);
    expect(decideFloatingVisibility({ ...opts, top: 900, baseline: null })).toBe(true);
  });

  it('прокрутка ВНИЗ дальше порога — остаётся видимой (сам фикс)', () => {
    expect(decideFloatingVisibility({ ...opts, top: 900, baseline: 300 })).toBe(true);
    expect(decideFloatingVisibility({ ...opts, top: 5000, baseline: 4800 })).toBe(true);
  });

  it('прокрутка вверх — видима; возврат к верху — скрывается', () => {
    expect(decideFloatingVisibility({ ...opts, top: 300, baseline: 900 })).toBe(true);
    expect(decideFloatingVisibility({ ...opts, top: 199, baseline: 400 })).toBe(false);
  });

  it('дрожание у position не влияет: позиция дальше порога всегда true', () => {
    expect(decideFloatingVisibility({ ...opts, top: 206, baseline: 200 })).toBe(true);
  });
});

describe('decideFloatingVisibility — режим direction (нижняя CTA товара, atTop: show)', () => {
  const opts = { follow: 'direction' as const, atTop: 'show' as const, threshold: 240 };

  it('у карточки (<= threshold) видима всегда', () => {
    expect(decideFloatingVisibility({ ...opts, top: 0, baseline: null })).toBe(true);
    expect(decideFloatingVisibility({ ...opts, top: 240, baseline: 800 })).toBe(true);
  });

  it('первое событие без baseline — решение не меняем (null)', () => {
    expect(decideFloatingVisibility({ ...opts, top: 800, baseline: null })).toBeNull();
  });

  it('прокрутка вниз — прячется, вверх — возвращается', () => {
    expect(decideFloatingVisibility({ ...opts, top: 800, baseline: 300 })).toBe(false);
    expect(decideFloatingVisibility({ ...opts, top: 300, baseline: 800 })).toBe(true);
  });

  it('дрожание |delta| <= 6 — решение не меняем (null)', () => {
    expect(decideFloatingVisibility({ ...opts, top: 306, baseline: 300 })).toBeNull();
    expect(decideFloatingVisibility({ ...opts, top: 294, baseline: 300 })).toBeNull();
  });

  it('порог дрожания строгий: |delta| = 7 уже переключает', () => {
    expect(decideFloatingVisibility({ ...opts, top: 307, baseline: 300 })).toBe(false);
    expect(decideFloatingVisibility({ ...opts, top: 293, baseline: 300 })).toBe(true);
  });
});
