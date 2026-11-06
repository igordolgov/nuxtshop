// server/lib/csvHelpers.ts
// Генерация CSV-выгрузки заказов (GET /api/orders/export).
//
// Диалект «Excel RU»: разделитель «;», концы строк CRLF, BOM в начале
// документа — файл открывается двойным кликом в русском Excel/Numbers
// без мастера импорта (запятая в RU-локали означает десятичный разделитель,
// поэтому классический «запятый» CSV Excel разрывает по колонкам неверно).
//
// Безопасность:
// 1. Экранирование — поля с разделителем/кавычкой/переносом строки берутся
//    в двойные кавычки, сами кавычки удваиваются (RFC 4180).
// 2. Формульная инъекция (OWASP CSV Injection): значение, начинающееся
//    с = + - @ или табуляции, Excel/LibreOffice могут исполнить как формулу.
//    Такие значения префиксуются апострофом — в таблице они отображаются
//    как текст (клиент с именем «=СУММ(A1)» не станет формулой).
import type { Order } from './orderHelpers';
// Валюта CSV-колонок и сумм — из конфига витрины (₽ / $, см. store.config.ts)
import { currencySymbol } from '../../store.config';

export const CSV_DELIMITER = ';';
export const CSV_BOM = '﻿'; // U+FEFF — невидимый маркер UTF-8 для Excel

// ─── Экранирование ───────────────────────────────────────────────────

/** Экранирование одного поля CSV. null/undefined → пустая строка. */
export function csvEscape(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);

  // Защита от формульной инъекции: апостроф-префикс делает ячейку текстом
  if (/^[=+@\t\r-]/.test(s)) s = `'${s}`;

  const needsQuotes = s.includes(CSV_DELIMITER) || s.includes('"') || /[\n\r]/.test(s);
  return needsQuotes ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Одна запись CSV из набора полей. */
export function csvRow(fields: unknown[]): string {
  return fields.map(csvEscape).join(CSV_DELIMITER);
}

/** Полный документ: BOM + строка заголовков + записи, каждая с CRLF. */
export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [csvRow(headers), ...rows.map((row) => csvRow(row))];
  return `${CSV_BOM}${lines.join('\r\n')}\r\n`;
}

// ─── Модель заказа → строка CSV ──────────────────────────────────────

/** Дата/время в детерминированном формате DD.MM.YYYY HH:mm (UTC):
 *  Workers живут в UTC, выгрузка не должна зависеть от TZ машины. */
export function formatOrderDateTime(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
  );
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  shipped: 'В доставке',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};

const DELIVERY_LABELS: Record<string, string> = {
  courier: 'Курьером',
  post: 'Почтой',
  pickup: 'Самовывоз',
};

const PAYMENT_LABELS: Record<string, string> = {
  card: 'Картой',
  cash: 'Наличными',
  transfer: 'Переводом',
};

export const ORDERS_CSV_HEADERS = [
  'Номер',
  'Дата (UTC)',
  'Статус',
  'Клиент',
  'Email',
  'Телефон',
  'Город',
  'Адрес',
  'Доставка',
  'Оплата',
  'Состав заказа',
  'Позиций',
  'Товаров, шт',
  'Сумма товаров, ' + currencySymbol(),
  'Скидка, ' + currencySymbol(),
  'Промокод',
  'Доставка, ' + currencySymbol(),
  'Итого, ' + currencySymbol(),
  'Комментарий',
];

/** Состав заказа одной строкой: «Название × кол-во (цена с валютой) | …». */
export function orderItemsSummary(order: Order): string {
  return (order.items ?? [])
    .map((i) => `${i.name} × ${i.quantity} (${i.price} ${currencySymbol()})`)
    .join(' | ');
}

/** Заказ → массив полей CSV (порядок = ORDERS_CSV_HEADERS). */
export function orderToCsvRow(order: Order): Array<unknown> {
  const items = order.items ?? [];
  return [
    order.id,
    formatOrderDateTime(order.createdAt),
    STATUS_LABELS[order.status] ?? order.status,
    order.customer?.name ?? '',
    order.customer?.email ?? '',
    order.customer?.phone ?? '',
    order.customer?.city ?? '',
    order.customer?.address ?? '',
    DELIVERY_LABELS[order.deliveryMethod] ?? order.deliveryMethod,
    PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod,
    orderItemsSummary(order),
    items.length,
    items.reduce((n, i) => n + (i.quantity || 0), 0),
    order.subtotal ?? 0,
    order.discount ?? 0,
    order.promoCode ?? '',
    order.deliveryPrice ?? 0,
    order.total ?? 0,
    order.comment ?? '',
  ];
}

/** Все заказы → готовый CSV-документ (сортировка новые→старые). */
export function ordersToCsv(orders: Order[]): string {
  const sorted = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return toCsv(ORDERS_CSV_HEADERS, sorted.map(orderToCsvRow));
}
