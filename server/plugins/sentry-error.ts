// server/plugins/sentry-error.ts — серверные ошибки → Sentry БЕЗ SDK.
//
// Почему не SDK: @sentry/nuxt для сервера тянет @sentry/node —
// его внутренности (AsyncLocalStorage, fs и пр.) на рантайме
// Cloudflare Workers (workerd) работают не гарантированно, а падение
// мониторинга не должно уметь ронять витрину. Envelope-протокол —
// тот же публичный HTTP API, которым пользуются все официальные SDK:
// POST https://<host>/api/<projectId>/envelope/?sentry_key=<key>
// (Content-Type: application/x-sentry-envelope).
//
// DSN — та же переменная NUXT_PUBLIC_SENTRY_DSN, что и у клиента
// (runtimeConfig.public.sentryDsn). Пусто → плагин молчит.
// Витрины различаются меткой store (STORE_NAME из store.config:
// «Магазин» / «Tienda Habana»).
//
// 4xx НЕ отправляются: 404 несуществующего товара/ключа API — нормальные
// ответы, а не баги (тем же правилом пользуется хук самого SDK).

// Имя магазина — метка store: витрины различаются в одном проекте Sentry
import { STORE_NAME } from '../../store.config';

interface SentryDsnParts {
  key: string;
  host: string;
  projectId: string;
}

type ErrorEventContext = { event?: import('h3').H3Event };

// Лимит: не более N событий в минуту на изоляту — защита от шторма
// ошибок (упавший KV/битый маршрут не должен заваливать квоту Sentry)
const RATE_LIMIT_PER_MINUTE = 20;
let windowStart = 0;
let sentInWindow = 0;

function parseDsn(dsn: string): SentryDsnParts | null {
  try {
    const url = new URL(dsn);
    const key = url.username;
    const projectId = url.pathname.replace(/\//g, '');
    if (!key || !projectId || !url.hostname) return null;
    return { key, host: url.hostname, projectId };
  } catch {
    return null;
  }
}

/** Стек из строки error.stack → frames Sentry (снаружи → внутрь). */
function stackFrames(stack?: string) {
  if (!stack) return undefined;
  const frames: Array<{
    function: string;
    filename: string;
    lineno: number;
    colno: number;
    in_app: boolean;
  }> = [];
  for (const line of stack.split('\n').slice(1)) {
    const m =
      /^\s*at\s+(?:(.+?)\s+\()?((?:file|https?|webpack|nitro):\/\/[^\s)]+|[^\s()]+):(\d+):(\d+)\)?/.exec(
        line,
      );
    if (!m) continue;
    const [, fn, filename, lineNo, colNo] = m;
    if (!filename || !lineNo || !colNo) continue;
    frames.push({
      function: fn ?? '<anonymous>',
      filename,
      lineno: Number(lineNo),
      colno: Number(colNo),
      in_app: !filename.includes('node_modules'),
    });
  }
  return frames.length ? { frames: frames.reverse() } : undefined;
}

function sendToSentry(parts: SentryDsnParts, error: unknown, ctx: ErrorEventContext) {
  const asError = error as { name?: string; message?: string; stack?: string };
  const message = String(asError?.message ?? error).slice(0, 1000);
  const eventId = crypto.randomUUID();

  const event = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    environment: 'production',
    server_name: STORE_NAME,
    level: 'error',
    message,
    tags: { store: STORE_NAME, runtime: 'workerd' },
    exception: {
      values: [
        {
          type: asError?.name || 'Error',
          value: message,
          stacktrace: stackFrames(asError?.stack),
          mechanism: { handled: false, type: 'nitro.error' },
        },
      ],
    },
    ...(ctx.event?.path
      ? {
          request: {
            url: String(ctx.event.path),
            method: String(ctx.event.method ?? ''),
          },
        }
      : {}),
  };

  const envelope =
    `${JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() })}\n` +
    `${JSON.stringify({ type: 'event' })}\n` +
    `${JSON.stringify(event)}`;

  return fetch(`https://${parts.host}/api/${parts.projectId}/envelope/?sentry_key=${parts.key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-sentry-envelope' },
    body: envelope,
  }).catch(() => {
    // Доставка телеметрии не может уронить запрос
  });
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error: unknown, ctx: ErrorEventContext) => {
    try {
      // h3 4xx — нормальные ответы API (404 товара, валидация форм)
      const status = (error as { statusCode?: number })?.statusCode;
      if (typeof status === 'number' && status >= 400 && status < 500) return;

      // DSN на каждый вызов: в cloudflare-preset env приходит вместе
      // с запросом, вне запроса useRuntimeConfig может быть пуст
      let dsn = '';
      try {
        dsn = useRuntimeConfig(ctx?.event).public.sentryDsn || '';
      } catch {
        return;
      }
      const parts = dsn ? parseDsn(dsn) : null;
      if (!parts) return;

      const now = Date.now();
      if (now - windowStart > 60_000) {
        windowStart = now;
        sentInWindow = 0;
      }
      if (sentInWindow >= RATE_LIMIT_PER_MINUTE) return;
      sentInWindow += 1;

      const send = sendToSentry(parts, error, ctx);
      // В Workers промис нужно «держать живым» после ответа клиенту
      const cfCtx = (
        ctx?.event as
          | { context?: { cloudflare?: { ctx?: { waitUntil?: (p: Promise<unknown>) => void } } } }
          | undefined
      )?.context?.cloudflare?.ctx;
      if (typeof cfCtx?.waitUntil === 'function') cfCtx.waitUntil(send);
      // Иначе (Node/dev) — пусть летит: .catch уже внутри sendToSentry
    } catch {
      // мониторинг не должен ронять обработку запроса
    }
  });
});
