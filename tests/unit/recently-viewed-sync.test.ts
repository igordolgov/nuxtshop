// Тесты синка истории просмотров с аккаунтом:
//  - app/utils/recentlyViewedSync.ts — mergeRecent / normalizeRemoteRecent /
//    recentSignature / planRecentSync (adopt/merge по маркеру) — общая
//    логика клиента и сервера;
//  - server/lib/recentlyViewedHelpers.ts — KV read/write поверх in-memory
//    fallback (биндингов KV в тестах нет — см. cart-sync.test.ts).
import { describe, expect, it } from 'vitest';
import type { H3Event } from 'h3';
import {
  mergeRecent,
  normalizeRemoteRecent,
  planRecentSync,
  recentSignature,
  RECENTLY_VIEWED_MAX,
  RECENT_SLUG_MAX_LENGTH,
  type RecentSyncMarker,
} from '../../app/utils/recentlyViewedSync';
import {
  readUserRecentlyViewed,
  writeUserRecentlyViewed,
} from '../../server/lib/recentlyViewedHelpers';

const bareEvent = {} as H3Event;

describe('normalizeRemoteRecent: санитизация серверной истории', () => {
  it('валидный список проходит насквозь', () => {
    expect(normalizeRemoteRecent({ items: ['a', 'b', 'c'] })).toEqual(['a', 'b', 'c']);
    expect(normalizeRemoteRecent(['a', 'b'])).toEqual(['a', 'b']); // голый массив тоже
  });

  it('мусор вместо списка → null', () => {
    expect(normalizeRemoteRecent(null)).toBeNull();
    expect(normalizeRemoteRecent('строка')).toBeNull();
    expect(normalizeRemoteRecent({})).toBeNull();
    expect(normalizeRemoteRecent({ items: 'не массив' })).toBeNull();
  });

  it('нестроки и пустые значения отбрасываются', () => {
    expect(normalizeRemoteRecent(['a', 42, null, '', 'b'])).toEqual(['a', 'b']);
  });

  it('дубли схлопываются (остаётся первое вхождение — самое свежее)', () => {
    expect(normalizeRemoteRecent(['a', 'b', 'a'])).toEqual(['a', 'b']);
  });

  it('лимит RECENTLY_VIEWED_MAX и кап длины slug', () => {
    const many = Array.from({ length: 30 }, (_, i) => `p${i}`);
    const normalized = normalizeRemoteRecent(many)!;
    expect(normalized).toHaveLength(RECENTLY_VIEWED_MAX);

    const long = normalizeRemoteRecent(['x'.repeat(500)])!;
    expect(long[0]).toHaveLength(RECENT_SLUG_MAX_LENGTH);
  });
});

describe('mergeRecent: объединение локальной и серверной истории', () => {
  it('локальная пуста → серверная целиком (вход на новом устройстве)', () => {
    expect(mergeRecent([], ['r1', 'r2'])).toEqual(['r1', 'r2']);
    expect(mergeRecent(null, ['r1'])).toEqual(['r1']);
  });

  it('серверной нет → локальная без изменений', () => {
    expect(mergeRecent(['l1'], null)).toEqual(['l1']);
    expect(mergeRecent(['l1'], [])).toEqual(['l1']);
  });

  it('обе пусты → пустая история', () => {
    expect(mergeRecent([], [])).toEqual([]);
  });

  it('локальный порядок сохраняется, новые с сервера — в конец', () => {
    expect(mergeRecent(['l1', 'l2'], ['r1', 'l1'])).toEqual(['l1', 'l2', 'r1']);
  });

  it('лимит при объединении', () => {
    const local = Array.from({ length: 8 }, (_, i) => `l${i}`);
    const remote = Array.from({ length: 8 }, (_, i) => `r${i}`);
    const merged = mergeRecent(local, remote);
    expect(merged).toHaveLength(RECENTLY_VIEWED_MAX);
    expect(merged[0]).toBe('l0'); // свежий локальный не вытеснен
  });

  it('не мутирует входы', () => {
    const local = ['a', 'b'];
    const remote = ['c'];
    mergeRecent(local, remote);
    expect(local).toEqual(['a', 'b']);
    expect(remote).toEqual(['c']);
  });
});

describe('recentSignature: слепок для дедупликации PUT', () => {
  it('совпадает для одинаковых списков, различается для разных', () => {
    expect(recentSignature(['a', 'b'])).toBe(recentSignature(['a', 'b']));
    expect(recentSignature(['a', 'b'])).not.toBe(recentSignature(['b', 'a'])); // порядок = свежесть
    expect(recentSignature([])).not.toBe(recentSignature(['a']));
  });
});

describe('planRecentSync: adopt/merge по маркеру последнего синка', () => {
  const markerFor = (userId: string, list: string[]): RecentSyncMarker => ({
    userId,
    signature: recentSignature(list),
  });

  it('регрессия «воскрешения»: очистка истории на другом устройстве переносится (adopt)', () => {
    // Локаль не менялась с последнего синка; на другом устройстве историю
    // очистили. Обязаны принять пустую, а не сливать — union возвращал
    // записи при каждой перезагрузке и отправлял их обратно на сервер.
    const local = ['a', 'b'];
    const plan = planRecentSync(local, [], markerFor('user-1', local), 'user-1');
    expect(plan.mode).toBe('adopt');
    expect(plan.items).toEqual([]);
  });

  it('adopt: новые просмотры с другого устройства переносятся', () => {
    const local = ['a'];
    const remote = ['c', 'a']; // на другом устройстве смотрели «c»
    const plan = planRecentSync(local, remote, markerFor('user-1', local), 'user-1');
    expect(plan.mode).toBe('adopt');
    expect(plan.items).toEqual(['c', 'a']);
  });

  it('adopt при пустом серверном (null — ключ удалён) → пустая история', () => {
    const local = ['a'];
    const plan = planRecentSync(local, null, markerFor('user-1', local), 'user-1');
    expect(plan.mode).toBe('adopt');
    expect(plan.items).toEqual([]);
  });

  it('маркера нет (первый вход на устройстве) → merge (union по slug)', () => {
    const plan = planRecentSync(['l1'], ['r1'], null, 'user-1');
    expect(plan.mode).toBe('merge');
    expect(plan.items).toEqual(['l1', 'r1']);
  });

  it('локальное менялось после синка (гостевые просмотры, сорванный PUT) → merge', () => {
    const synced = ['a'];
    const edited = ['guest', 'a'];
    const remote = ['a'];
    const plan = planRecentSync(edited, remote, markerFor('user-1', synced), 'user-1');
    expect(plan.mode).toBe('merge');
    expect(plan.items).toEqual(['guest', 'a']);
  });

  it('маркер чужого пользователя → merge', () => {
    const local = ['a'];
    const plan = planRecentSync(local, ['a'], markerFor('user-2', local), 'user-1');
    expect(plan.mode).toBe('merge');
  });

  it('битый маркер → merge; кастомный max уважается в merge-ветке', () => {
    const broken: RecentSyncMarker = { userId: 'user-1', signature: 'мусор' };
    expect(planRecentSync(['a'], ['b'], broken, 'user-1').mode).toBe('merge');
    // локальный порядок + новые с сервера в конец, кап max
    const plan = planRecentSync(['a', 'b', 'c'], ['d'], broken, 'user-1', 2);
    expect(plan.items).toEqual(['a', 'b']);
  });
});

describe('server/lib/recentlyViewedHelpers: чтение и запись (in-memory KV fallback)', () => {
  it('writeUserRecentlyViewed сохраняет историю, readUserRecentlyViewed возвращает её', async () => {
    const saved = await writeUserRecentlyViewed(bareEvent, 'user-1', ['a', 'b']);
    expect(saved).not.toBeNull();
    expect(saved!.items).toEqual(['a', 'b']);
    expect(new Date(saved!.updatedAt).toString()).not.toBe('Invalid Date');

    const read = await readUserRecentlyViewed(bareEvent, 'user-1');
    expect(read).not.toBeNull();
    expect(read!.items).toEqual(['a', 'b']);
  });

  it('пустая история удаляет ключ (не копим пустые записи в KV)', async () => {
    await writeUserRecentlyViewed(bareEvent, 'user-2', ['a']);
    const result = await writeUserRecentlyViewed(bareEvent, 'user-2', []);
    expect(result).toBeNull();
    expect(await readUserRecentlyViewed(bareEvent, 'user-2')).toBeNull();
  });

  it('не-список → исключение (PUT вернёт 400)', async () => {
    await expect(writeUserRecentlyViewed(bareEvent, 'user-3', 'мусор')).rejects.toThrow(
      'валидацию',
    );
    await expect(writeUserRecentlyViewed(bareEvent, 'user-3', 42)).rejects.toThrow('валидацию');
  });

  it('чужая история недоступна: ключ по userId', async () => {
    await writeUserRecentlyViewed(bareEvent, 'user-a', ['pa']);
    expect(await readUserRecentlyViewed(bareEvent, 'user-b')).toBeNull();
  });

  it('битая запись в KV при чтении → null (не падаем)', async () => {
    const { kvPutJSON } = await import('../../server/lib/storage');
    await kvPutJSON(bareEvent, 'recently-viewed:user-5', { items: 'битый массив' });
    expect(await readUserRecentlyViewed(bareEvent, 'user-5')).toBeNull();
    await kvPutJSON(bareEvent, 'recently-viewed:user-6', 'строка вместо объекта');
    expect(await readUserRecentlyViewed(bareEvent, 'user-6')).toBeNull();
  });
});
