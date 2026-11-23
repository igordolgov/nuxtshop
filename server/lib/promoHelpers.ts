// server/lib/promoHelpers.ts
// Промокоды: KV-хранилище + чистые функции валидации/расчёта.
// Паттерн — зеркало reviewHelpers: список целиком в KV `data:promocodes`.
//
// Деньги по-прежнему считает ТОЛЬКО сервер: скидка, показанная покупателю
// (POST /api/promocodes/validate), — превью; окончательный пересчёт и
// инкремент использований — в createOrder. Оба сценария считают скидку
// ОДНОЙ функцией evaluatePromo (разбиение корзины по акциям/целям,
// лимиты) — превью никогда не расходится с заказом.
//
// Настройки как у маркетплейсов: окно действия (с…по), порог суммы,
// лимиты (всего + на покупателя), цели (товары/категория),
// суммирование с акционными ценами. Одноразовость — частные случаи
// лимитов: usageLimit=1 (один раз вообще), usageLimitPerUser=1 (один
// раз каждому покупателю).
import type { H3Event } from 'h3';
import { kvGetJSON, kvPutJSON } from './storage';
// Человекочитаемые подписи скидок — валюта из конфига витрины через
// единый formatMoney (позиция символа по валюте: «500 ₽» / «$500»)
import { formatMoney } from '../../store.config';

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
  /** ISO-момент начала («дата из инпута» → начало этого дня UTC); null = уже начался. */
  startsAt: string | null;
  /** Минимальная сумма корзины (в валюте витрины); null = без порога. */
  minSubtotal: number | null;
  /** Максимум применений ВО ВСЕМ магазине; null = без лимита.
   *  1 = одноразовый промокод. */
  usageLimit: number | null;
  /** Максимум применений ОДНИМ покупателем; null = без лимита.
   *  1 = «один раз на покупателя» (у маркетплейсов — welcome-коды). */
  usageLimitPerUser: number | null;
  /** Сколько раз применён (считается при создании заказа). */
  usedCount: number;
  /** Учёт применений по покупателю: «u:<userId>» / «e:<email>» → счётчик.
   *  Обновляется в createOrder рядом с usedCount. */
  usedByUsers: Record<string, number>;
  /** Суммируется с акционными ценами. false → на товары под активной
   *  акцией промокод НЕ действует (акция тоже может запретить — см.
   *  NewsItem.allowPromocodes; запрещает ХОТЬ КТО-ТО ОДИН из пары).
   *  true (по умолчанию) — скидка считается от акционной цены. */
  stackableWithPromos: boolean;
  /** Цель: только эти товары (id из каталога); null/[] = весь заказ. */
  productIds: string[] | null;
  /** Цель: только эта категория (первая категория товара); null = любая. */
  category: string | null;
  /** Памятка для админа, до 200 символов. */
  description: string;
  createdAt: string;
  updatedAt: string;
}

export class PromoValidationError extends Error {}

export const PROMO_CODE_RE = /^[A-Z0-9-]{2,32}$/;
const MAX_DESCRIPTION_LEN = 200;

// ─── Чтение / запись ─────────────────────────────────────────────────────

/** Читает промокоды из KV; пустое/битое хранилище → пустой список.
 *  Записи, созданные до расширенных настроек, дополняются дефолтами
 *  В ПАМЯТИ (KV не мутируется на витринных ридах — дофолтят и следующие
 *  записи при очередной админ-правке). */
export async function readPromoCodes(event: H3Event): Promise<PromoCode[]> {
  const stored = await kvGetJSON<PromoCode[]>(event, PROMOS_KEY);
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((p) => p && typeof p === 'object' && p.id != null)
    .map((p) => ({
      ...p,
      startsAt: typeof p.startsAt === 'string' ? p.startsAt : null,
      minSubtotal: Number.isFinite(p.minSubtotal) ? (p.minSubtotal as number) : null,
      usageLimitPerUser: Number.isFinite(p.usageLimitPerUser)
        ? (p.usageLimitPerUser as number)
        : null,
      usedByUsers:
        p.usedByUsers && typeof p.usedByUsers === 'object' && !Array.isArray(p.usedByUsers)
          ? (p.usedByUsers as Record<string, number>)
          : {},
      stackableWithPromos: p.stackableWithPromos !== false,
      productIds:
        Array.isArray(p.productIds) && p.productIds.length > 0 ? p.productIds.map(String) : null,
      category: typeof p.category === 'string' && p.category ? p.category : null,
    }));
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

function parseDate(raw: unknown, kind: 'start' | 'end'): string | null {
  if (raw == null || raw === '') return null;
  const str = String(raw).trim();
  if (!str) return null;
  // Дата из input[type=date]: «до этой даты» = конец дня, «с этой даты» = начало дня
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return kind === 'start' ? `${str}T00:00:00.000Z` : `${str}T23:59:59.999Z`;
  }
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) {
    throw new PromoValidationError(
      kind === 'start' ? 'Некорректная дата начала' : 'Некорректная дата окончания',
    );
  }
  return date.toISOString();
}

/** Целое в диапазоне [min, max] или null (пусто = «без ограничения»). */
function intOrNull(raw: unknown, min: number, max: number, message: string): number | null {
  if (raw == null || raw === '') return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new PromoValidationError(message);
  }
  return value;
}

/** Список id товаров из формы: строки/числа → уникальные строки (≤64 симв., ≤200 шт.). */
function parseProductIds(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) throw new PromoValidationError('Цель-товары: ожидается список id');
  const ids = [
    ...new Set(
      raw
        .map((id) => String(id ?? '').trim())
        .filter((id) => id.length > 0)
        .map((id) => {
          if (id.length > 64) throw new PromoValidationError('id товара длиннее 64 символов');
          return id;
        }),
    ),
  ];
  if (ids.length > 200) throw new PromoValidationError('Не более 200 товаров в цели');
  return ids.length > 0 ? ids : null;
}

/**
 * Приводит payload формы админки к полям промокода; кидает PromoValidationError
 * с сообщением на русском → эндпоинт отдаёт 400. При редактировании передаётся
 * existing — из него сохраняются id/usedCount/createdAt.
 */
export function normalizePromoInput(
  raw: Record<string, unknown>,
  existing?: PromoCode,
): Omit<PromoCode, 'id' | 'usedCount' | 'usedByUsers' | 'createdAt' | 'updatedAt'> {
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

  const usageLimit = intOrNull(
    raw?.usageLimit,
    1,
    1_000_000,
    'Лимит применений — целое число от 1 или пусто (без лимита)',
  );
  const usageLimitPerUser = intOrNull(
    raw?.usageLimitPerUser,
    1,
    1_000_000,
    'Лимит на покупателя — целое число от 1 или пусто (без лимита)',
  );
  const minSubtotal = intOrNull(
    raw?.minSubtotal,
    1,
    10_000_000,
    'Минимальная сумма корзины — целое число от 1 или пусто (без порога)',
  );

  const description = String(raw?.description ?? '')
    .trim()
    .slice(0, MAX_DESCRIPTION_LEN);
  const startsAt = parseDate(raw?.startsAt, 'start');
  const expiresAt = parseDate(raw?.expiresAt, 'end');
  if (startsAt && expiresAt && expiresAt < startsAt) {
    throw new PromoValidationError('Дата окончания раньше даты начала');
  }
  const active = raw?.active === undefined ? (existing?.active ?? true) : Boolean(raw.active);
  // Суммирование с акциями: по умолчанию ВКЛ (историческое поведение —
  // промокод считается от акционных цен); явное false из формы.
  const stackableWithPromos =
    raw?.stackableWithPromos === undefined
      ? (existing?.stackableWithPromos ?? true)
      : Boolean(raw.stackableWithPromos);
  const productIds = parseProductIds(raw?.productIds);
  const categoryRaw = String(raw?.category ?? '').trim();
  const category = categoryRaw ? categoryRaw.slice(0, 120) : null;

  return {
    code,
    type,
    value,
    active,
    startsAt,
    expiresAt,
    minSubtotal,
    usageLimit,
    usageLimitPerUser,
    stackableWithPromos,
    productIds,
    category,
    description,
  };
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
 * Почему промокод нельзя применить (без привязки к покупателю):
 * null = можно; иначе причина. Сообщения — для тоста покупателя.
 */
export function promoIssue(
  promo: PromoCode,
  now: Date = new Date(),
): 'inactive' | 'scheduled' | 'expired' | 'limit' | null {
  if (!promo.active) return 'inactive';
  if (promo.startsAt && new Date(promo.startsAt).getTime() > now.getTime()) return 'scheduled';
  if (promo.expiresAt && new Date(promo.expiresAt).getTime() < now.getTime()) return 'expired';
  if (promo.usageLimit != null && (promo.usedCount ?? 0) >= promo.usageLimit) return 'limit';
  return null;
}

/** Ключ покупателя для per-user лимита: авторизованный — userId, гость — email. */
export function promoUserKey(userId?: string | null, email?: string | null): string | null {
  const uid = String(userId ?? '').trim();
  if (uid) return `u:${uid}`;
  const mail = String(email ?? '')
    .trim()
    .toLowerCase();
  if (mail) return `e:${mail}`;
  return null;
}

/** Сколько раз ЭТОТ покупатель уже применил промокод. */
export function promoUserCount(promo: PromoCode, userKey: string | null): number {
  if (!userKey) return 0;
  return promo.usedByUsers?.[userKey] ?? 0;
}

/**
 * Причина отказа с учётом покупателя: все общие причины + user_limit.
 * userKey null (гость без email — невозможно в заказе, но возможно в
 * превью) → per-user лимит не проверить, считаем применимым: заказ всё
 * равно перепроверит с реальным email.
 */
export function promoIssueForUser(
  promo: PromoCode,
  userKey: string | null,
  now: Date = new Date(),
): 'inactive' | 'scheduled' | 'expired' | 'limit' | 'user_limit' | null {
  const common = promoIssue(promo, now);
  if (common) return common;
  if (
    userKey &&
    promo.usageLimitPerUser != null &&
    promoUserCount(promo, userKey) >= promo.usageLimitPerUser
  ) {
    return 'user_limit';
  }
  return null;
}

export const PROMO_ISSUE_MESSAGES: Record<
  'inactive' | 'scheduled' | 'expired' | 'limit' | 'user_limit',
  string
> = {
  inactive: 'Промокод больше не действует',
  scheduled: 'Промокод ещё не начал действовать',
  expired: 'Срок действия промокода истёк',
  limit: 'Лимит применений промокода исчерпан',
  user_limit: 'Вы уже использовали этот промокод',
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

/** Человекочитаемое описание скидки: «10%» / «500 ₽» / «$500» (formatMoney). */
export function promoValueLabel(promo: Pick<PromoCode, 'type' | 'value'>): string {
  return promo.type === 'percent' ? `${promo.value}%` : formatMoney(promo.value);
}

// ─── Оценка промокода в корзине (единая для validate и createOrder) ─────

/**
 * Строка корзины в срезе витрины. Цена — из sellable-среза каталога
 * (акционные цены уже внутри), флаги акции — из того же среза
 * (promoPercent/promoAllowsPromocodes, см. promoDiscount.ts).
 */
export interface PromoCartLine {
  /** id товара (вариант не важен: цели матчатся по товару). */
  productId: string;
  quantity: number;
  /** Цена строки ЗА ЕДИНИЦУ (sellable). */
  price: number;
  /** Товар под активной акцией (percent акции из sellable-среза). */
  promoPercent?: number | null;
  /** Акция разрешает промокоды (undefined = акция не задавала запрет). */
  promoAllowsPromocodes?: boolean;
  /** Первая категория товара (цель «категория»). */
  category?: string | null;
}

export interface PromoCartContext {
  lines: PromoCartLine[];
  /** Полная сумма корзины (для порога minSubtotal). */
  subtotal: number;
  /** Покупатель: userId авторизованного или email заказа/сессии. */
  userKey?: string | null;
  now?: Date;
}

export type PromoEvalResult =
  | {
      ok: true;
      /** Скидка в валюте витрины (целая). */ discount: number;
      /** База скидки (после отсечения акционных/нецелевых строк). */ base: number;
    }
  | {
      ok: false;
      reason:
        | 'inactive'
        | 'scheduled'
        | 'expired'
        | 'limit'
        | 'user_limit'
        | 'min_subtotal'
        | 'promo_overlap'
        | 'no_targets';
    };

/** Цель промокода покрывает строку корзины (товар и/или категория). */
export function promoLineMatches(
  promo: Pick<PromoCode, 'productIds' | 'category'>,
  line: PromoCartLine,
): boolean {
  const byProducts = Array.isArray(promo.productIds) && promo.productIds.includes(line.productId);
  const byCategory = !!promo.category && String(line.category ?? '') === promo.category;
  // Цель не задана ни одним из двух способов → весь заказ
  if (!Array.isArray(promo.productIds) && !promo.category) return true;
  return byProducts || byCategory;
}

/**
 * ЕДИНАЯ оценка применимости промокода к корзине: окно/лимиты/порог →
 * цели (товары/категория) → суммирование с акциями → расчёт скидки.
 * Используется ПРЯМО из validate (превью) и createOrder (деньги) —
 * правила в одном месте, превью никогда не расходится с заказом.
 *
 * Суммирование (как у маркетплейсов): промокод действует на акционный
 * товар только если разрешают ОБЕ стороны — сам промокод
 * (stackableWithPromos) И акция этого товара (promoAllowsPromocodes).
 * При запрете промокод НЕ отклоняется целиком, а считается по
 * оставшейся (не-акционной/целевой) части корзины; отказ — только если
 * базы не осталось (promo_overlap) или цели не нашлись (no_targets).
 */
export function evaluatePromo(promo: PromoCode, ctx: PromoCartContext): PromoEvalResult {
  const issue = promoIssueForUser(promo, ctx.userKey ?? null, ctx.now ?? new Date());
  if (issue) return { ok: false, reason: issue };

  const subtotal = Number(ctx.subtotal);
  if (!Number.isFinite(subtotal) || subtotal <= 0) return { ok: false, reason: 'no_targets' };
  // Порог суммы — от полной корзины (как у маркетплейсов: «от 5 000 ₽»)
  if (promo.minSubtotal != null && subtotal < promo.minSubtotal) {
    return { ok: false, reason: 'min_subtotal' };
  }

  const lines = Array.isArray(ctx.lines) ? ctx.lines : [];
  const matched = lines.filter((l) => l && promoLineMatches(promo, l));
  if (matched.length === 0) return { ok: false, reason: 'no_targets' };

  // Суммирование РЕШАЕТСЯ ПОСТРОЧНО: строка под акцией участвует в базе
  // только если промокод суммируется И акция ЭТОГО товара разрешает.
  // У одной корзины могут быть товары под разными акциями с разными
  // настройками — каждый товар отвечает за себя.
  const baseLines = matched.filter((l) => {
    if (l.promoPercent == null) return true; // без акции — всегда в базе
    return promo.stackableWithPromos !== false && l.promoAllowsPromocodes !== false;
  });
  const base = Math.round(
    baseLines.reduce((sum, l) => sum + Number(l.price) * Math.max(1, Number(l.quantity) || 1), 0),
  );
  if (base <= 0) return { ok: false, reason: 'promo_overlap' };

  return { ok: true, base, discount: calcDiscount(promo, base) };
}
