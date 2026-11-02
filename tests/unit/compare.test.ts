// Тесты useCompare: чистая функция pushCompare (toggle, лимит, порядок)
// — без localStorage, сам композабл покрыт рантайм-логикой этой функции.
import { describe, expect, it } from 'vitest';
import { COMPARE_MAX, pushCompare } from '../../app/composables/useCompare';

const snap = (id: number) => ({ id: String(id), name: `Товар ${id}` });

describe('pushCompare', () => {
  it('добавляет в начало, снимает повторным кликом', () => {
    let { list, status } = pushCompare([], snap(1));
    expect(status).toBe('added');
    expect(list.map((p) => p.id)).toEqual(['1']);

    ({ list, status } = pushCompare(list, snap(2)));
    expect(status).toBe('added');
    expect(list.map((p) => p.id)).toEqual(['2', '1']); // новые сверху

    ({ list, status } = pushCompare(list, snap(1)));
    expect(status).toBe('removed');
    expect(list.map((p) => p.id)).toEqual(['2']);
  });

  it('id сравниваются строкой (число и строка — один товар)', () => {
    const { list } = pushCompare([], { id: 5, name: 'x' });
    const second = pushCompare(list, { id: '5', name: 'x' });
    expect(second.status).toBe('removed');
    expect(second.list).toHaveLength(0);
  });

  it(`лимит ${COMPARE_MAX}: пятый не влезает — статус full, список не изменился`, () => {
    let list = [1, 2, 3, 4].map((i) => snap(i));
    const result = pushCompare(list, snap(5));
    expect(result.status).toBe('full');
    expect(result.list).toBe(list); // ссылка не тронута
    expect(result.list).toHaveLength(4);
  });

  it('битые входы не бросают исключений', () => {
    expect(pushCompare(null, snap(1)).list).toEqual([snap(1)]); // битый список → пустой, товар добавлен
    expect(pushCompare([], null).status).toBe('removed');
    expect(pushCompare([], { name: 'без id' }).status).toBe('removed');
    expect(pushCompare('мусор', snap(1)).list).toEqual([snap(1)]);
  });

  it('COMPARE_MAX = 4', () => {
    expect(COMPARE_MAX).toBe(4);
  });
});
