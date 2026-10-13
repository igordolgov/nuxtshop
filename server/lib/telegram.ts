// server/lib/telegram.ts
// Уведомления админу через Telegram Bot API.
// Транспорт — обычный fetch (Workers-совместимо, без зависимостей).
// Секреты: TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID (wrangler secret put).
// Отсутствие секретов — тихий no-op: dev и локальная работа не требуют бота.

const API_BASE = 'https://api.telegram.org';

interface TelegramEnv {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_ADMIN_CHAT_ID?: string;
}

/** Конфигурация бота присутствует? */
export function isTelegramConfigured(env: TelegramEnv | null | undefined): boolean {
  return Boolean(env?.TELEGRAM_BOT_TOKEN && env?.TELEGRAM_ADMIN_CHAT_ID);
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

/** Уведомление админу (chat_id из секрета) */
export async function notifyAdmin(env: TelegramEnv, text: string) {
  if (!isTelegramConfigured(env)) return false;
  // Прямая проверка вместо доверия boolean-функции: TS не сужает типы
  // опциональных полей через результат isTelegramConfigured()
  const chatId = env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatId) return false;
  return sendMessage(env, chatId, text);
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

/** Карточка нового заказа для чата админа */
export function formatNewOrderMessage(order: {
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
}): string {
  const lines: string[] = [];

  lines.push(`🛒 <b>Новый заказ ${escapeHtml(order.id)}</b>`);
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
