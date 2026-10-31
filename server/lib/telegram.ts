// server/lib/telegram.ts
// Telegram-интеграция: карточки заказов админу с inline-кнопками
// «Подтвердить/Отменить» и редактирование карточки после нажатия.
// Транспорт — fetch (Workers-совместимо). Секреты:
//   TELEGRAM_BOT_TOKEN        — токен бота (BotFather)
//   TELEGRAM_ADMIN_CHAT_ID    — куда слать карточки: ОДИН id или список
//                               через запятую (личный чат и/или группа;
//                               id группы — отрицательный, минус обязателен!)
//   TELEGRAM_ADMIN_USER_IDS   — кто может жать кнопки (id пользователей,
//                               список через запятую); если не задан —
//                               fallback на TELEGRAM_ADMIN_CHAT_ID
//   TELEGRAM_WEBHOOK_SECRET   — проверка, что webhook зовёт Telegram
// Отсутствие секретов — тихий no-op (dev не требует бота).

import { ORDER_STATUS_LABELS, type OrderStatus } from './orderHelpers';

const API_BASE = 'https://api.telegram.org';

interface TelegramEnv {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_ADMIN_CHAT_ID?: string;
  TELEGRAM_ADMIN_USER_IDS?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
}

/** Конфигурация бота присутствует? */
export function isTelegramConfigured(env: TelegramEnv | null | undefined): boolean {
  return Boolean(env?.TELEGRAM_BOT_TOKEN && env?.TELEGRAM_ADMIN_CHAT_ID);
}

/** Список адресатов карточек из секрета: один id или список через запятую */
export function getAdminChatIds(env: TelegramEnv | null | undefined): string[] {
  return (env?.TELEGRAM_ADMIN_CHAT_ID ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Список id пользователей, которым разрешены кнопки (webhook whitelist) */
export function getAdminUserIds(env: TelegramEnv | null | undefined): string[] {
  const raw = env?.TELEGRAM_ADMIN_USER_IDS ?? env?.TELEGRAM_ADMIN_CHAT_ID ?? '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Человекочитаемое описание произвольной ошибки (error в catch — unknown) */
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Вызов метода Bot API. Ошибки логируются, наружу — boolean (не бросаем) */
async function callApi(env: TelegramEnv, method: string, payload: Record<string, unknown>) {
  try {
    const res = await fetch(`${API_BASE}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[telegram] ${method} failed: ${res.status} ${body.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (error) {
    // Сетевая ошибка Telegram не должна ронять заказ
    console.error('[telegram] network error:', errorText(error));
    return false;
  }
}

export async function sendMessage(env: TelegramEnv, chatId: string | number, text: string) {
  if (!env?.TELEGRAM_BOT_TOKEN || !chatId) return false;
  return callApi(env, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' });
}

// ─── Карточки заказов ───────────────────────────────────────────────

/** Клавиатура под карточкой заказа. callback_data < 64 байт — ок */
function orderKeyboard(orderId: string) {
  return [
    [
      { text: '✅ Подтвердить', callback_data: `order:confirm:${orderId}` },
      { text: '❌ Отменить', callback_data: `order:cancel:${orderId}` },
    ],
  ];
}

/** Карточка нового заказа + кнопки, во ВСЕ адресата из списка.
 *  Успех — если доставлен хотя бы в один чат */
export async function sendOrderCard(
  env: TelegramEnv,
  order: Parameters<typeof formatOrderCard>[0],
) {
  const chatIds = getAdminChatIds(env);
  if (!env?.TELEGRAM_BOT_TOKEN || chatIds.length === 0) return false;

  const results = await Promise.allSettled(
    chatIds.map((chatId) =>
      callApi(env, 'sendMessage', {
        chat_id: chatId,
        text: formatOrderCard(order),
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: orderKeyboard(order.id) },
      }),
    ),
  );
  return results.some((r) => r.status === 'fulfilled' && r.value === true);
}

/** Ответ на нажатие кнопки: убирает «часики», показывает всплывашку */
export async function answerCallbackQuery(
  env: TelegramEnv,
  callbackQueryId: string,
  text?: string,
  showAlert = false,
) {
  if (!env?.TELEGRAM_BOT_TOKEN) return false;
  return callApi(env, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}

// Эмодзи статусов; подписи — из orderHelpers (единый источник)
const STATUS_EMOJI: Record<OrderStatus, string> = {
  new: '🆕',
  confirmed: '✅',
  shipped: '🚚',
  delivered: '📬',
  cancelled: '❌',
};

/**
 * Перерисовывает карточку заказа после смены статуса: новый текст
 * с бейджем статуса, кнопки убраны (reply_markup не передаётся).
 * «message is not modified» при повторном нажатии — вернёт false,
 * это безвредно (статус в тосте всё равно корректный).
 */
export async function editOrderCard(
  env: TelegramEnv,
  chatId: string | number,
  messageId: number,
  order: Parameters<typeof formatOrderCard>[0] & { status: OrderStatus },
) {
  if (!env?.TELEGRAM_BOT_TOKEN) return false;
  const statusLine = `${STATUS_EMOJI[order.status]} ${ORDER_STATUS_LABELS[order.status]}`;
  return callApi(env, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: formatOrderCard(order, statusLine),
    parse_mode: 'HTML',
  });
}

// ─── Публикации новостей ─────────────────────────────────────────────

/**
 * Пост о новой новости: рубрика, заголовок, краткое описание и диплинк
 * /news?news=<id> — на витрине он сразу открывает модалку с полным
 * текстом. Чистая функция — покрыта тестами.
 */
export function formatNewsCard(
  news: { id: string; title: string; excerpt: string; category: string },
  siteUrl: string,
): string {
  const lines: string[] = [];
  lines.push(`📰 <b>Новая публикация</b> · ${escapeHtml(news.category)}`);
  lines.push(`<b>${escapeHtml(news.title)}</b>`);
  if (news.excerpt) {
    lines.push('');
    lines.push(escapeHtml(news.excerpt));
  }
  const url = `${siteUrl.replace(/\/+$/, '')}/news?news=${encodeURIComponent(news.id)}`;
  lines.push('');
  lines.push(`🔗 ${escapeHtml(url)}`);
  return lines.join('\n');
}

/**
 * Публикация новости в Telegram: пост во ВСЕ адресата
 * (TELEGRAM_ADMIN_CHAT_ID). Best-effort: без секретов — тихий no-op,
 * сетевые сбои логируются внутри callApi, наружу — boolean. Успех —
 * если доставлен хотя бы в один чат.
 */
export async function sendNewsPost(
  env: TelegramEnv | null | undefined,
  news: Parameters<typeof formatNewsCard>[0],
  siteUrl: string,
): Promise<boolean> {
  if (!isTelegramConfigured(env)) return false;
  const text = formatNewsCard(news, siteUrl);
  const results = await Promise.allSettled(
    getAdminChatIds(env).map((chatId) => sendMessage(env, chatId, text)),
  );
  return results.some((r) => r.status === 'fulfilled' && r.value === true);
}

// ─── Форматирование ─────────────────────────────────────────────────

/** Экранирование HTML: parse_mode='HTML' падает на «голых» < > & из данных */
function escapeHtml(str: string | null | undefined): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatRub(n: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n ?? 0);
}

// ⚙️ НАСТРОЙКА: подписи способов доставки в сообщении
const DELIVERY_LABELS: Record<string, string> = {
  courier: '🚚 Курьером',
  pickup: '📍 Самовывоз',
  post: '📮 Почтой',
};

/**
 * Карточка заказа. Без statusLine — заголовок «Новый заказ» (перед кнопками);
 * со statusLine — бейдж статуса (после нажатия кнопки).
 */
export function formatOrderCard(
  order: {
    id: string;
    total: number;
    subtotal: number;
    discount: number;
    promoCode: string | null;
    deliveryMethod: string;
    paymentMethod: string;
    comment: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    customer: { name: string; phone: string; email: string; city?: string; address?: string };
  },
  statusLine?: string,
): string {
  const lines: string[] = [];

  lines.push(
    statusLine
      ? `🧾 <b>Заказ ${escapeHtml(order.id)}</b> — ${statusLine}`
      : `🛒 <b>Новый заказ ${escapeHtml(order.id)}</b>`,
  );
  lines.push(`💰 Итого: <b>${formatRub(order.total)}</b>`);
  lines.push('');

  lines.push('<b>Состав:</b>');
  for (const item of order.items) {
    lines.push(
      `• ${escapeHtml(item.name)} × ${item.quantity} — ${formatRub(item.price * item.quantity)}`,
    );
  }
  lines.push('');

  lines.push(`👤 ${escapeHtml(order.customer.name)}`);
  lines.push(`📞 ${escapeHtml(order.customer.phone)}`);
  lines.push(`📧 ${escapeHtml(order.customer.email)}`);

  const delivery = DELIVERY_LABELS[order.deliveryMethod] ?? order.deliveryMethod;
  const address = order.customer.address
    ? `, ${escapeHtml(order.customer.city)}, ${escapeHtml(order.customer.address)}`
    : '';
  lines.push(`${delivery}${address}`);
  lines.push(
    order.paymentMethod === 'card' ? '💳 Картой при подтверждении' : '💵 Наличными при получении',
  );

  if (order.promoCode) {
    lines.push(`🎟 Промокод ${escapeHtml(order.promoCode)} (−${formatRub(order.discount)})`);
  }
  if (order.comment) {
    lines.push(`💬 ${escapeHtml(order.comment)}`);
  }

  return lines.join('\n');
}
