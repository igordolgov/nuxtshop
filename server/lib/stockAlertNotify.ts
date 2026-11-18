// server/lib/stockAlertNotify.ts
// Уведомление заявок «сообщить о поступлении» когда товар снова в наличии.
// Триггер — сохранение товара в админке (PUT /api/products/[id] и
// PATCH /api/products/bulk): ловим переход «не в наличии → в наличии».
//
// Каналы (в порядке приоритета):
//   1. Telegram — заявителю с привязанным аккаунтом (user.telegramChat).
//      Заявка связывается с аккаунтом:
//        1a. явно — alert.userId (авторизованный заявитель);
//        1b. по контакту — email (точное совпадение без регистра) или
//            телефон (последние 10 цифр), если привязал аккаунт позже.
//   2. Email (Resend) — если Telegram не нашёлся/не ушёл, а в заявке
//      оставлен email и настроен Resend (RESEND_API_KEY + RESEND_FROM).
// Заявки без канала доставки остаются pending — админ видит их в списке
// и связывается вручную (прежний сценарий).
//
// Best-effort: сбой Telegram/Resend никогда не ломает сохранение товара —
// caller оборачивает вызов в try/catch (см. products/[id].put.ts).

import type { H3Event } from 'h3';
import { readStockAlerts, writeStockAlerts, type StockAlertItem } from './stockAlertHelpers';
import { readUsers, type User } from './userHelpers';
import { getAdminChatIds, sendMessage, type TelegramEnv } from './telegram';
import { formatMoney } from '../../store.config';
import {
  isEmailContact,
  isResendConfigured,
  sendRestockEmail,
  type ResendEnv,
} from './resendEmail';

/** Окружение для рассылки о поступлении: Telegram и/или Resend. */
export type RestockNotifyEnv = TelegramEnv & ResendEnv;

/** Минимальный набор полей товара, нужный для решения об уведомлении */
export interface RestockCandidate {
  id: string;
  inStock?: boolean;
  stockQuantity?: number;
  slug?: string | null;
  name?: string;
  price?: number;
}

// ─── Чистые функции (покрыты юнит-тестами) ────────────────────────────

/** Доступен ли товар к покупке. inStock — приоритет; нет поля — склад. */
export function isAvailable(p: RestockCandidate | null | undefined): boolean {
  if (!p) return false;
  if (p.inStock !== undefined) return Boolean(p.inStock);
  return (Number(p.stockQuantity) || 0) > 0;
}

/** Переход «не в наличии → в наличии» между старой и новой версиями товара */
export function detectRestock(
  before: RestockCandidate | null | undefined,
  after: RestockCandidate | null | undefined,
): boolean {
  return !isAvailable(before) && isAvailable(after);
}

/** Для массовой правки: какие товары в этом сохранении «вернулись» */
export function findRestockedProducts<T extends RestockCandidate>(before: T[], after: T[]): T[] {
  const byId = new Map(before.map((p) => [String(p.id), p]));
  return after.filter((p) => detectRestock(byId.get(String(p.id)), p));
}

/**
 * Chat id для заявки: явная привязка по userId, затем контакт
 * (email без регистра / последние 10 цифр телефона). null — не нашли.
 */
export function resolveAlertChat(alert: StockAlertItem, users: User[]): string | null {
  if (alert.userId) {
    const u = users.find((x) => x.id === alert.userId);
    if (u?.telegramChat) return String(u.telegramChat);
  }

  const contact = String(alert.contact ?? '').trim();
  if (!contact) return null;

  const isEmail = contact.includes('@');
  const digits = contact.replace(/\D+/g, '');
  for (const u of users) {
    if (!u.telegramChat) continue;
    if (isEmail) {
      if (u.email && u.email.toLowerCase() === contact.toLowerCase()) {
        return String(u.telegramChat);
      }
    } else if (digits.length >= 10) {
      const userDigits = String(u.phone ?? '').replace(/\D+/g, '');
      // последние 10 цифр: +7/8-префиксы и форматы не мешают
      if (userDigits.length >= 10 && userDigits.slice(-10) === digits.slice(-10)) {
        return String(u.telegramChat);
      }
    }
  }
  return null;
}

/** Экранирование HTML: parse_mode='HTML' падает на «голых» < > & */
function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface RestockNotifyResult {
  /** Сколько заявок уведомили в Telegram (sendMessage вернул успех) */
  sent: number;
  /** Сколько заявок уведомили письмом через Resend */
  sentEmail: number;
  /** Сколько осталось без уведомления (ни один канал не сработал) */
  pending: number;
  /** Контакты недоставленных заявок — попадают в сводку админу
   *  («свяжитесь вручную»). Без них тишина при sent=0 выглядела
   *  как поломка механизма. */
  pendingContacts: string[];
}

const SUMMARY_NAME_LIMIT = 3;
const SUMMARY_CONTACT_LIMIT = 3;

export interface RestockSummaryInput {
  /** Названия товаров, вернувшихся в наличие (1 — одиночное сохранение) */
  names: string[];
  sent: number;
  /** Письмён доставлено через Resend (0/undefined — строки «email» нет) */
  sentEmail?: number;
  pendingContacts: string[];
}

/**
 * Сводка админам о поступлении — ЧИСТАЯ функция (покрыта тестами).
 * Отправляется всегда при переходе «нет → есть», даже когда уведомить
 * некого: админ должен видеть, что механизм сработал, и что делать
 * дальше (написать вручную тем, кого уведомить не удалось).
 */
export function formatRestockAdminSummary(input: RestockSummaryInput): string {
  const names = input.names.map((n) => escapeHtml(n)).filter(Boolean);
  const lines: string[] = [];

  if (names.length === 1) {
    lines.push(`📤 «${names[0]}» снова в наличии`);
  } else {
    const shown = names.slice(0, SUMMARY_NAME_LIMIT);
    const rest = names.length - shown.length;
    lines.push(
      `📤 Товары снова в наличии (${names.length})`,
      `📦 ${shown.map((n) => `«${n}»`).join(', ')}${rest > 0 ? ` +${rest} ещё` : ''}`,
    );
  }

  if (input.sent === 0 && !input.sentEmail && input.pendingContacts.length === 0) {
    lines.push('📭 Новых заявок о поступлении нет');
    return lines.join('\n');
  }

  if (input.sent > 0) lines.push(`✅ Уведомлено в Telegram: ${input.sent}`);
  if (input.sentEmail && input.sentEmail > 0) {
    lines.push(`✉️ Уведомлено по email: ${input.sentEmail}`);
  }
  if (input.pendingContacts.length > 0) {
    const shown = input.pendingContacts.slice(0, SUMMARY_CONTACT_LIMIT).map(escapeHtml);
    const rest = input.pendingContacts.length - shown.length;
    lines.push(
      `⚠️ Уведомить не удалось — свяжитесь вручную: ${shown.join(', ')}${rest > 0 ? ` (+${rest} ещё)` : ''}`,
    );
  }
  return lines.join('\n');
}

/** Сводку отправляем во все админ-чаты (TELEGRAM_ADMIN_CHAT_ID). */
export async function reportRestockToAdmins(env: TelegramEnv, text: string): Promise<void> {
  for (const chatId of getAdminChatIds(env)) {
    await sendMessage(env, chatId, text);
  }
}

/**
 * Есть ли у заявки канал доставки: Telegram-привязка ИЛИ email-контакт
 * при настроенном Resend. Используется списком заявок в админке
 * (бейдж «нет канала» у pending-заявок).
 */
export function alertHasChannel(
  alert: StockAlertItem,
  users: User[],
  env: RestockNotifyEnv | null | undefined,
): boolean {
  if (resolveAlertChat(alert, users) !== null) return true;
  return isEmailContact(alert.contact) && isResendConfigured(env);
}

/**
 * Рассылает уведомления о поступлении по pending-заявкам перечисленных
 * товаров и ставит им notifiedAt. Каналы: Telegram → email (Resend).
 * Возвращает счётчики.
 */
export async function notifyRestockSubscribers(
  event: H3Event,
  env: RestockNotifyEnv | null | undefined,
  products: RestockCandidate[],
  origin: string,
): Promise<RestockNotifyResult> {
  const zeros: RestockNotifyResult = { sent: 0, sentEmail: 0, pending: 0, pendingContacts: [] };
  // Guard сужает env до определённого для остальных проверок каналов
  if (!env || products.length === 0) return zeros;

  const telegramReady = Boolean(env.TELEGRAM_BOT_TOKEN);
  const emailReady = isResendConfigured(env);
  if (!telegramReady && !emailReady) return zeros;

  const alerts = await readStockAlerts(event);
  const byProduct = new Map(products.map((p) => [String(p.id), p]));
  const targets = alerts.filter((a) => !a.notifiedAt && byProduct.has(String(a.productId)));
  if (targets.length === 0) return zeros;

  const users = await readUsers(event);
  const notifiedIds = new Set<string>();
  const pendingContacts: string[] = [];
  let sent = 0;
  let sentEmail = 0;

  const restockPayload = (product: RestockCandidate) => {
    const price = typeof product.price === 'number' ? formatMoney(product.price) : '';
    return {
      name: String(product.name ?? ''),
      price,
      url: product.slug ? `${origin}/${product.slug}` : origin,
    };
  };

  const telegramText = (product: RestockCandidate) => {
    const price = typeof product.price === 'number' ? formatMoney(product.price) : '';
    const url = product.slug ? `${origin}/${product.slug}` : origin;
    return (
      `🎉 Товар снова в наличии!\n\n` +
      `📦 <b>«${escapeHtml(product.name)}»</b>${price ? ` — ${price}` : ''}\n` +
      `👉 ${url}`
    );
  };

  for (const alert of targets) {
    const product = byProduct.get(String(alert.productId))!;
    const chat = resolveAlertChat(alert, users);

    // 1. Telegram: привязка аккаунта найдена — пробуем мгновенное сообщение.
    if (chat && telegramReady && (await sendMessage(env, chat, telegramText(product)))) {
      notifiedIds.add(alert.id);
      sent++;
      continue;
    }

    // 2. Email-фолбэк: Telegram не нашёлся ИЛИ не ушёл (сеть/битый чат),
    //    а заявка оставлена с email и настроен Resend.
    if (emailReady && isEmailContact(alert.contact)) {
      if (await sendRestockEmail(env, String(alert.contact).trim(), restockPayload(product))) {
        notifiedIds.add(alert.id);
        sentEmail++;
        continue;
      }
    }

    // 3. Ничего не ушло: заявка остаётся pending. Контакт админу —
    //    в сводку («свяжитесь вручную»).
    if (!chat) pendingContacts.push(String(alert.contact ?? ''));
  }

  if (notifiedIds.size > 0) {
    const now = new Date().toISOString();
    await writeStockAlerts(
      event,
      alerts.map((a) => (notifiedIds.has(a.id) ? { ...a, notifiedAt: now } : a)),
    );
  }

  return { sent, sentEmail, pending: targets.length - sent - sentEmail, pendingContacts };
}
