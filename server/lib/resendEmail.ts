// server/lib/resendEmail.ts
// Email-канал уведомлений через Resend (https://resend.com): письма
// «товар снова в наличии» покупателям, оставившим email в заявке
// back-in-stock. Транспорт — fetch (Workers-совместимо), тот же
// best-effort контракт, что у Telegram: наружу — boolean, сбои логируются.
//
// Секреты (ЗДЕСЬ не объявляются — управляются через `npx wrangler secret
// put` / дашборд Cloudflare, переживают деплой сами):
//   RESEND_API_KEY — ключ из resend.com → API Keys (re_…)
//   RESEND_FROM    — отправитель в формате «Имя <noreply@ваш-домен>».
//                    Домен должен быть верифицирован в Resend (DNS-записи).
//                    Для проверки можно onboarding@resend.dev — но он
//                    доставляет только на свой собственный адрес аккаунта.
// Отсутствие секретов — тихий no-op: email-канал выключен, заявки с email
// остаются pending (как раньше с Telegram без привязки).

/** Часть env воркера, нужная Resend (пересекается с TelegramEnv у caller). */
export interface ResendEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
}

const API_BASE = 'https://api.resend.com/emails';

/** Конфигурация Resend присутствует (ключ И адрес отправителя)? */
export function isResendConfigured(env: ResendEnv | null | undefined): env is ResendEnv {
  return Boolean(env?.RESEND_API_KEY && env?.RESEND_FROM);
}

/** Похоже ли значение заявки на email (в отличие от телефона)? */
export function isEmailContact(contact: string | null | undefined): boolean {
  return Boolean(contact && contact.includes('@'));
}

/** Экранирование HTML для вставки данных покупателя/товара в письмо. */
function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Чистые генераторы содержимого письма (покрыты юнит-тестами) ─────

export interface RestockEmailPayload {
  /** Название товара (без экранирования — функции сами экранируют) */
  name: string;
  /** Цена строкой (formatMoney) или '' — строка цены не выводится */
  price?: string;
  /** Абсолютная ссылка на карточку товара */
  url: string;
}

/**
 * Тема письма. Переносы вырезаются: subject — однострочный заголовок
 * (перевод строки внутри ломает отображение в некоторых клиентах).
 */
export function restockEmailSubject(name: string): string {
  const clean = String(name ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  return `Товар снова в наличии — «${clean}»`;
}

/** HTML-версия письма (Resend: поле html). Инлайн-стили — email-клиенты
 *  вырезают <style>. Простая одно-колоночная вёрстка. */
export function restockEmailHtml(payload: RestockEmailPayload): string {
  const name = escapeHtml(payload.name);
  const price = payload.price ? ` — <b style="color:#111827">${escapeHtml(payload.price)}</b>` : '';
  const url = String(payload.url ?? '');

  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2937">',
    '<h2 style="font-size:20px;margin:0 0 12px">🎉 Товар снова в наличии!</h2>',
    `<p style="font-size:16px;margin:0 0 20px"><b>«${name}»</b>${price}</p>`,
    `<p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Перейти к товару</a></p>`,
    '<p style="font-size:12px;color:#6b7280;margin:0">Вы получили это письмо, потому что оставляли заявку «сообщить о поступлении» в нашем магазине.</p>',
    '</div>',
  ].join('\n');
}

/** Текстовая версия (Resend: поле text) — фолбэк для клиентов без HTML. */
export function restockEmailText(payload: RestockEmailPayload): string {
  const price = payload.price ? ` — ${payload.price}` : '';
  return [
    'Товар снова в наличии!',
    '',
    `«${payload.name}»${price}`,
    payload.url,
    '',
    'Вы получили это письмо, потому что оставляли заявку «сообщить о поступлении» в нашем магазине.',
  ].join('\n');
}

// ─── Отправка ────────────────────────────────────────────────────────────

/**
 * Отправка письма через Resend API. Сбои (сеть, 4xx/5xx, битый ключ)
 * логируются, наружу — boolean: email-канал никогда не ломает сохранение
 * товара (caller оборачивает вызов в try/catch, как и Telegram).
 */
export async function sendRestockEmail(
  env: ResendEnv | null | undefined,
  to: string,
  payload: RestockEmailPayload,
): Promise<boolean> {
  if (!isResendConfigured(env) || !to) return false;

  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM,
        to: [to],
        subject: restockEmailSubject(payload.name),
        html: restockEmailHtml(payload),
        text: restockEmailText(payload),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[resend] send failed: ${res.status} ${body.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      '[resend] network error:',
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}
