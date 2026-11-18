// server/lib/telegramLink.ts
// Привязка аккаунта покупателя к Telegram-боту: /start <link-КОД>.
// Публичный слой webhook — обрабатывается ДО админ-whitelist: одноразовый
// код из профиля (ЛК → «Привязать Telegram» → POST /api/my/telegram-link)
// и есть подтверждение личности. Код живёт 15 минут в KV tg:link:<code>.
//
// Plain /start без кода: админам оставляем прежний путь (слэш-команды),
// покупателям — короткое приветствие с подсказкой, где взять код.

import type { H3Event } from 'h3';
import { kvDelete, kvGetJSON } from './storage';
import { readUsers, writeUsers } from './userHelpers';
import { sendMessage, type TelegramEnv } from './telegram';

/** Время жизни кода привязки (сек) — согласовано с tg-link.post.ts */
export const LINK_TTL_SECONDS = 900;
const LINK_PREFIX = 'link-';

/** Форма message из webhook, которую читает привязка */
export interface StartMessage {
  text?: string;
  chat?: { id?: string | number };
  from?: { id?: number };
}

/**
 * Payload /start: «/start link-ABC123» → «link-ABC123».
 * null — обычный /start или не команда /start.
 */
export function parseLinkPayload(text: string | undefined | null): string | null {
  if (!text) return null;
  const parts = text.trim().split(/\s+/);
  if (parts[0] !== '/start' || parts.length < 2) return null;
  const payload = parts[1];
  if (!payload) return null;
  return payload.startsWith(LINK_PREFIX) && payload.length > LINK_PREFIX.length ? payload : null;
}

/**
 * Обрабатывает /start из webhook.
 * true — сообщение поглощено (в админ-команды не идти):
 *   • валидный код привязки (любой отправитель);
 *   • битый/истёкший код (ответили отказом);
 *   • plain /start от не-админа (ответили приветствием).
 * false — идти дальше по webhook (админские команды).
 */
export async function handleStartMessage(
  event: H3Event,
  env: TelegramEnv | null | undefined,
  message: StartMessage,
  adminUserIds: string[],
): Promise<boolean> {
  const chatId = String(message.chat?.id ?? '');
  if (!chatId || !env?.TELEGRAM_BOT_TOKEN) return false;

  // Только /start — наше. Остальные сообщения не-админов (вопросы, мусор)
  // молча уходят в прежний путь webhook (whitelist их отбрасывает).
  const firstWord =
    String(message.text ?? '')
      .trim()
      .split(/\s+/)[0] ?? '';
  if (firstWord !== '/start') return false;

  const payload = parseLinkPayload(message.text);

  // Обычный /start: админам — прежний путь (whitelist → команды),
  // покупателям — приветствие с направлением в профиль
  if (!payload) {
    const senderId = String(message.from?.id ?? '');
    if (senderId && adminUserIds.includes(senderId)) return false;
    await sendMessage(
      env,
      chatId,
      '👋 Привет! Это бот магазина.\n\n' +
        '🔔 Хотите получать уведомления о поступлении товаров — ' +
        'привяжите аккаунт: профиль на сайте → «Привязать Telegram».',
    );
    return true;
  }

  // Одноразовый код: ищем в KV (TTL выставлен при выдаче)
  const record = await kvGetJSON<{ userId: string; createdAt: string }>(
    event,
    `tg:link:${payload}`,
  );
  if (!record) {
    await sendMessage(
      env,
      chatId,
      '⛔ Код не найден или истёк.\nЗапросите новый: профиль на сайте → «Привязать Telegram».',
    );
    return true;
  }

  // Двойная проверка срока (KV TTL чистит сам, createdAt — на случай
  // ручных правок данных): просроченный код удаляем и отказываем
  if (Date.now() - new Date(record.createdAt).getTime() > LINK_TTL_SECONDS * 1000) {
    await kvDelete(event, `tg:link:${payload}`);
    await sendMessage(
      env,
      chatId,
      '⛔ Код истёк.\nЗапросите новый: профиль на сайте → «Привязать Telegram».',
    );
    return true;
  }

  const users = await readUsers(event);
  const user = users.find((u) => u.id === record.userId);
  if (!user) {
    await sendMessage(env, chatId, '⛔ Аккаунт не найден — обратитесь в поддержку.');
    return true;
  }

  // Привязка: chat id бота пишем в профиль — по нему придут уведомления
  user.telegramChat = chatId;
  user.telegramLinkedAt = new Date().toISOString();
  user.updatedAt = new Date().toISOString();
  await writeUsers(event, users);
  await kvDelete(event, `tg:link:${payload}`);

  await sendMessage(
    env,
    chatId,
    '✅ <b>Аккаунт привязан!</b>\n\n' +
      '🔔 Когда товары из ваших заявок «сообщить о поступлении» появятся ' +
      'на складе — сообщим здесь.',
  );
  return true;
}
