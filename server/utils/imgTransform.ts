// server/utils/imgTransform.ts
/**
 * Чистая логика роута-трансформатора /img (server/routes/img.ts) — вынесена
 * из хендлера, чтобы покрываться юнит-тестами без воркера.
 *
 * Роут принимает /img?src=/images/products/x.webp&w=400&h=300&q=75&f=webp&fit=cover
 * и перезапрашивает оригинал с опцией cf.image — Cloudflare Image
 * Transformations методом «Transform via fetch» (единственный работающий
 * способ на *.workers.dev: URL-метод /cdn-cgi/image/* доступен только на
 * собственной зоне, см. docs: developers.cloudflare.com → Transform via fetch).
 *
 * Разрешены ТОЛЬКО внутренние источники (SSRF-защита):
 *  - /images/products/*  — статика каталога (Workers Assets, 800w/400w webp);
 *  - /api/images/*       — админ-загрузки (Workers KV, префикс img:).
 * Внешние URL (Unsplash) трансформировать не нужно и нельзя: они уже
 * оптимизированы на своей стороне (auto=format&q=75), а произвольный
 * внешний fetch из роута — открытый прокси.
 */

/** Префиксы путей, которые разрешено отдавать на трансформацию. */
export const IMG_ALLOWED_PREFIXES = ['/images/products/', '/api/images/'] as const;

/** Cf-опции image: полный белый список форматов (cf.image). */
const IMG_FORMATS = new Set(['webp', 'avif', 'jpeg', 'png']);

/**
 * Маппинг fit из терминов @nuxt/image в термины cf.image
 * (как во встроенном провайдере cloudflare: valueMap.fit).
 */
const IMG_FIT_MAP: Record<string, string> = {
  cover: 'cover',
  contain: 'contain',
  fill: 'scale-down',
  outside: 'crop',
  inside: 'pad',
  'scale-down': 'scale-down',
};

/** Лимиты cf.image, зауженные до потребностей магазина. */
const IMG_MAX_DIM = 2000;
const IMG_DEFAULT_QUALITY = 75;

/** Источник валиден по символам (без %, ?, #, пробелов — их просто нет в путях картинок). */
const IMG_SRC_RE = /^\/[A-Za-z0-9._/-]+$/;

export interface ImageTransformParams {
  /** Путь к оригиналу на том же origin (уже провалидирован). */
  src: string;
  width?: number;
  height?: number;
  /** Дефолт 75 — консистентно с q=75 у Unsplash-источников. */
  quality: number;
  format?: string;
  /** Уже в терминах cf.image (scale-down/crop/pad). */
  fit?: string;
}

export type ParsedImageTransformQuery =
  | { ok: true; params: ImageTransformParams }
  | { ok: false; reason: string };

interface RawQuery {
  [key: string]: unknown;
}

/** query h3 отдаёт string | string[] | undefined — берём первое значение. */
function firstValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}

function parseIntParam(
  raw: string | undefined,
  min: number,
  max: number,
): number | undefined | false {
  if (raw === undefined) return undefined;
  if (!/^\d+$/.test(raw)) return false;
  const n = Number(raw);
  if (n < min || n > max) return false;
  return n;
}

/**
 * Валидирует query роута /img. Строгий белый список: неизвестный
 * параметр — ошибка (опечатка не должна молча проходить мимо кэша).
 */
export function parseImageTransformQuery(query: RawQuery): ParsedImageTransformQuery {
  for (const key of Object.keys(query)) {
    if (!['src', 'w', 'h', 'q', 'f', 'fit'].includes(key)) {
      return { ok: false, reason: `Unknown parameter: ${key}` };
    }
  }

  const src = firstValue(query.src);
  if (!src) return { ok: false, reason: 'Missing src' };
  if (src.length > 512) return { ok: false, reason: 'src too long' };
  // '//' — protocol-relative внешний URL; '%' — попытка пронести '../' в URL-кодировке.
  if (!src.startsWith('/') || src.startsWith('//') || src.includes('%')) {
    return { ok: false, reason: 'src must be a relative internal path' };
  }
  if (!IMG_SRC_RE.test(src)) return { ok: false, reason: 'src contains forbidden characters' };
  if (src.split('/').includes('..')) return { ok: false, reason: 'src must not contain ..' };
  if (!IMG_ALLOWED_PREFIXES.some((prefix) => src.startsWith(prefix))) {
    return { ok: false, reason: 'src prefix is not allowed' };
  }

  const width = parseIntParam(firstValue(query.w), 1, IMG_MAX_DIM);
  if (width === false) return { ok: false, reason: 'w must be an integer 1..2000' };
  const height = parseIntParam(firstValue(query.h), 1, IMG_MAX_DIM);
  if (height === false) return { ok: false, reason: 'h must be an integer 1..2000' };
  const quality = parseIntParam(firstValue(query.q), 1, 100) ?? IMG_DEFAULT_QUALITY;
  if (quality === false) return { ok: false, reason: 'q must be an integer 1..100' };

  const format = firstValue(query.f)?.toLowerCase();
  if (format !== undefined && !IMG_FORMATS.has(format)) {
    return { ok: false, reason: 'f must be one of: webp, avif, jpeg, png' };
  }

  const fitRaw = firstValue(query.fit)?.toLowerCase();
  const fit = fitRaw === undefined ? undefined : IMG_FIT_MAP[fitRaw];
  if (fitRaw !== undefined && fit === undefined) {
    return {
      ok: false,
      reason: 'fit must be one of: cover, contain, fill, outside, inside, scale-down',
    };
  }

  return {
    ok: true,
    params: {
      src,
      ...(width !== undefined && { width }),
      ...(height !== undefined && { height }),
      quality,
      ...(format !== undefined && { format }),
      ...(fit !== undefined && { fit }),
    },
  };
}

/** Опции cf.image для fetch(url, { cf }) из провалидированных параметров. */
export function buildCfImageOptions(params: ImageTransformParams): Record<string, unknown> {
  const options: Record<string, unknown> = { quality: params.quality };
  if (params.width !== undefined) options.width = params.width;
  if (params.height !== undefined) options.height = params.height;
  if (params.format !== undefined) options.format = params.format;
  if (params.fit !== undefined) options.fit = params.fit;
  return options;
}

/**
 * Кэш ответа роута. Год+immutable нельзя: откат флага
 * NUXT_PUBLIC_IMG_TRANSFORM=off должен подействовать на браузеры за
 * сутки, а не через год. SWR держит тёплую копию на edge ещё неделю.
 */
export const IMG_CACHE_CONTROL = 'public, max-age=86400, stale-while-revalidate=604800';
