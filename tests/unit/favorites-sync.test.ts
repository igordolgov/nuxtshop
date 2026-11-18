// Тесты синка избранного с аккаунтом:
//  - app/utils/favoritesSync.ts — mergeFavorites / normalizeRemoteFavorites /
//    favoritesSignature (общая логика клиента и сервера);
//  - server/lib/favoritesHelpers.ts — KV read/write поверх in-memory fallback
//    (биндингов KV в тестах нет — см. cart-sync.test.ts).
import { describe, expect, it } from 'vitest';
import type { H3Event } from 'h3';
import {
  favoritesSignature,
  mergeFavorites,
  normalizeRemoteFavorites,
  sanitizeFavorite,
  SYNC_FAVORITES_MAX,
  type SyncFavorite,
} from '../../app/utils/favoritesSync';
import { readUserFavorites, writeUserFavorites } from '../../server/lib/favoritesHelpers';

const fav = (overrides: Partial<SyncFavorite> & { id?: string | null }): SyncFavorite => ({
  id: 'p1',
  slug: 'tovar',
  name: 'Товар',
  price: 100,
  image: '/img.webp',
  category: 'Другое',
  categorySlug: 'other',
  brand: 'Brand',
  description: 'Описание',
  inStock: true,
  stockQuantity: 10,
  addedAt: '2025-01-01T00:00:00.000Z',
  ...overrides,
});

const bareEvent = {} as H3Event;

describe('sanitizeFavorite: белый список полей', () => {
  it('валидный снапшот проходит насквозь', () => {
    const safe = sanitizeFavorite(fav());
    expect(safe).not.toBeNull();
    expect(safe).toMatchObject({ id: 'p1', name: 'Товар', price: 100, inStock: true });
  });

  it('запись без непустого id отбрасывается', () => {
    expect(sanitizeFavorite(null)).toBeNull();
    expect(sanitizeFavorite('строка')).toBeNull();
    expect(sanitizeFavorite(fav({ id: '' }))).toBeNull();
    expect(sanitizeFavorite(fav({ id: null }))).toBeNull();
  });

  it('неизвестные поля не проходят в стейт/KV', () => {
    const safe = sanitizeFavorite({ ...fav(), hacked: 'payload', isAdmin: true });
    expect('hacked' in safe!).toBe(false);
    expect('isAdmin' in safe!).toBe(false);
  });

  it('строковые/числовые капы', () => {
    const safe = sanitizeFavorite(fav({ name: 'x'.repeat(400), price: -5, stockQuantity: 7.9 }));
    expect(safe!.name).toHaveLength(300);
    expect(safe!.price).toBe(0); // отрицательная цена → 0
    expect(safe!.stockQuantity).toBe(8); // округление
  });

  it('легаси-категория объектом: остаётся только { name }', () => {
    expect(sanitizeFavorite(fav({ category: { name: 'Категория', extra: 1 } }))!.category).toEqual({
      name: 'Категория',
    });
    expect(sanitizeFavorite(fav({ category: 'Электроника' }))!.category).toBe('Электроника');
    expect(sanitizeFavorite(fav({ category: 42 }))!.category).toBeNull();
  });

  it('inStock по умолчанию true, addedAt обрезается до 40 символов', () => {
    const safe = sanitizeFavorite({ id: 'p1', name: 'Т', price: null, stockQuantity: null });
    expect(safe!.inStock).toBe(true);
    expect(safe!.slug).toBeNull();
    expect(safe!.addedAt).toBe('');
  });
});

describe('normalizeRemoteFavorites: санитизация серверного списка', () => {
  it('валидный список проходит насквозь', () => {
    const normalized = normalizeRemoteFavorites({ items: [fav(), fav({ id: 'p2' })] });
    expect(normalized).not.toBeNull();
    expect(normalized!.map((f) => f.id)).toEqual(['p1', 'p2']);
  });

  it('мусор вместо списка → null', () => {
    expect(normalizeRemoteFavorites(null)).toBeNull();
    expect(normalizeRemoteFavorites('строка')).toBeNull();
    expect(normalizeRemoteFavorites({})).toBeNull();
    expect(normalizeRemoteFavorites({ items: 'не массив' })).toBeNull();
  });

  it('битые записи отбрасываются, валидные остаются', () => {
    const normalized = normalizeRemoteFavorites([
      fav({ id: 'ok1' }),
      null,
      'строка',
      { id: '', name: 'без id' },
      { id: 'ok2' },
    ])!;
    expect(normalized.map((f) => f.id)).toEqual(['ok1', 'ok2']);
  });

  it('дубли id схлопываются (остаётся первый — самый свежий)', () => {
    const normalized = normalizeRemoteFavorites([
      fav({ id: 'p1', name: 'Свежий' }),
      fav({ id: 'p1', name: 'Старый' }),
    ])!;
    expect(normalized).toHaveLength(1);
    expect(normalized[0].name).toBe('Свежий');
  });

  it('лимит SYNC_FAVORITES_MAX позиций', () => {
    const many = Array.from({ length: SYNC_FAVORITES_MAX + 30 }, (_, i) => fav({ id: `p${i}` }));
    expect(normalizeRemoteFavorites(many)!.length).toBe(SYNC_FAVORITES_MAX);
  });
});

describe('mergeFavorites: объединение локального и серверного списков', () => {
  it('локальный пуст → серверный целиком (вход на новом устройстве)', () => {
    const remote = [fav({ id: 'r1', addedAt: '2025-06-01T00:00:00.000Z' })];
    const merged = mergeFavorites([], remote);
    expect(merged.map((f) => f.id)).toEqual(['r1']);
  });

  it('серверного нет → локальный без изменений', () => {
    const local = [fav({ id: 'l1' })];
    expect(mergeFavorites(local, null)).toEqual(local.map((f) => ({ ...f })));
    expect(mergeFavorites(null, null)).toEqual([]);
  });

  it('порядок результата: по addedAt от свежих к старым', () => {
    const local = [
      fav({ id: 'l1', addedAt: '2025-03-01T00:00:00.000Z' }),
      fav({ id: 'l2', addedAt: '2025-05-01T00:00:00.000Z' }),
    ];
    const remote = [fav({ id: 'r1', addedAt: '2025-04-01T00:00:00.000Z' })];
    const merged = mergeFavorites(local, remote);
    expect(merged.map((f) => f.id)).toEqual(['l2', 'r1', 'l1']);
  });

  it('дубликат: снапшот с более свежим addedAt выигрывает', () => {
    const local = [
      fav({ id: 'p1', name: 'Старый', price: 100, addedAt: '2025-01-01T00:00:00.000Z' }),
    ];
    const remote = [
      fav({ id: 'p1', name: 'Свежий', price: 90, addedAt: '2025-06-01T00:00:00.000Z' }),
    ];
    const merged = mergeFavorites(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ name: 'Свежий', price: 90 });

    const back = mergeFavorites(
      [fav({ id: 'p1', name: 'Свежий', price: 90, addedAt: '2025-06-01T00:00:00.000Z' })],
      [fav({ id: 'p1', name: 'Старый', price: 100, addedAt: '2025-01-01T00:00:00.000Z' })],
    );
    expect(back[0].name).toBe('Свежий');
  });

  it('записи без id — мусор: отбрасываются merge', () => {
    const local = [fav({ id: null, name: 'Без id' })];
    const remote = [fav({ id: 'r1' })];
    const merged = mergeFavorites(local, remote);
    expect(merged.map((f) => f.id)).toEqual(['r1']);
  });

  it('лимит при объединении', () => {
    const local = Array.from({ length: 120 }, (_, i) => fav({ id: `l${i}` }));
    const remote = Array.from({ length: 120 }, (_, i) => fav({ id: `r${i}` }));
    expect(mergeFavorites(local, remote)).toHaveLength(SYNC_FAVORITES_MAX);
  });

  it('не мутирует входы', () => {
    const local = [fav({ id: 'p1', name: 'Локальный' })];
    const remote = [fav({ id: 'p1', name: 'Свежее имя', addedAt: '2025-06-01T00:00:00.000Z' })];
    mergeFavorites(local, remote);
    expect(local[0].name).toBe('Локальный');
    expect(remote[0].name).toBe('Свежее имя');
  });
});

describe('favoritesSignature: слепок для дедупликации PUT', () => {
  it('порядок ключей снапшота не меняет слепок', () => {
    const a = [fav({ id: 'p1', name: 'Т', price: 100 })];
    const b = [{ ...fav({ id: 'p1' }), price: 100, name: 'Т' }];
    expect(favoritesSignature(a)).toBe(favoritesSignature(b as SyncFavorite[]));
  });

  it('реальное изменение меняет слепок', () => {
    const a = [fav({ id: 'p1' })];
    const b = [fav({ id: 'p2' })];
    expect(favoritesSignature(a)).not.toBe(favoritesSignature(b));
    expect(favoritesSignature(a)).not.toBe(favoritesSignature([...a, b[0]]));
  });
});

describe('server/lib/favoritesHelpers: чтение и запись (in-memory KV fallback)', () => {
  it('writeUserFavorites сохраняет список, readUserFavorites возвращает его', async () => {
    const source = [fav(), fav({ id: 'p2', addedAt: '2025-02-01T00:00:00.000Z' })];
    const saved = await writeUserFavorites(bareEvent, 'user-1', source);
    expect(saved).not.toBeNull();
    expect(saved!.items).toHaveLength(2);
    expect(new Date(saved!.updatedAt).toString()).not.toBe('Invalid Date');

    const read = await readUserFavorites(bareEvent, 'user-1');
    expect(read).not.toBeNull();
    expect(read!.items[0]).toMatchObject({ id: 'p1', price: 100 });
  });

  it('пустой список удаляет ключ (не копим пустые записи в KV)', async () => {
    await writeUserFavorites(bareEvent, 'user-2', [fav()]);
    const result = await writeUserFavorites(bareEvent, 'user-2', []);
    expect(result).toBeNull();
    expect(await readUserFavorites(bareEvent, 'user-2')).toBeNull();
  });

  it('не-список → исключение (PUT вернёт 400)', async () => {
    await expect(writeUserFavorites(bareEvent, 'user-3', 'мусор')).rejects.toThrow('валидацию');
    await expect(writeUserFavorites(bareEvent, 'user-3', 42)).rejects.toThrow('валидацию');
    await expect(writeUserFavorites(bareEvent, 'user-3', { items: 'не массив' })).rejects.toThrow(
      'валидацию',
    );
  });

  it('чужое избранное недоступно: ключ по userId', async () => {
    await writeUserFavorites(bareEvent, 'user-a', [fav({ id: 'pa' })]);
    expect(await readUserFavorites(bareEvent, 'user-b')).toBeNull();
  });

  it('битая запись в KV при чтении → null (не падаем)', async () => {
    const { kvPutJSON } = await import('../../server/lib/storage');
    await kvPutJSON(bareEvent, 'favorites:user-5', { items: 'битый массив' });
    expect(await readUserFavorites(bareEvent, 'user-5')).toBeNull();
    await kvPutJSON(bareEvent, 'favorites:user-6', 'строка вместо объекта');
    expect(await readUserFavorites(bareEvent, 'user-6')).toBeNull();
  });
});
