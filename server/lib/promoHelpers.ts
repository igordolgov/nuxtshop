// server/lib/promoHelpers.ts
// Промокоды: KV-хранилище + чистые функции валидации/расчёта.
// Паттерн — зеркало reviewHelpers: список целиком в KV `data:promocodes`.
//
// Деньги по-прежнему считает ТОЛЬКО сервер: скидка, показанная покупателю
// (POST /api/promocodes/validate), — превью по клиентскому subtotal;
// окончательный пересчёт и инкремент использований — в createOrder.
import type { H3Event } from 'h3';
import { kvGetJSON, kvPutJSON } from './storage';

export const PROMOS_KEY = 'data:promocodes';

// ─── Типы ────────────────────────────────────────────────────────────────

export type PromoType = 'percent' | 'fixed';

export interface PromoCode {
  id: string;
  /** UPPERCASE, латиница/цифры/дефис, 2–32 символа. Уникален (регистронезависимо). */
  code: string;
  type: PromoType;
  /** percent: 1–90 (%); fixed: 1–10 000 000 (₽). */
  value: number;
  /** false = временно отключён (не удаляя). */
  active: boolean;
  /** ISO-момент окончания («дата из инпута» → конец этого дня UTC); null = бессрочно. */
  expiresAt: string | null;
  /** Максимум применений; null = без лимита. */
  usageLimit: number | null;
  /** Сколько раз применён (считается при создании заказа). */
  usedCount: number;
  /** Памятка для админа, до 200 символов. */
  description: string;
  createdAt: string;
  updatedAt: string;
}

export class PromoValidationError extends Error {}

export const PROMO_CODE_RE = /^[A-Z0-9-]{2,32}$/;
const MAX_DESCRIPTION_LEN = 200;

// ─── Чтение / запись ─────────────────────────────────────────────────────

/** Читает промокоды из KV; пустое/битое хранилище → пустой список. */
export async function readPromoCodes(event: H3Event): Promise<PromoCode[]> {
  const stored = await kvGetJSON<PromoCode[]>(event, PROMOS_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.filter((p) => p && typeof p === 'object' && p.id != null);
}

/** Единственная точка записи: массив ЦЕЛИКОМ в KV (валидация типа). */
export async function writePromoCodes(event: H3Event, items: PromoCode[]): Promise<void> {
  if (!Array.isArray(items)) throw new Error('Promo codes must be an array');
  await kvPutJSON(event, PROMOS_KEY, items);
}

/** Следующий свободный числовой id (как у отзывов/новостей). */
export function nextPromoId(items: PromoCode[]): string {
  return items.length > 0 ? String(Math.max(...items.map((p) => Number(p.id) || 0)) + 1) : '1';
}

// ─── Валидация админского ввода (чистая — покрыта тестами) ──────────────

function parseDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const str = String(raw).trim();
  if (!str) return null;
  // Дата из input[type=date]: «до этой даты» трактуем как конец дня
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return `${str}T23:59:59.999Z`;
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) {
    throw new PromoValidationError('Некорректная дата окончания');
  }
  return date.toISOString();
}

/**
 * Приводит payload формы админки к полям промокода; кидает PromoValidationError
 * с сообщением на русском → эндпоинт отдаёт 400. При редактировании передаётся
 * existing — из него сохраняются id/usedCount/createdAt.
 */
export function normalizePromoInput(
  raw: Record<string, unknown>,
  existing?: PromoCode,
): Omit<PromoCode, 'id' | 'usedCount' | 'createdAt' | 'updatedAt'> {
  const code = String(raw?.code ?? '')
    .trim()
    .toUpperCase();
  if (!PROMO_CODE_RE.test(code)) {
    throw new PromoValidationError(
      'Код: 2–32 символа, только латиница, цифры и дефис (например SUMMER15)',
    );
  }

  const type = raw?.type === 'fixed' ? 'fixed' : raw?.type === 'percent' ? 'percent' : null;
  if (!type) {
    throw new PromoValidationError('Тип скидки: percent или fixed');
  }

  const value = Number(raw?.value);
  if (type === 'percent') {
    if (!Number.isInteger(value) || value < 1 || value > 90) {
      throw new PromoValidationError('Скидка в процентах — целое число от 1 до 90');
    }
  } else if (!Number.isInteger(value) || value < 1 || value > 10_000_000) {
    throw new PromoValidationError('Скидка в рублях — целое число от 1 до 10 000 000');
  }

  const usageLimitRaw = raw?.usageLimit;
  let usageLimit: number | null = null;
  if (usageLimitRaw != null && usageLimitRaw !== '') {
    usageLimit = Number(usageLimitRaw);
    if (!Number.isInteger(usageLimit) || usageLimit < 1 || usageLimit > 1_000_000) {
      throw new PromoValidationError('Лимит применений — целое число от 1 или пусто (без лимита)');
    }
  }

  const description = String(raw?.description ?? '')
    .trim()
    .slice(0, MAX_DESCRIPTION_LEN);
  const expiresAt = parseDate(raw?.expiresAt);
  const active = raw?.active === undefined ? (existing?.active ?? true) : Boolean(raw.active);

  return { code, type, value, active, expiresAt, usageLimit, description };
}

// ─── Применимость и расчёт (чистые — покрыты тестами) ───────────────────

/** Регистронезависимый поиск по коду. */
export function findPromoByCode(items: PromoCode[], code: string): PromoCode | null {
  const wanted = String(code ?? '')
    .trim()
    .toUpperCase();
  if (!wanted) return null;
  return items.find((p) => p.code.toUpperCase() === wanted) ?? null;
}

/**
 * Почему промокод нельзя применить: null = можно; иначе причина.
 * Сообщения — для тоста покупателя.
 */
export function promoIssue(
  promo: PromoCode,
  now: Date = new Date(),
): 'inactive' | 'expired' | 'limit' | null {
  if (!promo.active) return 'inactive';
  if (promo.expiresAt && new Date(promo.expiresAt).getTime() < now.getTime()) return 'expired';
  if (promo.usageLimit != null && (promo.usedCount ?? 0) >= promo.usageLimit) return 'limit';
  return null;
}

export const PROMO_ISSUE_MESSAGES: Record<'inactive' | 'expired' | 'limit', string> = {
  inactive: 'Промокод больше не действует',
  expired: 'Срок действия промокода истёк',
  limit: 'Лимит применений промокода исчерпан',
};

export function isPromoUsable(promo: PromoCode, now?: Date): boolean {
  return promoIssue(promo, now) === null;
}

/**
 * Скидка в рублях от subtotal. Percent округляется до целого рубля,
 * fixed не превышает сумму корзины. Отрицательный/битый subtotal → 0.
 */
export function calcDiscount(promo: Pick<PromoCode, 'type' | 'value'>, subtotal: number): number {
  const base = Number(subtotal);
  if (!Number.isFinite(base) || base <= 0) return 0;
  const raw = promo.type === 'percent' ? (base * promo.value) / 100 : promo.value;
  return Math.max(0, Math.min(Math.round(raw), Math.round(base)));
}

/** Свежие сверху; при равных createdAt — больший id (стабильно). */
export function sortPromosDesc(items: PromoCode[]): PromoCode[] {
  return [...items].sort((a, b) => {
    const d = String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));
    if (d !== 0) return d;
    return (Number(b.id) || 0) - (Number(a.id) || 0);
  });
}

/** Человекочитаемое описание скидки: «10%» / «500 ₽». */
export function promoValueLabel(promo: Pick<PromoCode, 'type' | 'value'>): string {
  return promo.type === 'percent' ? `${promo.value}%` : `${promo.value} ₽`;
}
