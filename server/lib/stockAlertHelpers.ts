// server/lib/stockAlertHelpers.ts
// Заявки «сообщить о поступлении» (товар закончился → покупатель оставляет
// email или телефон → админ получает заявку в Telegram и список в админке).
// Хранилище — KV `data:stock-alerts`, паттерн тот же, что у отзывов.
//
// Дедупликация: повторная заявка с тем же контактом на тот же товар НЕ
// пишет дубликат — endpoint отвечает «уже подписаны» (успех, без записи).
import type { H3Event } from 'h3';
import { kvGetJSON, kvPutJSON } from './storage';

export const STOCK_ALERTS_KEY = 'data:stock-alerts';

/** Предохранитель: сколько заявок максимум держим в KV (старые вытесняются). */
export const MAX_STOCK_ALERTS = 5000;

export interface StockAlertItem {
  id: string;
  /** id товара из data:products (строкой). */
  productId: string;
  /** Снимок имени товара на момент заявки — админу не надо искать. */
  productName: string;
  /** Email или телефон покупателя. */
  contact: string;
  /** ISO-момент заявки. */
  createdAt: string;
}

export class StockAlertValidationError extends Error {}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Минимум цифр для «телефона без @» (короткие 12345 — не телефон). */
const PHONE_MIN_DIGITS = 10;
const MAX_CONTACT_LEN = 120;

// ─── Валидация (чистые функции — покрыты тестами) ────────────────────────

/** Только цифры («+7 999 123-45-67» → «79991234567»). */
function digits(value: string): string {
  return value.replace(/\D+/g, '');
}

/**
 * Приводит payload формы заявки к { productId, contact }.
 * Контакт — email ИЛИ телефон (≥ 10 цифр). Ошибка → 400 endpoint-а.
 */
export function normalizeStockAlertInput(raw: Record<string, unknown>): {
  productId: string;
  contact: string;
} {
  const productId =
    typeof raw?.productId === 'string' ? raw.productId.trim() : String(raw?.productId ?? '').trim();
  if (!productId || productId.length > 64) {
    throw new StockAlertValidationError('Не указан товар');
  }

  const contact = typeof raw?.contact === 'string' ? raw.contact.trim() : '';
  if (!contact || contact.length > MAX_CONTACT_LEN) {
    throw new StockAlertValidationError('Укажите email или телефон');
  }

  if (contact.includes('@')) {
    if (!EMAIL_RE.test(contact)) {
      throw new StockAlertValidationError('Неверный формат email');
    }
  } else if (digits(contact).length < PHONE_MIN_DIGITS) {
    throw new StockAlertValidationError('Укажите email или телефон (не короче 10 цифр)');
  }

  return { productId, contact };
}

/**
 * Уже есть заявка с этим контактом на этот товар? Email сравниваем без
 * учёта регистра, телефоны — по цифровому «скелету» (8-ки и 7-ки равны).
 */
export function hasStockAlert(alerts: StockAlertItem[], productId: string, contact: string): boolean {
  const wanted = contact.toLowerCase();
  const wantedDigits = digits(contact);
  const wantedPhone = wantedDigits.length === 11 && wantedDigits.startsWith('8')
    ? `7${wantedDigits.slice(1)}`
    : wantedDigits;

  return alerts.some(
    (a) =>
      String(a?.productId) === String(productId) &&
      (a?.contact.toLowerCase() === wanted ||
        (wantedPhone.length >= PHONE_MIN_DIGITS && digits(a?.contact ?? '') === wantedPhone)),
  );
}

// ─── Чтение / запись ─────────────────────────────────────────────────────

export async function readStockAlerts(event: H3Event): Promise<StockAlertItem[]> {
  const stored = await kvGetJSON<StockAlertItem[]>(event, STOCK_ALERTS_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.filter((a) => a && typeof a === 'object' && a.id != null);
}

export async function writeStockAlerts(event: H3Event, items: StockAlertItem[]): Promise<void> {
  if (!Array.isArray(items)) throw new Error('Stock alerts must be an array');
  await kvPutJSON(event, STOCK_ALERTS_KEY, items);
}

/** Следующий свободный числовой id (как у отзывов/новостей). */
export function nextStockAlertId(items: StockAlertItem[]): string {
  return items.length > 0 ? String(Math.max(...items.map((a) => Number(a.id) || 0)) + 1) : '1';
}
