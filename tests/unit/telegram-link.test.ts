// Тесты привязки аккаунта к Telegram: parseLinkPayload (чистая) и
// handleStartMessage (мок KV + мок telegram, по образцу bought-together).
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

const sendMessageMock = vi.fn(async () => true);
vi.mock('../../server/lib/telegram', () => ({
  sendMessage: (...args: unknown[]) => sendMessageMock(...(args as [])),
}));

import {
  handleStartMessage,
  parseLinkPayload,
  LINK_TTL_SECONDS,
} from '../../server/lib/telegramLink';
import type { User } from '../../server/lib/userHelpers';

const event = {} as never;
const ENV = { TELEGRAM_BOT_TOKEN: 'test-token' } as const;
const ADMIN_IDS = ['999'];

const msg = (text: string, chatId = '777', fromId?: number) => ({
  text,
  chat: { id: chatId },
  from: { id: fromId },
});

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

beforeEach(() => {
  kvStore.clear();
  sendMessageMock.mockClear();
  sendMessageMock.mockImplementation(async () => true);
});

describe('parseLinkPayload', () => {
  it('«/start link-ABC» → link-ABC', () => {
    expect(parseLinkPayload('/start link-ABC123')).toBe('link-ABC123');
    expect(parseLinkPayload('/start  link-ABC')).toBe('link-ABC');
  });

  it('обычный /start, другие команды, мусор → null', () => {
    expect(parseLinkPayload('/start')).toBeNull();
    expect(parseLinkPayload('/start link-')).toBeNull(); // пустой код
    expect(parseLinkPayload('/pending')).toBeNull();
    expect(parseLinkPayload('')).toBeNull();
    expect(parseLinkPayload(undefined)).toBeNull();
    expect(parseLinkPayload('привет')).toBeNull();
  });
});

describe('handleStartMessage', () => {
  it('валидный код: пишет telegramChat в профиль, удаляет код, отвечает', async () => {
    kvStore.set('data:users', [user({ id: 'u1', email: 'i@x.ru' })]);
    kvStore.set('tg:link:link-OK1', { userId: 'u1', createdAt: new Date().toISOString() });

    const consumed = await handleStartMessage(event, ENV, msg('/start link-OK1'), ADMIN_IDS);

    expect(consumed).toBe(true);
    const users = (kvStore.get('data:users') as User[]) ?? [];
    expect(users.find((u) => u.id === 'u1')?.telegramChat).toBe('777');
    expect(users.find((u) => u.id === 'u1')?.telegramLinkedAt).toBeTruthy();
    expect(kvStore.has('tg:link:link-OK1')).toBe(false);
    expect(sendMessageMock).toHaveBeenCalledTimes(1);
    expect(String(sendMessageMock.mock.calls[0][2])).toContain('привязан');
  });

  it('неизвестный/истёкший код: отказ, профиль не тронут', async () => {
    kvStore.set('data:users', [user({ id: 'u1' })]);
    const consumed = await handleStartMessage(event, ENV, msg('/start link-GONE'), ADMIN_IDS);
    expect(consumed).toBe(true);
    const users = (kvStore.get('data:users') as User[]) ?? [];
    expect(users.find((u) => u.id === 'u1')?.telegramChat).toBeUndefined();
    expect(String(sendMessageMock.mock.calls[0][2])).toContain('не найден');

    // просроченный код: старше LINK_TTL_SECONDS
    kvStore.set('tg:link:link-OLD', {
      userId: 'u1',
      createdAt: new Date(Date.now() - (LINK_TTL_SECONDS + 60) * 1000).toISOString(),
    });
    await handleStartMessage(event, ENV, msg('/start link-OLD'), ADMIN_IDS);
    expect(kvStore.has('tg:link:link-OLD')).toBe(false);
    const users2 = (kvStore.get('data:users') as User[]) ?? [];
    expect(users2.find((u) => u.id === 'u1')?.telegramChat).toBeUndefined();
  });

  it('plain /start: покупателю — приветствие и «поглощено», админу — пропуск в команды', async () => {
    const consumed = await handleStartMessage(event, ENV, msg('/start', '777', 123), ADMIN_IDS);
    expect(consumed).toBe(true);
    expect(String(sendMessageMock.mock.calls[0][2])).toContain('Привязать Telegram');

    sendMessageMock.mockClear();
    // админ (id в whitelist) с /start — НЕ поглощаем, идут дальше в telegramCommands
    const consumedAdmin = await handleStartMessage(
      event,
      ENV,
      msg('/start', '888', 999),
      ADMIN_IDS,
    );
    expect(consumedAdmin).toBe(false);
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('не /start или нет токена — не наше (false), webhook идёт дальше', async () => {
    expect(await handleStartMessage(event, ENV, msg('/pending'), ADMIN_IDS)).toBe(false);
    expect(await handleStartMessage(event, null, msg('/start link-OK'), ADMIN_IDS)).toBe(false);
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
});
