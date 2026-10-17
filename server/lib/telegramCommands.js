// server/lib/telegramCommands.js
// Слэш-команды бота (этап 3): /pending, /stats, /stock, /help.
// Вызываются из webhook-эндпоинта (после whitelist — команды
// доступны только админам из TELEGRAM_ADMIN_USER_IDS).
// Все данные — из orderHelpers/productHelpers (KV), без кэша.
// ВАЖНО: readOrders — из orderHelpers (заказы),
// readProducts — из productHelpers (товары); это разные модули.

import { readOrders } from './orderHelpers';
import { readProducts } from './productHelpers';

// ⚙️ НАСТРОЙКА: порог «заканчивающийся товар» для /stock
const LOW_STOCK_THRESHOLD = 5;

/** Экранирование HTML: parse_mode='HTML' падает на «голых» < > & */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatRub(n) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n ?? 0);
}

// ─── Отправка (те же гарантии, что в telegram.ts) ───────────────────

async function sendMessageSafe(env, text) {
  const { sendMessage } = await import('./telegram');
  const ok = await sendMessage(env, env.TELEGRAM_ADMIN_CHAT_ID, text);
  // Логируем ТОЛЬКО неудачу: успешные отправки шумели в stdout тестов,
  // а в проде полезная информация — сам текст отправленного сообщения.
  if (!ok) console.warn('[telegram-cmd] ответ на команду НЕ отправлен');
  return ok;
}

// ─── /pending: заказы, ожидающие обработки ──────────────────────────

async function cmdPending(event, env) {
  const orders = await readOrders(event);
  const pending = orders.filter((o) => o.status === 'new');

  if (pending.length === 0) {
    return sendMessageSafe(env, '🆕 Новых заказов нет. Всё обработано ✅');
  }

  const lines = [`🆕 <b>Новых заказов: ${pending.length}</b>`, ''];
  for (const o of pending) {
    lines.push(
      `🧾 <b>${escapeHtml(o.id)}</b> — ${formatRub(o.total)}`,
      `👤 ${escapeHtml(o.customer.name)}, ${escapeHtml(o.customer.phone)}`,
      `${o.deliveryMethod === 'courier' ? '🚚' : o.deliveryMethod === 'post' ? '📮' : '📍'} ${o.items.length} поз. · ${escapeHtml(o.createdAt.slice(0, 16).replace('T', ' '))}`,
      '',
    );
  }
  lines.push('Открой карточку заказа в чате — кнопки действий там.');

  return sendMessageSafe(env, lines.join('\n'));
}

// ─── /stats: сводка за сегодня ──────────────────────────────────────

async function cmdStats(event, env) {
  const orders = await readOrders(event);
  const today = new Date().toISOString().slice(0, 10);

  const todayOrders = orders.filter((o) => o.createdAt.slice(0, 10) === today);
  const paid = todayOrders.filter((o) => o.status !== 'cancelled');
  const revenue = paid.reduce((sum, o) => sum + o.total, 0);
  const avg = paid.length ? Math.round(revenue / paid.length) : 0;
  const items = paid.reduce(
    (s, o) => s + o.items.reduce((n, i) => n + i.quantity, 0),
    0,
  );

  const lines = [
    `📊 <b>Статистика за ${today}</b>`,
    '',
    `🧾 Заказов: ${todayOrders.length} (из них отменено: ${todayOrders.length - paid.length})`,
    `💰 Выручка: <b>${formatRub(revenue)}</b>`,
    `📈 Средний чек: ${formatRub(avg)}`,
    `📦 Товаров продано: ${items} шт.`,
  ];

  return sendMessageSafe(env, lines.join('\n'));
}

// ─── /stock: заканчивающиеся товары ─────────────────────────────────

async function cmdStock(event, env) {
  const products = await readProducts(event);
  const low = products
    .filter((p) => (p.stockQuantity ?? 0) <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0))
    .slice(0, 15);

  if (low.length === 0) {
    return sendMessageSafe(
      env,
      `📦 Все товары в достатке (порог: ${LOW_STOCK_THRESHOLD} шт.)`,
    );
  }

  const lines = [`📦 <b>Заканчивающиеся товары (≤${LOW_STOCK_THRESHOLD} шт.):</b>`, ''];
  for (const p of low) {
    const emoji = (p.stockQuantity ?? 0) === 0 ? '🔴' : (p.stockQuantity ?? 0) <= 2 ? '🟠' : '🟡';
    lines.push(`${emoji} ${escapeHtml(p.name)} — <b>${p.stockQuantity ?? 0} шт.</b>`);
  }

  return sendMessageSafe(env, lines.join('\n'));
}

// ─── /help и /start: справка по командам ────────────────────────────

async function cmdHelp(env) {
  return sendMessageSafe(
    env,
    [
      '🤖 <b>Команды бота:</b>',
      '',
      '/pending — новые заказы',
      '/stats — статистика за сегодня',
      '/stock — заканчивающиеся товары',
      '/help — эта справка',
    ].join('\n'),
  );
}

// ─── Точка входа: разбор сообщения ──────────────────────────────────

/**
 * Обрабатывает text-сообщение (команду) из webhook.
 * @returns {boolean} — распознана ли команда
 */
export async function handleMessage(event, env, message) {
  const text = message?.text?.trim() ?? '';
  if (!text.startsWith('/')) return false;

  // /pending@nuxtshop_admin_bot → /pending (срезаем суффикс бота)
  const command = text.split(/\s+/)[0].split('@')[0].toLowerCase();

  switch (command) {
    case '/pending':
      await cmdPending(event, env);
      return true;
    case '/stats':
      await cmdStats(event, env);
      return true;
    case '/stock':
      await cmdStock(event, env);
      return true;
    case '/help':
    case '/start':
      await cmdHelp(env);
      return true;
    default:
      return false; // неизвестная команда — бот промолчит
  }
}