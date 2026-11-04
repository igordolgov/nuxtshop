// server/routes/img.ts
/**
 * Роут-трансформатор картинок: /img?src=/images/products/x.webp&w=400&q=75
 *
 * Реализует Cloudflare Image Transformations методом «Transform via fetch»:
 * воркер перезапрашивает оригинал с опцией cf.image, Cloudflare ресайзит/
 * перекодирует на edge и кэширует результат сам («Resized images are always
 * cached»). Выбран этот метод, потому что URL-схема /cdn-cgi/image/*, которую
 * генерирует встроенный провайдер `cloudflare` @nuxt/image, на *.workers.dev
 * НЕ работает — включить Transformations можно только на собственной зоне.
 * cf.image через fetch() документирован как доступный «on any zone that hosts
 * a Worker, including *.workers.dev» (docs: Transform via fetch).
 *
 * Поведение по средам:
 *  - `pnpm dev` (Node): cf-опции игнорируются нативным fetch — отдаётся
 *    оригинал, трансформации нет (для вёрстки не важно);
 *  - `wrangler dev`: low-fi mock трансформаций (ресайз/формат приближённо);
 *  - прод: настоящие трансформации. Квота Images: 5 000 уникальных
 *    трансформаций/мес бесплатно, дальше $0.50/1 000.
 *
 * Откат БЕЗ деплоя: переменная окружения NUXT_PUBLIC_IMG_TRANSFORM=off
 * (vars в wrangler.jsonc или дашборд) → роут отвечает 302 на оригинал.
 * При любой ошибке трансформации (квота исчерпана → 9422, битый файл)
 * тоже отдаём редирект на оригинал — картинки не ломаются, теряется
 * только оптимизация.
 *
 * Валидация и лимиты — в server/utils/imgTransform.ts (покрыто тестами).
 */

interface CfEnv {
  NUXT_PUBLIC_IMG_TRANSFORM?: string;
}

interface CloudflareContext {
  env?: CfEnv;
}

/** fetch-инициализация с Cloudflare-специфичным полем cf (workerd). */
type CfFetchInit = RequestInit & { cf?: { image?: Record<string, unknown> } };

export default defineEventHandler(async (event) => {
  // Только чтение: GET отдают браузеры, HEAD — CDN/проверки доступности.
  // (Файл без суффикса .get — иначе nitro не матчит HEAD и отвечает 404.)
  const method = event.method;
  if (method !== 'GET' && method !== 'HEAD') {
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed' });
  }

  const parsed = parseImageTransformQuery(getQuery(event));
  if (!parsed.ok) {
    throw createError({ statusCode: 400, statusMessage: parsed.reason });
  }
  const { src } = parsed.params;

  // Предохранитель от зацикливания (docs → «Prevent request loops»):
  // запрос из пайплайна image-resizing отдаём как есть, без новых
  // трансформаций. Практически недостижимо (оригиналы лежат на других
  // путях), но по документации — обязательная страховка.
  if (/image-resizing/.test(getRequestHeader(event, 'via') ?? '')) {
    return sendRedirect(event, src, 302);
  }

  // Аварийный выключатель трансформаций (откат без деплоя).
  const cfContext = event.context.cloudflare as CloudflareContext | undefined;
  const flag =
    cfContext?.env?.NUXT_PUBLIC_IMG_TRANSFORM ?? useRuntimeConfig(event).public.imgTransform;
  if (flag === 'off') {
    return sendRedirect(event, src, 302);
  }

  // Базовый origin для оригиналов. На Workers getRequestURL() отдаёт
  // http://localhost (см. комментарий к NUXT_PUBLIC_SITE_URL в
  // wrangler.jsonc) — поэтому берём канонический siteUrl; в dev он пуст
  // и срабатывает fallback на origin запроса.
  const siteUrl = useRuntimeConfig(event).public.siteUrl;
  const base =
    typeof siteUrl === 'string' && siteUrl
      ? siteUrl.replace(/\/+$/, '')
      : getRequestURL(event).origin;

  const init: CfFetchInit = { cf: { image: buildCfImageOptions(parsed.params) } };
  let upstream: Response;
  try {
    upstream = await fetch(base + src, init);
  } catch {
    // Сеть/оригинал недоступны — уводим браузер на оригинал.
    return sendRedirect(event, src, 307);
  }

  // Ошибка трансформации (404 нет файла, 400 плохие параметры, 9422 квота) —
  // оригинал лучше сломанной картинки (рекомендация docs по error handling).
  if (!upstream.ok || !upstream.body) {
    return sendRedirect(event, src, 307);
  }

  setHeader(
    event,
    'Content-Type',
    upstream.headers.get('content-type') ?? 'application/octet-stream',
  );
  setHeader(event, 'Cache-Control', IMG_CACHE_CONTROL);
  // Тело — поток от пайплайна трансформации (тот же стиль, что выдача
  // R2-объекта в server/routes/api/images/[...key].ts).
  return upstream.body;
});
