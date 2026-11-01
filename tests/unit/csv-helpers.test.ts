// Тесты server/lib/csvHelpers.ts — экранирование CSV, документ целиком,
// маппинг заказа в строку и защита от формульной инъекции (OWASP).
import { describe, expect, it } from 'vitest';
import {
  CSV_BOM,
  CSV_DELIMITER,
  ORDERS_CSV_HEADERS,
  csvEscape,
  csvRow,
  formatOrderDateTime,
  orderItemsSummary,
  orderToCsvRow,
  ordersToCsv,
  toCsv,
} from '../../server/lib/csvHelpers';
import type { Order } from '../../server/lib/orderHelpers';

describe('csvEscape', () => {
  it('простые значения проходит как есть', () => {
    expect(csvEscape('ORD-123')).toBe('ORD-123');
    expect(csvEscape(1500)).toBe('1500');
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('удваивает кавычки и берёт поле в кавычки', () => {
    expect(csvEscape('Он сказал "привет"')).toBe('"Он сказал ""привет"""');
  });

  it('цитирует поля с разделителем и переносом строки', () => {
    expect(csvEscape(`a${CSV_DELIMITER}b`)).toBe(`"a${CSV_DELIMITER}b"`);
    expect(csvEscape('строка1\nстрока2')).toBe('"строка1\nстрока2"');
    expect(csvEscape('строка1\rстрока2')).toBe('"строка1\rстрока2"');
  });

  it('нейтрализует формульную инъекцию (OWASP CSV)', () => {
    // Excel исполняет = + - @ как формулы → апостроф-префикс
    expect(csvEscape('=СУММ(A1)')).toBe("'=СУММ(A1)");
    expect(csvEscape('+7 916 123-45-67')).toBe("'+7 916 123-45-67");
    expect(csvEscape('@import')).toBe("'@import");
    expect(csvEscape('-5')).toBe("'-5");
    expect(csvEscape('Москва')).toBe('Москва'); // обычный текст не трогаем
  });
});

describe('csvRow / toCsv', () => {
  it('склеивает поля разделителем', () => {
    expect(csvRow(['a', 1, null])).toBe(`a${CSV_DELIMITER}1${CSV_DELIMITER}`);
  });

  it('документ начинается с BOM, строки с CRLF', () => {
    const doc = toCsv(
      ['А', 'Б'],
      [
        ['1', '2'],
        ['3', '4'],
      ],
    );
    expect(doc.startsWith(CSV_BOM)).toBe(true);
    expect(doc.endsWith('\r\n')).toBe(true);
    expect(doc).toBe(
      `${CSV_BOM}А${CSV_DELIMITER}Б\r\n1${CSV_DELIMITER}2\r\n3${CSV_DELIMITER}4\r\n`,
    );
  });
});

describe('formatOrderDateTime', () => {
  it('форматирует ISO в DD.MM.YYYY HH:mm (UTC, детерминированно)', () => {
    expect(formatOrderDateTime('2026-01-05T09:07:00.000Z')).toBe('05.01.2026 09:07');
    // padStart: одиночные месяцы/часы дополняются нулём
    expect(formatOrderDateTime('2026-11-02T03:15:00.000Z')).toBe('02.11.2026 03:15');
  });

  it('пустое/битое значение не бросает исключение', () => {
    expect(formatOrderDateTime(null)).toBe('');
    expect(formatOrderDateTime(undefined)).toBe('');
    expect(formatOrderDateTime('не дата')).toBe('не дата');
  });
});

// ─── Фикстура: заказ со всеми полями ─────────────────────────────────
const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'ORD-TEST-1',
  status: 'new',
  items: [
    {
      id: '1',
      slug: 'krug',
      name: 'Кружка "Керамика"',
      price: 500,
      quantity: 2,
      image: null,
      category: 'Посуда',
    },
    {
      id: '2',
      slug: 'tarelka',
      name: 'Тарелка',
      price: 300,
      quantity: 1,
      image: null,
      category: 'Посуда',
    },
  ],
  subtotal: 1300,
  discount: 130,
  promoCode: 'SALE10',
  deliveryMethod: 'courier',
  deliveryPrice: 0,
  paymentMethod: 'card',
  total: 1170,
  customer: {
    userId: null,
    name: 'Иван Иванов',
    email: 'ivan@example.com',
    phone: '+7 916 123-45-67',
    city: 'Москва',
    address: 'ул. Ленина, д. 1, кв. 2',
  },
  notify: { email: 'ivan@example.com', pushSubscribed: false, telegramChat: null },
  comment: 'Позвонить заранее',
  statusHistory: [],
  createdAt: '2026-01-05T14:30:00.000Z',
  updatedAt: '2026-01-05T14:30:00.000Z',
  ...overrides,
});

describe('orderToCsvRow / orderItemsSummary', () => {
  it('состав заказа одной строкой через « | »', () => {
    const summary = orderItemsSummary(makeOrder());
    // название с кавычками попадёт в итоговый CSV в кавычках — в summary
    // оно остаётся как есть, экранирование — дело csvRow
    expect(summary).toBe('Кружка "Керамика" × 2 (500 ₽) | Тарелка × 1 (300 ₽)');
  });

  it('строка заказа: 19 полей в порядке заголовков', () => {
    const row = orderToCsvRow(makeOrder());
    expect(row).toHaveLength(ORDERS_CSV_HEADERS.length);
    expect(row[0]).toBe('ORD-TEST-1');
    expect(row[1]).toBe('05.01.2026 14:30');
    expect(row[2]).toBe('Новый');
    expect(row[3]).toBe('Иван Иванов');
    expect(row[5]).toBe('+7 916 123-45-67'); // сырое значение; нейтрализация — в csvRow
    expect(row[10]).toBe('Кружка "Керамика" × 2 (500 ₽) | Тарелка × 1 (300 ₽)');
    expect(row[11]).toBe(2); // позиций
    expect(row[12]).toBe(3); // товаров, шт
    expect(row[13]).toBe(1300);
    expect(row[14]).toBe(130);
    expect(row[15]).toBe('SALE10');
    expect(row[17]).toBe(1170);
    expect(row[18]).toBe('Позвонить заранее');
  });

  it('заказ без клиента/промокода/комментария — пустые поля, не падаем', () => {
    const row = orderToCsvRow(
      makeOrder({
        customer: { userId: null, name: '', email: '', phone: '' },
        promoCode: null,
        comment: '',
        items: [],
      }),
    );
    expect(row[3]).toBe('');
    expect(row[10]).toBe('');
    expect(row[11]).toBe(0);
    expect(row[12]).toBe(0);
    expect(row[15]).toBe('');
  });
});

describe('ordersToCsv', () => {
  it('полный документ: BOM, заголовки, сортировка новые→старые', () => {
    const old = makeOrder({ id: 'ORD-OLD', createdAt: '2025-06-01T10:00:00.000Z' });
    const fresh = makeOrder({ id: 'ORD-FRESH', createdAt: '2026-02-01T10:00:00.000Z' });
    const doc = ordersToCsv([old, fresh]);

    const lines = doc.split('\r\n').filter(Boolean);
    expect(lines[0].replace(CSV_BOM, '')).toBe(csvRow(ORDERS_CSV_HEADERS));
    // свежий заказ — первой строкой данных
    expect(lines[1]).toContain('ORD-FRESH');
    expect(lines[2]).toContain('ORD-OLD');
    // кавычки в составе заказа экранированы удвоением
    expect(doc).toContain('"Кружка ""Керамика"" × 2 (500 ₽)');
  });
});
