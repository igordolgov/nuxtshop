// server/lib/stockAlertNotify.ts
// Уведомление заявок «сообщить о поступлении» когда товар снова в наличии.
// Триггер — сохранение товара в админке (PUT /api/products/[id] и
// PATCH /api/products/bulk): ловим переход «не в наличии → в наличии».
//
// Канал — Telegram: каждому заявителю с привязанным аккаунтом
// (user.telegramChat) уходит сообщение. Заявка связывается с аккаунтом:
//   1. явно — alert.userId (авторизованный заявитель);
//   2. по контакту — email (точное совпадение без регистра) или телефон
//      (последние 10 цифр), если заявитель позже привязал аккаунт.
// Заявки без найденного chat остаются pending — админ видит их в списке
// и связывается вручную (прежний сценарий).
//
// Best-effort: сбой Telegram никогда не ломает сохранение товара —
// caller оборачивает вызов в try/catch (см. products/[id].put.ts).

import type { H3Event } from 'h3';
import { readStockAlerts, writeStockAlerts, type StockAlertItem } from './stockAlertHelpers';
import { readUsers, type User } from './userHelpers';
import { getAdminChatIds, sendMessage, type TelegramEnv } from './telegram';
import { formatMoney } from '../../store.config';

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
  /** Сколько заявок реально уведомили (sendMessage вернул успех) */
  sent: number;
  /** Сколько осталось без уведомления (нет привязки/чата) */
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
  pendingContacts: string[];
}

/**
 * Сводка админам о поступлении — ЧИСТАЯ функция (покрыта тестами).
 * Отправляется всегда при переходе «нет → есть», даже когда уведомить
 * некого: админ должен видеть, что механизм сработал, и что делать
 * дальше (написать вручную тем, кто без привязки Telegram).
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

  if (input.sent === 0 && input.pendingContacts.length === 0) {
    lines.push('📭 Новых заявок о поступлении нет');
    return lines.join('\n');
  }

  if (input.sent > 0) lines.push(`✅ Уведомлено в Telegram: ${input.sent}`);
  if (input.pendingContacts.length > 0) {
    const shown = input.pendingContacts.slice(0, SUMMARY_CONTACT_LIMIT).map(escapeHtml);
    const rest = input.pendingContacts.length - shown.length;
    lines.push(
      `⚠️ Без привязки Telegram — свяжитесь вручную: ${shown.join(', ')}${rest > 0 ? ` (+${rest} ещё)` : ''}`,
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
 * Рассылает уведомления о поступлении по pending-заявкам перечисленных
 * товаров и ставит им notifiedAt. Возвращает счётчики.
 */
export async function notifyRestockSubscribers(
  event: H3Event,
  env: TelegramEnv | null | undefined,
  products: RestockCandidate[],
  origin: string,
): Promise<RestockNotifyResult> {
  if (!env?.TELEGRAM_BOT_TOKEN || products.length === 0) {
    return { sent: 0, pending: 0, pendingContacts: [] };
  }

  const alerts = await readStockAlerts(event);
  const byProduct = new Map(products.map((p) => [String(p.id), p]));
  const targets = alerts.filter((a) => !a.notifiedAt && byProduct.has(String(a.productId)));
  if (targets.length === 0) return { sent: 0, pending: 0, pendingContacts: [] };

  const users = await readUsers(event);
  const notifiedIds = new Set<string>();
  const pendingContacts: string[] = [];
  let sent = 0;

  for (const alert of targets) {
    const chat = resolveAlertChat(alert, users);
    if (!chat) {
      // Заявку не доставить (нет привязки) — контакт админу в сводку
      pendingContacts.push(String(alert.contact ?? ''));
      continue;
    }

    const product = byProduct.get(String(alert.productId))!;
    const price = typeof product.price === 'number' ? formatMoney(product.price) : '';
    const url = product.slug ? `${origin}/${product.slug}` : origin;
    const text =
      `🎉 Товар снова в наличии!\n\n` +
      `📦 <b>«${escapeHtml(product.name)}»</b>${price ? ` — ${price}` : ''}\n` +
      `👉 ${url}`;

    if (await sendMessage(env, chat, text)) {
      notifiedIds.add(alert.id);
      sent++;
    }
  }

  if (notifiedIds.size > 0) {
    const now = new Date().toISOString();
    await writeStockAlerts(
      event,
      alerts.map((a) => (notifiedIds.has(a.id) ? { ...a, notifiedAt: now } : a)),
    );
  }

  return { sent, pending: targets.length - sent, pendingContacts };
}
