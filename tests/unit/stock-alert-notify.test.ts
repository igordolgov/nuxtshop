// Тесты back-in-stock: переход «не в наличии → в наличии», разрешение
// chat id заявки (по userId и по контакту), рассылка notifyRestockSubscribers
// (мок KV + моки telegram/resend — файл самодостаточный, по образцу
// bought-together). Resend-помощники (isEmailContact/isResendConfigured)
// берём РЕАЛЬНЫЕ — мокаем только сетевой sendRestockEmail.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const kvStore = new Map<string, unknown>();

vi.mock('../../server/lib/storage', () => ({
  kvGetJSON: vi.fn(async (_event: unknown, key: string) => (kvStore.get(key) as unknown) ?? null),
  kvPutJSON: vi.fn(async (_event: unknown, key: string, value: unknown) => {
    kvStore.set(key, structuredClone(value));
  }),
  kvDelete: vi.fn(async (_event: unknown, key: string) => {
    kvStore.delete(key);
  }),
}));

// Мок telegram: capture отправок; sendOk — управление успехом из тестов
const sendMessageMock = vi.fn(async () => true);
vi.mock('../../server/lib/telegram', () => ({
  sendMessage: (...args: unknown[]) => sendMessageMock(...(args as [])),
  getAdminChatIds: (env: { TELEGRAM_ADMIN_CHAT_ID?: string } | null | undefined) =>
    (env?.TELEGRAM_ADMIN_CHAT_ID ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
}));

// Мок resend: чистые функции — реальные, мокаем только отправку
const sendRestockEmailMock = vi.fn(async () => true);
vi.mock('../../server/lib/resendEmail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/lib/resendEmail')>();
  return {
    ...actual,
    sendRestockEmail: (...args: unknown[]) => sendRestockEmailMock(...(args as [])),
  };
});

import {
  alertHasChannel,
  detectRestock,
  findRestockedProducts,
  formatRestockAdminSummary,
  isAvailable,
  notifyRestockSubscribers,
  reportRestockToAdmins,
  resolveAlertChat,
} from '../../server/lib/stockAlertNotify';
import { writeStockAlerts, type StockAlertItem } from '../../server/lib/stockAlertHelpers';
import type { User } from '../../server/lib/userHelpers';
import type { Product } from '../../server/lib/productHelpers';

const event = {} as never;

const ENV_OK = { TELEGRAM_BOT_TOKEN: 'test-token' } as const;
const ENV_RESEND = {
  RESEND_API_KEY: 're_test',
  RESEND_FROM: 'Магазин <noreply@shop.example>',
} as const;
const ENV_BOTH = { ...ENV_OK, ...ENV_RESEND };

const user = (over: Partial<User> & { id: string }): User =>
  ({
    name: 'U',
    email: '',
    role: 'user',
    phone: '',
    address: '',
    isActive: true,
    lastLogin: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  }) as unknown as User;

const alert = (over: Partial<StockAlertItem> & { id: string; productId: string }): StockAlertItem =>
  ({
    productName: 'Товар',
    contact: '',
    createdAt: '2026-11-01T00:00:00Z',
    ...over,
  }) as unknown as StockAlertItem;

const product = (over: Partial<Product> & { id: string }): Product =>
  ({
    name: 'Товар',
    price: 1000,
    inStock: false,
    stockQuantity: 0,
    slug: 'tovar',
    ...over,
  }) as unknown as Product;

beforeEach(() => {
  kvStore.clear();
  sendMessageMock.mockClear();
  sendMessageMock.mockImplementation(async () => true);
  sendRestockEmailMock.mockClear();
  sendRestockEmailMock.mockImplementation(async () => true);
});

describe('isAvailable / detectRestock', () => {
  it('isAvailable: приоритет inStock, фолбэк на stockQuantity', () => {
    expect(isAvailable({ id: '1', inStock: true })).toBe(true);
    expect(isAvailable({ id: '1', inStock: false, stockQuantity: 5 })).toBe(false);
    // нет поля inStock — смотрим склад
    expect(isAvailable({ id: '1', stockQuantity: 3 })).toBe(true);
    expect(isAvailable({ id: '1', stockQuantity: 0 })).toBe(false);
    expect(isAvailable(null)).toBe(false);
  });

  it('detectRestock: только переход «не было → появилось»', () => {
    expect(detectRestock({ id: '1', inStock: false }, { id: '1', inStock: true })).toBe(true);
    expect(detectRestock(null, { id: '1', inStock: true })).toBe(true); // новый товар
    expect(detectRestock({ id: '1', inStock: true }, { id: '1', inStock: true })).toBe(false);
    expect(detectRestock({ id: '1', inStock: true }, { id: '1', inStock: false })).toBe(false);
    expect(detectRestock({ id: '1', inStock: false }, { id: '1', inStock: false })).toBe(false);
    // правка без смены склада (цена/название) не считается поступлением
    expect(
      detectRestock({ id: '1', inStock: false }, { id: '1', inStock: false, price: 999 }),
    ).toBe(false);
  });

  it('findRestockedProducts: bulk-сравнение по id', () => {
    const before = [product({ id: '1', inStock: false }), product({ id: '2', inStock: false })];
    const after = [product({ id: '1', inStock: true }), product({ id: '2', inStock: false })];
    expect(findRestockedProducts(before, after).map((p) => p.id)).toEqual(['1']);
    // ничего не изменилось
    expect(findRestockedProducts(before, [...before])).toEqual([]);
  });
});

describe('resolveAlertChat', () => {
  const users: User[] = [
    user({ id: 'u1', email: 'ivan@x.ru', phone: '+79991234567', telegramChat: '111' }),
    user({ id: 'u2', email: 'maria@x.ru', phone: '', telegramChat: '222' }),
    user({ id: 'u3', email: 'petr@x.ru', phone: '', telegramChat: null }), // без привязки
  ];

  it('явная привязка: alert.userId → user.telegramChat', () => {
    expect(resolveAlertChat(alert({ id: 'a1', productId: 'p1', userId: 'u1' }), users)).toBe('111');
    // userId есть, но аккаунт не привязан — дальше по контакту
    expect(
      resolveAlertChat(
        alert({ id: 'a2', productId: 'p1', userId: 'u3', contact: 'maria@x.ru' }),
        users,
      ),
    ).toBe('222');
  });

  it('фолбэк по email (без регистра)', () => {
    expect(
      resolveAlertChat(alert({ id: 'a3', productId: 'p1', contact: 'IVAN@x.ru' }), users),
    ).toBe('111');
  });

  it('фолбэк по телефону (последние 10 цифр, формат не важен)', () => {
    expect(
      resolveAlertChat(alert({ id: 'a4', productId: 'p1', contact: '+7 (999) 123-45-67' }), users),
    ).toBe('111');
    expect(
      resolveAlertChat(alert({ id: 'a5', productId: 'p1', contact: '89991234567' }), users),
    ).toBe('111');
  });

  it('не нашли — null (гость без привязки остаётся pending)', () => {
    expect(
      resolveAlertChat(alert({ id: 'a6', productId: 'p1', contact: 'ghost@x.ru' }), users),
    ).toBeNull();
    expect(resolveAlertChat(alert({ id: 'a7', productId: 'p1', contact: '' }), users)).toBeNull();
  });
});

describe('alertHasChannel', () => {
  const users: User[] = [user({ id: 'u1', email: 'ivan@x.ru', telegramChat: '111' })];

  it('Telegram-привязка — канал есть даже без Resend', () => {
    expect(
      alertHasChannel(alert({ id: 'a1', productId: 'p1', contact: 'ivan@x.ru' }), users, {}),
    ).toBe(true);
  });

  it('email-контакт — канал только при настроенном Resend', () => {
    expect(
      alertHasChannel(alert({ id: 'a2', productId: 'p1', contact: 'ghost@x.ru' }), users, {}),
    ).toBe(false);
    expect(
      alertHasChannel(
        alert({ id: 'a3', productId: 'p1', contact: 'ghost@x.ru' }),
        users,
        ENV_RESEND,
      ),
    ).toBe(true);
  });

  it('телефон без привязки — канала нет даже с Resend', () => {
    expect(
      alertHasChannel(
        alert({ id: 'a4', productId: 'p1', contact: '+7 999 123-45-67' }),
        users,
        ENV_BOTH,
      ),
    ).toBe(false);
  });
});

describe('notifyRestockSubscribers', () => {
  const seed = (alerts: StockAlertItem[], users: User[]) => {
    kvStore.set('data:stock-alerts', structuredClone(alerts));
    kvStore.set('data:users', structuredClone(users));
  };

  const linked: User[] = [
    user({ id: 'u1', email: 'ivan@x.ru', phone: '', telegramChat: '111' }),
    user({ id: 'u2', email: 'maria@x.ru', phone: '', telegramChat: '222' }),
  ];

  it('рассылает всем найденным, ставит notifiedAt, пишет KV', async () => {
    seed(
      [
        alert({ id: 'a1', productId: 'p1', contact: 'ivan@x.ru' }),
        alert({ id: 'a2', productId: 'p1', contact: 'maria@x.ru' }),
        alert({ id: 'a3', productId: 'p2', contact: 'ivan@x.ru' }), // другой товар — мимо
      ],
      linked,
    );
    const p = product({ id: 'p1', inStock: true, slug: 'tovar-p1' });
    const { sent, sentEmail, pending } = await notifyRestockSubscribers(
      event,
      ENV_OK,
      [p],
      'https://shop.dev',
    );

    expect(sent).toBe(2);
    expect(sentEmail).toBe(0);
    expect(pending).toBe(0);
    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(sendRestockEmailMock).not.toHaveBeenCalled(); // Telegram справился
    // в тексте: имя, цена, ссылка на карточку
    const text = sendMessageMock.mock.calls[0][2] as string;
    expect(text).toContain('Товар');
    expect(text).toContain('https://shop.dev/tovar-p1');

    const stored = (kvStore.get('data:stock-alerts') as StockAlertItem[]) ?? [];
    expect(stored.find((a) => a.id === 'a1')?.notifiedAt).toBeTruthy();
    expect(stored.find((a) => a.id === 'a2')?.notifiedAt).toBeTruthy();
    expect(stored.find((a) => a.id === 'a3')?.notifiedAt).toBeFalsy();
  });

  it('гость с email при настроенном Resend: письмо вместо Telegram', async () => {
    seed([alert({ id: 'a1', productId: 'p1', contact: 'ghost@x.ru' })], linked);
    const { sent, sentEmail, pending, pendingContacts } = await notifyRestockSubscribers(
      event,
      ENV_BOTH,
      [product({ id: 'p1', inStock: true })],
      'https://shop.dev',
    );
    expect(sent).toBe(0);
    expect(sentEmail).toBe(1);
    expect(pending).toBe(0);
    expect(pendingContacts).toEqual([]);
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(sendRestockEmailMock).toHaveBeenCalledTimes(1);
    // адресат и содержимое письма
    const [envArg, toArg, payloadArg] = sendRestockEmailMock.mock.calls[0] as [
      unknown,
      string,
      { name: string; price: string; url: string },
    ];
    expect((envArg as { RESEND_API_KEY?: string }).RESEND_API_KEY).toBe('re_test');
    expect(toArg).toBe('ghost@x.ru');
    expect(payloadArg.name).toBe('Товар');
    expect(payloadArg.url).toBe('https://shop.dev/tovar');

    const stored = (kvStore.get('data:stock-alerts') as StockAlertItem[]) ?? [];
    expect(stored.find((a) => a.id === 'a1')?.notifiedAt).toBeTruthy();
  });

  it('гость с email БЕЗ Resend: заявка pending, контакт в pendingContacts', async () => {
    seed([alert({ id: 'a1', productId: 'p1', contact: 'ghost@x.ru' })], linked);
    const { sent, sentEmail, pending, pendingContacts } = await notifyRestockSubscribers(
      event,
      ENV_OK, // только Telegram
      [product({ id: 'p1', inStock: true })],
      'x',
    );
    expect(sent).toBe(0);
    expect(sentEmail).toBe(0);
    expect(pending).toBe(1);
    expect(pendingContacts).toEqual(['ghost@x.ru']);
    expect(sendRestockEmailMock).not.toHaveBeenCalled();
  });

  it('телефон без привязки: email-фолбэк не применяется (нет email)', async () => {
    seed([alert({ id: 'a1', productId: 'p1', contact: '+7 999 123-45-67' })], linked);
    const { sentEmail, pending } = await notifyRestockSubscribers(
      event,
      ENV_BOTH,
      [product({ id: 'p1', inStock: true })],
      'x',
    );
    expect(sentEmail).toBe(0);
    expect(pending).toBe(1);
    expect(sendRestockEmailMock).not.toHaveBeenCalled();
  });

  it('Telegram упал, контакт email: уходит письмо (фолбэк), notifiedAt ставится', async () => {
    seed([alert({ id: 'a1', productId: 'p1', contact: 'ivan@x.ru' })], linked);
    sendMessageMock.mockImplementation(async () => false);
    const { sent, sentEmail, pending } = await notifyRestockSubscribers(
      event,
      ENV_BOTH,
      [product({ id: 'p1', inStock: true })],
      'x',
    );
    expect(sent).toBe(0);
    expect(sentEmail).toBe(1);
    expect(pending).toBe(0);
    const stored = (kvStore.get('data:stock-alerts') as StockAlertItem[]) ?? [];
    expect(stored.find((a) => a.id === 'a1')?.notifiedAt).toBeTruthy();
  });

  it('уже уведомлённые не повторяются', async () => {
    seed(
      [
        alert({
          id: 'a1',
          productId: 'p1',
          contact: 'ivan@x.ru',
          notifiedAt: '2026-11-02T00:00:00Z',
        }),
      ],
      linked,
    );
    const { sent } = await notifyRestockSubscribers(
      event,
      ENV_OK,
      [product({ id: 'p1', inStock: true })],
      'x',
    );
    expect(sent).toBe(0);
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(sendRestockEmailMock).not.toHaveBeenCalled();
  });

  it('нет ни одного канала/нет заявок — тихий no-op', async () => {
    seed([alert({ id: 'a1', productId: 'p1', contact: 'ivan@x.ru' })], linked);
    expect(
      await notifyRestockSubscribers(event, null, [product({ id: 'p1', inStock: true })], 'x'),
    ).toEqual({ sent: 0, sentEmail: 0, pending: 0, pendingContacts: [] });
    // один Resend без Telegram — рассылка идёт
    expect(
      await notifyRestockSubscribers(
        event,
        ENV_RESEND,
        [product({ id: 'p1', inStock: true })],
        'x',
      ),
    ).toEqual({ sent: 0, sentEmail: 1, pending: 0, pendingContacts: [] });
    expect(await notifyRestockSubscribers(event, ENV_OK, [], 'x')).toEqual({
      sent: 0,
      sentEmail: 0,
      pending: 0,
      pendingContacts: [],
    });
    const empty: StockAlertItem[] = [];
    kvStore.set('data:stock-alerts', empty);
    expect(
      await notifyRestockSubscribers(event, ENV_OK, [product({ id: 'p1', inStock: true })], 'x'),
    ).toEqual({ sent: 0, sentEmail: 0, pending: 0, pendingContacts: [] });
  });

  it('сбой отправки одной из заявок: sent меньше, падавшая остаётся pending', async () => {
    seed(
      [
        alert({ id: 'a1', productId: 'p1', contact: 'ivan@x.ru' }),
        alert({ id: 'a2', productId: 'p1', contact: 'maria@x.ru' }),
      ],
      linked,
    );
    sendMessageMock.mockImplementation(async (env, chatId) => String(chatId) === '111');
    const { sent, pending } = await notifyRestockSubscribers(
      event,
      ENV_OK,
      [product({ id: 'p1', inStock: true })],
      'x',
    );
    expect(sent).toBe(1);
    expect(pending).toBe(1);
    const stored = (kvStore.get('data:stock-alerts') as StockAlertItem[]) ?? [];
    expect(stored.find((a) => a.id === 'a1')?.notifiedAt).toBeTruthy();
    expect(stored.find((a) => a.id === 'a2')?.notifiedAt).toBeFalsy();
  });

  it('письмо тоже упало (Telegram не найден, Resend настроен): pending + контакт в сводке', async () => {
    seed([alert({ id: 'a1', productId: 'p1', contact: 'ghost@x.ru' })], linked);
    sendRestockEmailMock.mockImplementation(async () => false);
    const { sentEmail, pending, pendingContacts } = await notifyRestockSubscribers(
      event,
      ENV_BOTH,
      [product({ id: 'p1', inStock: true })],
      'x',
    );
    expect(sentEmail).toBe(0);
    expect(pending).toBe(1);
    expect(pendingContacts).toEqual(['ghost@x.ru']);
    const stored = (kvStore.get('data:stock-alerts') as StockAlertItem[]) ?? [];
    expect(stored.find((a) => a.id === 'a1')?.notifiedAt).toBeFalsy();
  });
});

describe('writeStockAlerts — sanity мока KV', () => {
  it('круговое сохранение', async () => {
    const a = alert({ id: 'z1', productId: 'p1', contact: 'a@b.ru' });
    await writeStockAlerts(event, [a]);
    expect((kvStore.get('data:stock-alerts') as StockAlertItem[])[0].id).toBe('z1');
  });
});

describe('formatRestockAdminSummary', () => {
  it('одиночный товар, есть отправленные: заголовок + счётчик, без «⚠️» и «📭»', () => {
    const text = formatRestockAdminSummary({ names: ['Кроссовки'], sent: 2, pendingContacts: [] });
    expect(text).toContain('📤 «Кроссовки» снова в наличии');
    expect(text).toContain('✅ Уведомлено в Telegram: 2');
    expect(text).not.toContain('⚠️');
    expect(text).not.toContain('📭');
  });

  it('email-рассылка: строка «Уведомлено по email», без строки Telegram', () => {
    const text = formatRestockAdminSummary({
      names: ['Кроссовки'],
      sent: 0,
      sentEmail: 3,
      pendingContacts: [],
    });
    expect(text).toContain('✉️ Уведомлено по email: 3');
    expect(text).not.toContain('Telegram');
    expect(text).not.toContain('⚠️');
  });

  it('оба канала: обе строки счётчиков', () => {
    const text = formatRestockAdminSummary({
      names: ['Кроссовки'],
      sent: 1,
      sentEmail: 2,
      pendingContacts: [],
    });
    expect(text).toContain('✅ Уведомлено в Telegram: 1');
    expect(text).toContain('✉️ Уведомлено по email: 2');
  });

  it('заявок нет: тихая строка «новых заявок нет» — админ видит, что механизм сработал', () => {
    const text = formatRestockAdminSummary({ names: ['Часы'], sent: 0, pendingContacts: [] });
    expect(text).toContain('📭 Новых заявок о поступлении нет');
  });

  it('есть недоставленные: контакты для ручной связи, кап 3 + «+N ещё»', () => {
    const text = formatRestockAdminSummary({
      names: ['Кроссовки'],
      sent: 1,
      pendingContacts: ['a@x.ru', 'b@x.ru', 'c@x.ru', 'd@x.ru', 'e@x.ru'],
    });
    expect(text).toContain('⚠️ Уведомить не удалось — свяжитесь вручную:');
    expect(text).toContain('a@x.ru, b@x.ru, c@x.ru');
    expect(text).toContain('(+2 ещё)');
    expect(text).not.toContain('d@x.ru');
  });

  it('массовая правка: список названий с капом и «+N ещё»', () => {
    const text = formatRestockAdminSummary({
      names: ['A', 'B', 'C', 'D', 'E'],
      sent: 0,
      pendingContacts: ['ghost@x.ru'],
    });
    expect(text).toContain('📤 Товары снова в наличии (5)');
    expect(text).toContain('«A», «B», «C» +2 ещё');
    expect(text).toContain('ghost@x.ru');
  });

  it('HTML-экранирование названий и контактов (parse_mode HTML у бота)', () => {
    const text = formatRestockAdminSummary({
      names: ['Наушники <Pro>'],
      sent: 0,
      pendingContacts: ['a<b@x.ru'],
    });
    expect(text).toContain('&lt;Pro&gt;');
    expect(text).toContain('a&lt;b@x.ru');
  });
});

describe('reportRestockToAdmins', () => {
  it('шлёт сводку во все админ-чаты из TELEGRAM_ADMIN_CHAT_ID', async () => {
    await reportRestockToAdmins(
      { TELEGRAM_BOT_TOKEN: 't', TELEGRAM_ADMIN_CHAT_ID: '111, 222' },
      'сводка',
    );
    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(sendMessageMock.mock.calls[0][1]).toBe('111');
    expect(sendMessageMock.mock.calls[1][1]).toBe('222');
    expect(sendMessageMock.mock.calls[0][2]).toBe('сводка');
  });

  it('нет TELEGRAM_ADMIN_CHAT_ID — тихий no-op', async () => {
    await reportRestockToAdmins({ TELEGRAM_BOT_TOKEN: 't' }, 'сводка');
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
});
