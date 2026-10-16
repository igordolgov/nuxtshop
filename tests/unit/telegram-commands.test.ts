// Тесты server/lib/telegramCommands.js — слэш-команды админ-бота.
// Мокируются KV (как в остальных тестах) и модуль telegram (sendMessage):
// ловим ТРЕТИЙ аргумент sendMessage(env, chatId, text) — текст ответа.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const kvStore = new Map<string, unknown>();

vi.mock('../../server/lib/storage', () => ({
  kvGetJSON: vi.fn(async (_event: unknown, key: string) =>
    (kvStore.get(key) as unknown) ?? null,
  ),
  kvPutJSON: vi.fn(async (_event: unknown, key: string, value: unknown) => {
    kvStore.set(key, structuredClone(value));
  }),
  kvDelete: vi.fn(async (_event: unknown, key: string) => {
    kvStore.delete(key);
  }),
}));

vi.mock('../../server/lib/telegram', () => ({
  sendMessage: vi.fn(async () => true),
}));

import { sendMessage } from '../../server/lib/telegram';
import { handleMessage } from '../../server/lib/telegramCommands';

const event = {} as never;
const env = { TELEGRAM_ADMIN_CHAT_ID: '42' } as never;

/** Последний текст, который бот отправил админу */
function lastReply(): string {
  const calls = vi.mocked(sendMessage).mock.calls;
  const last = calls.at(-1);
  return last?.[2] ?? '';
}

beforeEach(() => {
  kvStore.clear();
  vi.mocked(sendMessage).mockClear();
});

describe('handleMessage — разбор команд', () => {
  it('не-команда возвращает false и ничего не отправляет', async () => {
    expect(await handleMessage(event, env, { text: 'просто текст' })).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('неизвестная команда — false, бот молчит', async () => {
    expect(await handleMessage(event, env, { text: '/hакни-меня' })).toBe(false);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('регистр и суффикс бота не мешают: /PENDING@shop_bot работает', async () => {
    kvStore.set('data:orders', []);
    expect(await handleMessage(event, env, { text: '/PENDING@shop_bot' })).toBe(true);
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('/help и /start присылают справку со списком команд', async () => {
    await handleMessage(event, env, { text: '/help' });
    expect(lastReply()).toContain('/pending');
    expect(lastReply()).toContain('/stock');

    await handleMessage(event, env, { text: '/start' });
    expect(lastReply()).toContain('Команды бота');
  });
});

describe('/pending — новые заказы', () => {
  it('нет новых — «всё обработано»', async () => {
    kvStore.set('data:orders', [
      { id: 'ORD-1', status: 'delivered', total: 100, items: [], customer: {}, createdAt: '2026-01-01T10:00' },
    ]);
    await handleMessage(event, env, { text: '/pending' });
    expect(lastReply()).toContain('Новых заказов нет');
  });

  it('показывает только новые: id, сумму и контакты', async () => {
    kvStore.set('data:orders', [
      {
        id: 'ORD-NEW-1',
        status: 'new',
        total: 1500,
        items: [{ quantity: 1 }],
        deliveryMethod: 'courier',
        customer: { name: 'Иван <script>', phone: '+79991234567' },
        createdAt: '2026-06-01T10:30:00.000Z',
      },
      {
        id: 'ORD-OLD',
        status: 'confirmed',
        total: 900,
        items: [],
        customer: { name: 'Пётр', phone: '+79990000000' },
        createdAt: '2026-06-01T09:00:00.000Z',
      },
    ]);
    await handleMessage(event, env, { text: '/pending' });
    const reply = lastReply();
    expect(reply).toContain('Новых заказов: 1');
    expect(reply).toContain('ORD-NEW-1');
    expect(reply).not.toContain('ORD-OLD');
    expect(reply).toContain('Иван &lt;script&gt;'); // HTML экранируется
    expect(reply).toContain('+79991234567');
  });
});

describe('/stats — статистика за сегодня', () => {
  it('выручка и средний чек по не-отменённым заказам', async () => {
    const today = new Date().toISOString();
    kvStore.set('data:orders', [
      { id: 'A', status: 'new', total: 1000, items: [{ quantity: 1 }], customer: {}, createdAt: today },
      { id: 'B', status: 'delivered', total: 500, items: [{ quantity: 2 }], customer: {}, createdAt: today },
      { id: 'C', status: 'cancelled', total: 777, items: [], customer: {}, createdAt: today },
      { id: 'D', status: 'new', total: 9999, items: [], customer: {}, createdAt: '2020-01-01T00:00:00.000Z' },
    ]);
    await handleMessage(event, env, { text: '/stats' });
    const reply = lastReply();
    // 1000 + 500 = 1500; Intl.NumberFormat('ru-RU') ставит неразрывный пробел
    expect(reply).toMatch(/1[\s\u00A0\u202F]500/);
    expect(reply).toMatch(/Заказов: 3/);
    expect(reply).toContain('отменено: 1');
    expect(reply).toMatch(/3[\s\u00A0\u202F]шт\.|Товаров продано: 3/);
    // Средний чек 750, чужой день и отменённый не попадают
    expect(reply).toMatch(/750/);
  });
});

describe('/stock — заканчивающиеся товары', () => {
  it('товары с малым остатком, отсортированы по возрастанию', async () => {
    kvStore.set('data:products', [
      { id: '1', slug: 'a', name: 'Кружка <b>', price: 1, stockQuantity: 3, categories: [] },
      { id: '2', slug: 'b', name: 'Тарелка', price: 1, stockQuantity: 0, categories: [] },
      { id: '3', slug: 'c', name: 'Чайник', price: 1, stockQuantity: 99, categories: [] },
    ]);
    await handleMessage(event, env, { text: '/stock' });
    const reply = lastReply();
    expect(reply).toContain('Тарелка — <b>0 шт.</b>'); // 0 — первый
    expect(reply).toContain('Кружка &lt;b&gt;'); // экранирование HTML в имени
    expect(reply).not.toContain('Чайник'); // 99 > порога 5
  });

  it('всё в достатке — спокойное сообщение', async () => {
    kvStore.set('data:products', [
      { id: '1', slug: 'a', name: 'Кружка', price: 1, stockQuantity: 50, categories: [] },
    ]);
    await handleMessage(event, env, { text: '/stock' });
    expect(lastReply()).toContain('в достатке');
  });
});
