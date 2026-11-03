// Тесты server/lib/sessions.ts — инвалидация «чужих» сессий пользователя,
// и kvListKeys (fallback in-memory) из server/lib/storage.ts.
import { describe, expect, it } from 'vitest';
import { destroyOtherSessions, sessionsToInvalidate } from '../../server/lib/sessions';
import { kvDelete, kvGetJSON, kvListKeys, kvPutJSON } from '../../server/lib/storage';

describe('sessionsToInvalidate', () => {
  const entries = [
    { key: 'session:aaa', record: { userId: 'u1' } }, // текущая сессия u1
    { key: 'session:bbb', record: { userId: 'u1' } }, // другая сессия u1
    { key: 'session:ccc', record: { userId: 'u2' } }, // чужая сессия
    { key: 'session:ddd', record: null }, // битая запись
    { key: 'session:eee', record: { userId: 'u1', createdAt: '2026-01-01' } },
  ];

  it('гасит сессии пользователя, кроме текущей', () => {
    expect(sessionsToInvalidate(entries, 'u1', 'session:aaa')).toEqual([
      'session:bbb',
      'session:eee',
    ]);
  });

  it('без keepKey гасит все сессии пользователя', () => {
    expect(sessionsToInvalidate(entries, 'u1')).toEqual([
      'session:aaa',
      'session:bbb',
      'session:eee',
    ]);
  });

  it('не трогает чужие сессии и битые записи', () => {
    const result = sessionsToInvalidate(entries, 'u2', 'session:ccc');
    expect(result).toEqual([]);
  });

  it('возвращает пустой список, если у пользователя одна сессия', () => {
    const single = [{ key: 'session:only', record: { userId: 'u9' } }];
    expect(sessionsToInvalidate(single, 'u9', 'session:only')).toEqual([]);
  });
});

describe('kvListKeys (in-memory fallback)', () => {
  // event без cloudflare.env.KV → in-memory Map
  const fakeEvent = { context: {} } as never;
  const prefix = 'test:list:sessions:';

  it('возвращает только ключи с нужным префиксом', async () => {
    await kvPutJSON(fakeEvent, `${prefix}a`, { userId: 'u1' });
    await kvPutJSON(fakeEvent, `${prefix}b`, { userId: 'u2' });
    await kvPutJSON(fakeEvent, 'test:list:other:x', { userId: 'u3' });

    const keys = await kvListKeys(fakeEvent, prefix);
    expect(keys.sort()).toEqual([`${prefix}a`, `${prefix}b`]);
  });

  it('после удаления ключ не листится', async () => {
    await kvPutJSON(fakeEvent, `${prefix}temp`, { userId: 'u1' });
    await kvDelete(fakeEvent, `${prefix}temp`);

    const keys = await kvListKeys(fakeEvent, prefix);
    expect(keys).not.toContain(`${prefix}temp`);
  });
});

describe('destroyOtherSessions (интеграция с in-memory KV)', () => {
  const fakeEvent = { context: {} } as never;
  // destroyOtherSessions листит префикс session: — эмулируем его через
  // реальные ключи session:<token> (в тестах KV общий, изолируем userId)
  const USER = 'u-test-' + Math.random().toString(36).slice(2);

  it('гасит чужие сессии, но сохраняет текущую (голый токен из куки)', async () => {
    const current = 'tok-current-abc';
    const other1 = 'tok-other-1';
    const other2 = 'tok-other-2';
    const stranger = 'tok-stranger';

    await kvPutJSON(fakeEvent, `session:${current}`, { userId: USER });
    await kvPutJSON(fakeEvent, `session:${other1}`, { userId: USER });
    await kvPutJSON(fakeEvent, `session:${other2}`, { userId: USER });
    await kvPutJSON(fakeEvent, `session:${stranger}`, { userId: 'someone-else' });

    // keepKey — как в эндпоинтах: СЫРОЕ значение куки, без префикса session:
    const ended = await destroyOtherSessions(fakeEvent, USER, current);

    expect(ended).toBe(2);
    // Текущая сессия жива
    expect(await kvGetJSON(fakeEvent, `session:${current}`)).not.toBeNull();
    // Чужая сессия другого пользователя не тронута
    expect(await kvGetJSON(fakeEvent, `session:${stranger}`)).not.toBeNull();
    // Свои другие сессии удалены
    expect(await kvGetJSON(fakeEvent, `session:${other1}`)).toBeNull();
    expect(await kvGetJSON(fakeEvent, `session:${other2}`)).toBeNull();

    // Cleanup: общий in-memory KV между тестами файла
    await kvDelete(fakeEvent, `session:${current}`);
    await kvDelete(fakeEvent, `session:${stranger}`);
  });
});
