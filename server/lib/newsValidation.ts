// server/lib/newsValidation.ts
// Валидация и санитизация payload новостей (POST/PUT /api/news): чистые
// функции — покрыты тестами. Кидает NewsValidationError с сообщением на
// русском — endpoints отдают их как 400. Разбивка newsHelpers (этап 6).
import type { NewsCategory, NewsItem } from './newsTypes';
import { MAX_NEWS_PRODUCTS, NEWS_CATEGORIES } from './newsTypes';

// ─── Валидация / нормализация (чистые функции — покрыты тестами) ─────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PARAGRAPHS = 20;
const MAX_PARAGRAPH_LEN = 2000;

export class NewsValidationError extends Error {}

/** ISO-дата (YYYY-MM-DD) или null: пусто/битое → null (= «удалить поле»
 *  в applySanitizedNews — бессрочность). Чистая. */
function isoDateOrNull(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!ISO_DATE_RE.test(trimmed) || Number.isNaN(Date.parse(trimmed))) {
    throw new NewsValidationError('Дата — в формате ГГГГ-ММ-ДД');
  }
  return trimmed;
}

/**
 * Список id товаров из новости: строки, тримминг, без пустых и дублей,
 * не больше MAX_NEWS_PRODUCTS. Мягкая нормализация (без ошибок):
 * несуществующие id безвредны — при показе просто не джойнятся.
 */
export function normalizeNewsProductIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const raw of input) {
    const id = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
    if (id && !out.includes(id)) out.push(id);
    if (out.length >= MAX_NEWS_PRODUCTS) break;
  }
  return out;
}

/**
 * Тело новости: строка (переносы строк = абзацы) или массив строк.
 * Тримминг, пустые отбрасываются, лимиты на количество и длину.
 */
export function normalizeNewsBody(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input.map(String)
    : typeof input === 'string'
      ? input.split(/\r?\n/)
      : [];

  const paras = raw
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .slice(0, MAX_PARAGRAPHS);

  if (paras.length === 0) {
    throw new NewsValidationError('Добавьте хотя бы один абзац полного текста');
  }
  for (const p of paras) {
    if (p.length > MAX_PARAGRAPH_LEN) {
      throw new NewsValidationError(`Абзац длиннее ${MAX_PARAGRAPH_LEN} символов — разбейте его`);
    }
  }
  return paras;
}

// ── Переводы новости (titleEn/…/bodyEs): контракт как у товаров ──────────
//
// PUT получает форму ЦЕЛИКОМ (админка шлёт все три вкладки), поэтому
// семантика простая: пусто/пробелы → перевод УДАЛЯЕТСЯ из записи (фолбэк
// на русский), непустая строка → trim + лимит базового поля.
//
// sanitizeNewsItem возвращает переводы со значением string | string[] | null,
// где null = «удалить поле». Применяет их к записи applySanitizedNews —
// endpoints (POST/PUT) работают только через неё.

export type NewsTranslations = {
  titleEn: string | null;
  titleEs: string | null;
  excerptEn: string | null;
  excerptEs: string | null;
  bodyEn: string[] | null;
  bodyEs: string[] | null;
};

/** Срок действия и промо-поля: null = «удалить поле из записи» —
 *  семантика переводов (очистка даты в форме снимает бессрочность,
 *  смена рубрики снимает скидку). */
export type NewsWindowPromo = {
  startsAt: string | null;
  endsAt: string | null;
  promoDiscount: number | null;
  promoCategory: string | null;
};

/** Результат sanitizeNewsItem: базовые поля + переводы + срок/промо
 *  (null = удалить). Переводные и оконно-промо поля вынуты из Omit:
 *  пересечение с NewsItem (string | undefined) сузило бы тип до string
 *  и запретило бы null. */
export type SanitizedNewsData = Omit<
  NewsItem,
  | 'id'
  | 'titleEn'
  | 'titleEs'
  | 'excerptEn'
  | 'excerptEs'
  | 'bodyEn'
  | 'bodyEs'
  | 'startsAt'
  | 'endsAt'
  | 'promoDiscount'
  | 'promoCategory'
> &
  NewsTranslations &
  NewsWindowPromo;

const LOCALIZED_TEXT_FIELDS = ['titleEn', 'titleEs', 'excerptEn', 'excerptEs'] as const;
const LOCALIZED_TEXT_LIMITS: Record<(typeof LOCALIZED_TEXT_FIELDS)[number], number> = {
  titleEn: 120,
  titleEs: 120,
  excerptEn: 220,
  excerptEs: 220,
};

/** Перевод-строка: trim; пусто → null (удалить перевода). */
function localizedTextOrNull(
  raw: unknown,
  field: (typeof LOCALIZED_TEXT_FIELDS)[number],
): string | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, LOCALIZED_TEXT_LIMITS[field]);
}

/**
 * Перевод полного текста: строка (переносы = абзацы) или массив строк.
 * В отличие от обязательного body перевод опционален: пустой → null
 * (фолбэк на русский), без броска ошибки. Лимиты те же, что у body.
 */
function localizedBodyOrNull(input: unknown): string[] | null {
  const raw = Array.isArray(input)
    ? input.map(String)
    : typeof input === 'string'
      ? input.split(/\r?\n/)
      : [];
  const paras = raw
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .slice(0, MAX_PARAGRAPHS);
  if (paras.length === 0) return null;
  for (const p of paras) {
    if (p.length > MAX_PARAGRAPH_LEN) {
      throw new NewsValidationError(
        `Абзац перевода длиннее ${MAX_PARAGRAPH_LEN} символов — разбейте его`,
      );
    }
  }
  return paras;
}

/**
 * Применяет sanitize-результат к записи (мутирует item и возвращает его):
 * базовые поля присваиваются; переводы и срок/промо — null → поле
 * удаляется из записи, значение → присваивается. Единственная точка
 * правки записи из payload — POST и PUT /api/news работают только через неё.
 */
export function applySanitizedNews(item: NewsItem, data: SanitizedNewsData): NewsItem {
  const {
    titleEn,
    titleEs,
    excerptEn,
    excerptEs,
    bodyEn,
    bodyEs,
    startsAt,
    endsAt,
    promoDiscount,
    promoCategory,
    ...base
  } = data;
  Object.assign(item, base);
  const target = item as unknown as Record<string, unknown>;
  for (const [field, value] of Object.entries({
    titleEn,
    titleEs,
    excerptEn,
    excerptEs,
    bodyEn,
    bodyEs,
    startsAt,
    endsAt,
    promoDiscount,
    promoCategory,
  })) {
    if (value === null) delete target[field];
    else target[field] = value;
  }
  return item;
}

/**
 * Приводит полезную нагрузку формы к NewsItem (плюс переводы; null =
 * «удалить перевод» — см. NewsTranslations). Кидает NewsValidationError
 * с сообщением на русском — endpoints отдают их как 400.
 */
export function sanitizeNewsItem(raw: Record<string, unknown>): SanitizedNewsData {
  const title = typeof raw?.title === 'string' ? raw.title.trim() : '';
  if (title.length < 5 || title.length > 120) {
    throw new NewsValidationError('Заголовок — от 5 до 120 символов');
  }

  const category = typeof raw?.category === 'string' ? raw.category.trim() : '';
  if (!NEWS_CATEGORIES.includes(category as NewsCategory)) {
    throw new NewsValidationError(`Рубрика должна быть одной из: ${NEWS_CATEGORIES.join(', ')}`);
  }

  const date = typeof raw?.date === 'string' ? raw.date.trim() : '';
  if (!ISO_DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
    throw new NewsValidationError('Дата обязательна в формате ГГГГ-ММ-ДД');
  }

  const excerpt = typeof raw?.excerpt === 'string' ? raw.excerpt.trim() : '';
  if (excerpt.length > 220) {
    throw new NewsValidationError('Краткое описание — не длиннее 220 символов');
  }

  const body = normalizeNewsBody(raw?.body);

  const image = typeof raw?.image === 'string' ? raw.image.trim() : '';
  if (image && !/^(\/|data:image\/|https?:\/\/)/.test(image)) {
    throw new NewsValidationError('Изображение: путь (/…), data-URI или http(s):// URL');
  }

  // ── Срок действия (startsAt/endsAt) — у ЛЮБОЙ новости ─────────────
  // Пусто/битая дата → поле удаляется (undefined = бессрочно). Логика
  // «конец раньше начала» — ошибка (не молчаливое игнорирование).
  const startsAt = isoDateOrNull(raw?.startsAt);
  const endsAt = isoDateOrNull(raw?.endsAt);
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new NewsValidationError('«Действует по» не может быть раньше «Действует с»');
  }

  // ── Промо-поля акции (только рубрика «Акции») ─────────────────────
  // Вне «Акций» промо-поля молча удаляются: рубрика сменилась —
  // скидка не должна «выжить» в данных без своей рубрики.
  const promoDiscountRaw = raw?.promoDiscount;
  let promoDiscount: number | undefined;
  let promoCategory: string | undefined;
  if (
    category === 'Акции' &&
    promoDiscountRaw !== undefined &&
    promoDiscountRaw !== null &&
    String(promoDiscountRaw).trim() !== ''
  ) {
    const percent = Number(promoDiscountRaw);
    if (!Number.isInteger(percent) || percent < 5 || percent > 90) {
      throw new NewsValidationError('Скидка акции — целое число от 5 до 90');
    }
    // Цель обязательна: товары (пикер) и/или категория каталога —
    // акция без цели ошибочна сильнее «просто текста».
    const targets = normalizeNewsProductIds(raw?.productIds);
    const promoCategoryTrimmed =
      typeof raw?.promoCategory === 'string' ? raw.promoCategory.trim() : '';
    if (targets.length === 0 && !promoCategoryTrimmed) {
      throw new NewsValidationError('Укажите цель скидки: товары и/или категорию каталога');
    }
    promoDiscount = percent;
    if (promoCategoryTrimmed) promoCategory = promoCategoryTrimmed.slice(0, 120);
    // Окно акции не может кончиться раньше начала скидки (начало =
    // startsAt ?? date — окно открыто с даты публикации)
    const promoStart = startsAt ?? date;
    if (endsAt && endsAt < promoStart) {
      throw new NewsValidationError('«Действует по» не может быть раньше начала акции');
    }
  }

  return {
    date,
    category: category as NewsCategory,
    title,
    excerpt,
    body,
    image,
    productIds: normalizeNewsProductIds(raw?.productIds),
    // Срок действия и промо: null = удалить поле из записи (бессрочность/
    // смена рубрики) — обработает applySanitizedNews
    startsAt,
    endsAt,
    promoDiscount: promoDiscount ?? null,
    promoCategory: promoCategory ?? null,
    // Переводы: пусто/отсутствует → null (удалить/не ставить; фолбэк на ru).
    titleEn: localizedTextOrNull(raw?.titleEn, 'titleEn'),
    titleEs: localizedTextOrNull(raw?.titleEs, 'titleEs'),
    excerptEn: localizedTextOrNull(raw?.excerptEn, 'excerptEn'),
    excerptEs: localizedTextOrNull(raw?.excerptEs, 'excerptEs'),
    bodyEn: localizedBodyOrNull(raw?.bodyEn),
    bodyEs: localizedBodyOrNull(raw?.bodyEs),
    // Черновик: только явное false; отсутствие поля/любое другое — публикация
    published: raw?.published === false ? false : true,
    updatedAt: new Date().toISOString(),
  };
}
