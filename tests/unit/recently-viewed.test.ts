// Тесты app/composables/useRecentlyViewed.js — чистая логика истории
// просмотров (pushRecent) без localStorage; сам композабл тонкий
// клиентский слой вокруг неё.
import { describe, expect, it } from 'vitest';
import { RECENTLY_VIEWED_MAX, pushRecent } from '../../app/composables/useRecentlyViewed';

describe('pushRecent', () => {
  it('добавляет slug наверх списка', () => {
    expect(pushRecent(['b', 'a'], 'c')).toEqual(['c', 'b', 'a']);
  });

  it('повтор поднимает товар наверх (без дублей)', () => {
    expect(pushRecent(['c', 'b', 'a'], 'b')).toEqual(['b', 'c', 'a']);
    expect(pushRecent(['x'], 'x')).toEqual(['x']);
  });

  it('ограничивает длину истории', () => {
    const list = ['p1', 'p2', 'p3', 'p4', 'p5'];
    const result = pushRecent(list, 'p6', 5);
    expect(result).toEqual(['p6', 'p1', 'p2', 'p3', 'p4']);
    expect(result).toHaveLength(5);
  });

  it('дефолтный лимит — RECENTLY_VIEWED_MAX', () => {
    let list = [];
    for (let i = 0; i < 30; i++) list = pushRecent(list, `p${i}`);
    expect(list).toHaveLength(RECENTLY_VIEWED_MAX);
    expect(list[0]).toBe('p29'); // свежий — наверху
    expect(list).not.toContain('p17'); // самый старый вытеснен
  });

  it('битые входы не бросают исключений', () => {
    expect(pushRecent(null, 'a')).toEqual(['a']);
    expect(pushRecent(['a'], null)).toEqual(['a']);
    expect(pushRecent(null, null)).toEqual([]);
    expect(pushRecent('не массив', 'a')).toEqual(['a']);
    expect(pushRecent([1, 2], 'a')).toEqual(['a', 1, 2]); // фильтр только по slug
  });

  it('не мутирует исходный массив', () => {
    const original = ['a', 'b'];
    const result = pushRecent(original, 'c');
    expect(original).toEqual(['a', 'b']);
    expect(result).not.toBe(original);
  });
});
