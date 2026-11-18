// Тесты синка корзины с аккаунтом:
//  - app/utils/cartSync.ts — mergeCarts / normalizeRemoteCart / cartSignature
//    (общая логика клиента и сервера);
//  - server/lib/cartHelpers.ts — KV read/write поверх in-memory fallback
//    (binдингов KV в тестах нет — см. storage-kv-fallback.test.ts).
import { describe, expect, it } from 'vitest';
import type { H3Event } from 'h3';
import {
  cartSignature,
  mergeCarts,
  normalizeRemoteCart,
  SYNC_CART_MAX_ITEMS,
  type SyncableCart,
} from '../../app/utils/cartSync';
import { readUserCart, writeUserCart } from '../../server/lib/cartHelpers';

const item = (overrides: Partial<SyncableCart['items'][number]> & { id: string }) => ({
  id: overrides.id,
  name: 'Товар',
  price: 100,
  quantity: 1,
  variantId: null,
  variantName: null,
  description: '',
  currentPrice: 100,
  originalPrice: 100,
  image: '',
  category: 'Другое',
  stockQuantity: 10,
  inStock: true,
  discount: 0,
  slug: 'tovar',
  ...overrides,
});

const cart = (overrides: Partial<SyncableCart> = {}): SyncableCart => ({
  items: [],
  promo: '',
  deliveryMethod: 'courier',
  ...overrides,
});

const bareEvent = {} as H3Event;

describe('normalizeRemoteCart: санитизация серверной корзины', () => {
  it('валидная корзина проходит насквозь', () => {
    const raw = {
      items: [item({ id: 'p1', quantity: 2 })],
      promo: { code: 'SALE10', type: 'percent', value: 10 },
      deliveryMethod: 'pickup',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    const normalized = normalizeRemoteCart(raw);
    expect(normalized).not.toBeNull();
    expect(normalized!.items).toHaveLength(1);
    expect(normalized!.items[0]).toMatchObject({ id: 'p1', quantity: 2, price: 100 });
    expect(normalized!.promo).toEqual({ code: 'SALE10', type: 'percent', value: 10 });
    expect(normalized!.deliveryMethod).toBe('pickup');
    // updatedAt — не часть SyncableCart (в merge не участвует)
    expect('updatedAt' in normalized!).toBe(false);
  });

  it('мусор вместо корзины → null', () => {
    expect(normalizeRemoteCart(null)).toBeNull();
    expect(normalizeRemoteCart('строка')).toBeNull();
    expect(normalizeRemoteCart({})).toBeNull();
    expect(normalizeRemoteCart({ items: 'не массив' })).toBeNull();
  });

  it('битые позиции отбрасываются, валидные остаются', () => {
    const raw = {
      items: [
        item({ id: 'ok1' }),
        null,
        'строка',
        { id: '', quantity: 1 }, // нет id
        { id: 'без-чисел' }, // нет quantity → 1
      ],
    };
    const normalized = normalizeRemoteCart(raw)!;
    expect(normalized.items.map((i) => i.id)).toEqual(['ok1', 'без-чисел']);
    expect(normalized.items[1].quantity).toBe(1);
  });

  it('quantity зажимается складом (1..stockQuantity)', () => {
    const normalized = normalizeRemoteCart({
      items: [item({ id: 'a', quantity: 50, stockQuantity: 3 }), item({ id: 'b', quantity: 0 })],
    })!;
    expect(normalized.items[0].quantity).toBe(3);
    expect(normalized.items[1].quantity).toBe(1); // 0 недопустим
  });

  it('числовые капы: цена не отрицательная, лимит 100 позиций', () => {
    const many = Array.from({ length: 130 }, (_, i) => item({ id: `p${i}` }));
    const normalized = normalizeRemoteCart({
      items: many,
    })!;
    expect(normalized.items).toHaveLength(SYNC_CART_MAX_ITEMS);

    const negative = normalizeRemoteCart({
      items: [item({ id: 'n', price: -5, currentPrice: -1 })],
    })!;
    expect(negative.items[0].price).toBe(0);
    expect(negative.items[0].currentPrice).toBe(0);
  });

  it('промокод и доставка: мусор → дефолты', () => {
    const normalized = normalizeRemoteCart({
      items: [item({ id: 'a' })],
      promo: { code: 'X', type: 'бесконечная-скидка', value: 'всё' },
      deliveryMethod: 'телепортация',
    })!;
    expect(normalized.promo).toBe('');
    expect(normalized.deliveryMethod).toBe('courier');

    const fixed = normalizeRemoteCart({
      items: [],
      promo: { code: 'FIX', type: 'fixed', value: 150.7 },
      deliveryMethod: 'post',
    })!;
    expect(fixed.promo).toEqual({ code: 'FIX', type: 'fixed', value: 151 });
    expect(fixed.deliveryMethod).toBe('post');
  });

  it('неизвестные поля позиций не проходят в стейт/KV', () => {
    const normalized = normalizeRemoteCart({
      items: [{ ...item({ id: 'a' }), hacked: 'payload', isAdmin: true }],
    })!;
    expect('hacked' in normalized.items[0]).toBe(false);
    expect('isAdmin' in normalized.items[0]).toBe(false);
  });
});

describe('mergeCarts: объединение локальной и серверной корзины', () => {
  it('локальная пуста → серверная целиком (вход на новом устройстве)', () => {
    const remote = cart({
      items: [item({ id: 'r1', quantity: 2 })],
      promo: { code: 'FIX', type: 'fixed', value: 100 },
      deliveryMethod: 'post',
    });
    const merged = mergeCarts(cart(), remote);
    expect(merged.items.map((i) => i.id)).toEqual(['r1']);
    expect(merged.promo).toEqual({ code: 'FIX', type: 'fixed', value: 100 });
    expect(merged.deliveryMethod).toBe('post');
  });

  it('серверной корзины нет → локальная без изменений', () => {
    const local = cart({ items: [item({ id: 'l1' })], deliveryMethod: 'pickup' });
    const merged = mergeCarts(local, null);
    expect(merged).toEqual({ ...local, items: local.items });
  });

  it('обе пусты → пустая корзина', () => {
    const merged = mergeCarts(cart(), null);
    expect(merged.items).toEqual([]);
    expect(merged.deliveryMethod).toBe('courier');
  });

  it('одна и та же позиция на двух устройствах: количество суммируется с капом по складу', () => {
    const local = cart({ items: [item({ id: 'p1', quantity: 3, stockQuantity: 5 })] });
    const remote = cart({ items: [item({ id: 'p1', quantity: 4, stockQuantity: 5 })] });
    const merged = mergeCarts(local, remote);
    expect(merged.items).toHaveLength(1);
    expect(merged.items[0].quantity).toBe(5); // 3 + 4, но склад 5
  });

  it('снапшот существующей позиции остаётся локальным (заморожен в языке страницы)', () => {
    const local = cart({ items: [item({ id: 'p1', name: 'Куртка (RU)', quantity: 1 })] });
    const remote = cart({
      items: [item({ id: 'p1', name: 'Jacket (EN from ES-device)', quantity: 1 })],
    });
    const merged = mergeCarts(local, remote);
    expect(merged.items[0].name).toBe('Куртка (RU)');
    expect(merged.items[0].quantity).toBe(2);
  });

  it('разные позиции: объединение, новые с сервера — в конец', () => {
    const local = cart({ items: [item({ id: 'l1' }), item({ id: 'l2' })] });
    const remote = cart({ items: [item({ id: 'r1' }), item({ id: 'l1' })] });
    const merged = mergeCarts(local, remote);
    expect(merged.items.map((i) => i.id)).toEqual(['l1', 'l2', 'r1']);
  });

  it('промокод: локальный выигрывает; локального нет → серверный', () => {
    const promo = { code: 'LOCAL', type: 'percent' as const, value: 5 };
    const remotePromo = { code: 'REMOTE', type: 'fixed' as const, value: 50 };
    expect(
      mergeCarts(
        cart({ items: [item({ id: 'a' })], promo }),
        cart({ items: [item({ id: 'b' })], promo: remotePromo }),
      ).promo,
    ).toEqual(promo);
    expect(
      mergeCarts(
        cart({ items: [item({ id: 'a' })], promo: '' }),
        cart({ items: [item({ id: 'b' })], promo: remotePromo }),
      ).promo,
    ).toEqual(remotePromo);
  });

  it('способ доставки остаётся локальным (выбор этого устройства)', () => {
    const local = cart({ items: [item({ id: 'a' })], deliveryMethod: 'pickup' });
    const remote = cart({ items: [item({ id: 'b' })], deliveryMethod: 'post' });
    expect(mergeCarts(local, remote).deliveryMethod).toBe('pickup');
  });

  it('лимит 100 позиций при объединении', () => {
    const local = cart({ items: Array.from({ length: 60 }, (_, i) => item({ id: `l${i}` })) });
    const remote = cart({ items: Array.from({ length: 60 }, (_, i) => item({ id: `r${i}` })) });
    expect(mergeCarts(local, remote).items).toHaveLength(SYNC_CART_MAX_ITEMS);
  });

  it('не мутирует входы', () => {
    const local = cart({ items: [item({ id: 'p1', quantity: 1, stockQuantity: 5 })] });
    const remote = cart({ items: [item({ id: 'p1', quantity: 2, stockQuantity: 5 })] });
    mergeCarts(local, remote);
    expect(local.items[0].quantity).toBe(1);
    expect(remote.items[0].quantity).toBe(2);
  });
});

describe('cartSignature: слепок для дедупликации PUT', () => {
  it('порядок ключей позиции не меняет слепок', () => {
    const a = cart({ items: [{ ...item({ id: 'p1' }), price: 100, quantity: 1 }] });
    const b = cart({ items: [{ ...item({ id: 'p1' }), quantity: 1, price: 100 }] });
    expect(cartSignature(a)).toBe(cartSignature(b));
  });

  it('реальное изменение меняет слепок', () => {
    const a = cart({ items: [item({ id: 'p1', quantity: 1 })] });
    const b = cart({ items: [item({ id: 'p1', quantity: 2 })] });
    const c = cart({
      items: [item({ id: 'p1', quantity: 1 })],
      promo: { code: 'X', type: 'fixed', value: 10 },
    });
    expect(cartSignature(a)).not.toBe(cartSignature(b));
    expect(cartSignature(a)).not.toBe(cartSignature(c));
  });
});

describe('server/lib/cartHelpers: чтение и запись (in-memory KV fallback)', () => {
  it('writeUserCart сохраняет корзину, readUserCart возвращает её', async () => {
    const source = cart({ items: [item({ id: 'p1', quantity: 2 })], deliveryMethod: 'pickup' });
    const saved = await writeUserCart(bareEvent, 'user-1', source);
    expect(saved).not.toBeNull();
    expect(saved!.items).toHaveLength(1);
    expect(new Date(saved!.updatedAt).toString()).not.toBe('Invalid Date');

    const read = await readUserCart(bareEvent, 'user-1');
    expect(read).not.toBeNull();
    expect(read!.items[0]).toMatchObject({ id: 'p1', quantity: 2 });
    expect(read!.deliveryMethod).toBe('pickup');
  });

  it('пустая корзина удаляет ключ (не копим пустые записи в KV)', async () => {
    await writeUserCart(bareEvent, 'user-2', cart({ items: [item({ id: 'p1' })] }));
    const result = await writeUserCart(bareEvent, 'user-2', cart());
    expect(result).toBeNull();
    expect(await readUserCart(bareEvent, 'user-2')).toBeNull();
  });

  it('не-корзина → исключение (PUT вернёт 400)', async () => {
    await expect(writeUserCart(bareEvent, 'user-3', 'мусор')).rejects.toThrow('валидацию');
    await expect(writeUserCart(bareEvent, 'user-3', 42)).rejects.toThrow('валидацию');
  });

  it('чужая корзина недоступна: ключ по userId', async () => {
    await writeUserCart(bareEvent, 'user-a', cart({ items: [item({ id: 'pa' })] }));
    expect(await readUserCart(bareEvent, 'user-b')).toBeNull();
  });

  it('битая запись в KV при чтении → null (не падаем)', async () => {
    // пишет напрямую мимо валидации: сымитируем старую/битую схему
    await writeUserCart(bareEvent, 'user-4', cart({ items: [item({ id: 'p1' })] }));
    const read = await readUserCart(bareEvent, 'user-4');
    expect(read).not.toBeNull();
    // и заведомо битая структура
    const { kvPutJSON } = await import('../../server/lib/storage');
    await kvPutJSON(bareEvent, 'cart:user-5', { items: 'битый массив' });
    expect(await readUserCart(bareEvent, 'user-5')).toBeNull();
  });
});
