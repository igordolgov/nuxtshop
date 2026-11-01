// shared/siteContent.ts — редактируемый контент сайта («Контакты» и
// «О магазине»). ОДИН источник для сервера (валидация PUT /api/content),
// витрин (фолбэк, пока /api/content недоступен) и тестов.
//
// Дефолты — те же демо-значения, что раньше были захардкожены в
// app/pages/contacts.vue и app/pages/about.vue: сайт с пустым KV
// выглядит ровно как до появления редактора.

// ─── Типы ────────────────────────────────────────────────────────────────

export interface MessengerEntry {
  /** «Telegram», «VK», «WhatsApp»… — подпись кнопки на витрине. */
  name: string;
  /** '@nuxtshop', 'vk.com/nuxtshop'… — что копируется в буфер. */
  handle: string;
}

export interface StorePoint {
  city: string;
  /** «Флагман», «Шоурум и пункт выдачи»… — бейдж карточки. */
  badge: string;
  address: string;
  hours: string;
  /** Для витрины href выводится из phone (normalizePhoneHref). */
  phone: string;
}

export interface FaqEntry {
  q: string;
  a: string;
}

export interface StatEntry {
  /** «8 лет», «12 000+»… — крупная цифра. */
  value: string;
  /** «на рынке техники» — подпись. */
  label: string;
}

export interface HistoryEntry {
  year: string;
  text: string;
}

export interface ContactsContent {
  phone: string;
  email: string;
  hoursWeek: string;
  hoursWeekend: string;
  /**
   * Ссылка на встраиваемую карту с openstreetmap.org
   * (Экспорт → «Поделиться картой» → src ифрейма).
   * Пусто — используется дефолтная карта.
   */
  mapSrc: string;
  messengers: MessengerEntry[];
  stores: StorePoint[];
  faq: FaqEntry[];
}

export interface AboutContent {
  stats: StatEntry[];
  history: HistoryEntry[];
}

export interface SiteContent {
  contacts: ContactsContent;
  about: AboutContent;
  /** ISO-время последнего сохранения из админки; '' — ещё не сохраняли. */
  updatedAt: string;
}

// ─── Лимиты (синхронны с подсказками в админке) ──────────────────────────

export const CONTENT_LIMITS = {
  messengers: 4,
  stores: 8,
  faq: 8,
  stats: 6,
  history: 8,
  phone: 30,
  email: 120,
  hours: 40,
  mapSrc: 500,
  messengerName: 30,
  messengerHandle: 60,
  city: 40,
  badge: 40,
  address: 120,
  storeHours: 60,
  storePhone: 30,
  faqQ: 160,
  faqA: 600,
  statValue: 20,
  statLabel: 60,
  year: 10,
  historyText: 300,
} as const;

// ─── Дефолты (= прежний статический контент витрин) ──────────────────────

export const DEFAULT_SITE_CONTENT: SiteContent = {
  contacts: {
    phone: '8 (800) 555-35-35',
    email: 'support@nuxtshop.ru',
    hoursWeek: '9:00–20:00',
    hoursWeekend: '10:00–18:00',
    mapSrc:
      'https://www.openstreetmap.org/export/embed.html?bbox=37.5850%2C55.7500%2C37.6350%2C55.7720&layer=mapnik&marker=55.7616%2C37.6088',
    messengers: [
      { name: 'Telegram', handle: '@nuxtshop' },
      { name: 'VK', handle: 'vk.com/nuxtshop' },
      { name: 'WhatsApp', handle: '+7 800 555-35-35' },
    ],
    stores: [
      {
        city: 'Москва',
        badge: 'Флагман',
        address: 'ул. Тверская, 12',
        hours: 'Ежедневно 10:00–21:00',
        phone: '8 (495) 555-35-35',
      },
      {
        city: 'Санкт-Петербург',
        badge: 'Шоурум и пункт выдачи',
        address: 'Невский проспект, 45',
        hours: 'Ежедневно 10:00–21:00',
        phone: '8 (812) 555-35-35',
      },
      {
        city: 'Казань',
        badge: 'Пункт выдачи',
        address: 'ул. Баумана, 58',
        hours: 'Ежедневно 10:00–20:00',
        phone: '8 (843) 555-35-35',
      },
    ],
    faq: [
      {
        q: 'Как быстро вы доставляете?',
        a: 'Заказы, оформленные до 18:00, отправляем в тот же день. По городу курьер приезжает на следующий день, в пункты выдачи заказ поступает за 1–2 дня. Точный срок и стоимость показываются при оформлении.',
      },
      {
        q: 'Как вернуть товар?',
        a: 'В течение 14 дней после получения — при сохранении товарного вида и комплектации. Оформить возврат можно в любом нашем пункте выдачи или через форму на этой странице: привезём деньги обратно тем же способом, которым платили.',
      },
      {
        q: 'Какая гарантия на технику?',
        a: 'Стандартная гарантия производителя плюс ещё один год от магазина — итого 2 года на всю технику в каталоге. Обращайтесь в любой пункт выдачи: мы сами свяжемся с сервисным центром и проконтролируем ремонт.',
      },
      {
        q: 'Как можно оплатить заказ?',
        a: 'Картой онлайн (защищённый платёж) или наличными/картой при получении. Для юридических лиц выставляем счёт — напишите в форме выше, выбрав тему «Сотрудничество».',
      },
      {
        q: 'Можно ли посмотреть товар перед покупкой?',
        a: 'Да, во всех наших магазинах-шоурумах. Адреса и часы работы — в разделе «Наши магазины» на этой странице. В Москве техника к протестированию доступна в полном объёме.',
      },
    ],
  },
  about: {
    stats: [
      { value: '8 лет', label: 'на рынке техники' },
      { value: '12 000+', label: 'довольных клиентов' },
      { value: '30+', label: 'брендов в каталоге' },
      { value: '4', label: 'пункта выдачи' },
    ],
    history: [
      { year: '2018', text: 'Открыли первый магазин техники с принципом «покажи и расскажи честно».' },
      { year: '2020', text: 'Запустили интернет-магазин с доставкой по стране — покупки стали доступнее.' },
      { year: '2023', text: 'Четыре пункта выдачи и собственная курьерская служба: доставка от одного дня.' },
      { year: '2026', text: 'Программа гарантии 2 года на всю технику и 12 000+ довольных клиентов.' },
    ],
  },
  updatedAt: '',
};

// ─── Утилиты ─────────────────────────────────────────────────────────────

export class ContentValidationError extends Error {}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Строка из payload: тримминг + лимит. undefined/не-строка → ''. */
function str(raw: unknown, max: number): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  return s.slice(0, max);
}

/** Телефон → href для tel:-ссылки: 11 цифр с ведущей 8 → 7, затем «+». */
export function normalizePhoneHref(phone: string): string {
  const digits = phone.replace(/\D+/g, '');
  if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`;
  return `+${digits}`;
}

/**
 * Приводит полезную нагрузку формы админки к SiteContent. Отсутствующие
 * поля берутся из дефолта (частичный payload не может стереть данные).
 * Полностью пустые строки списков пропускаются, частично заполненные —
 * ошибка с внятным сообщением. Кидают ContentValidationError с сообщением
 * на русском — endpoint отдаёт его как 400.
 */
export function sanitizeSiteContent(raw: unknown): SiteContent {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const c = (src.contacts && typeof src.contacts === 'object' ? src.contacts : {}) as Record<string, unknown>;
  const a = (src.about && typeof src.about === 'object' ? src.about : {}) as Record<string, unknown>;
  const L = CONTENT_LIMITS;
  const d = DEFAULT_SITE_CONTENT;

  // ── Контакты ───────────────────────────────────────────────────────────
  const phone = str(c.phone, L.phone);
  if (!phone) throw new ContentValidationError('Укажите телефон магазина');
  const email = str(c.email, L.email);
  if (!email || !EMAIL_RE.test(email)) {
    throw new ContentValidationError('Укажите корректный email магазина');
  }

  const mapSrc = str(c.mapSrc, L.mapSrc);
  if (mapSrc && !mapSrc.startsWith('https://www.openstreetmap.org/')) {
    throw new ContentValidationError(
      'Ссылку на карту берите с openstreetmap.org: Экспорт → «Поделиться картой» → src ифрейма',
    );
  }

  const messengers = sanitizeList(
    c.messengers,
    L.messengers,
    'мессенджеры',
    (item) => {
      const name = str(item.name, L.messengerName);
      const handle = str(item.handle, L.messengerHandle);
      if (!name && !handle) return null; // пустая строка формы — пропускаем
      if (!name) throw new ContentValidationError('Мессенджер: укажите название');
      if (!handle) throw new ContentValidationError(`«${name}»: укажите ник/ссылку`);
      return { name, handle };
    },
    d.contacts.messengers,
  );

  const stores = sanitizeList(
    c.stores,
    L.stores,
    'магазины',
    (item) => {
      const city = str(item.city, L.city);
      const badge = str(item.badge, L.badge);
      const address = str(item.address, L.address);
      const hours = str(item.hours, L.storeHours);
      const phoneItem = str(item.phone, L.storePhone);
      if (!city && !address && !phoneItem && !badge && !hours) return null;
      if (!city) throw new ContentValidationError('Магазин: укажите город');
      if (!address) throw new ContentValidationError(`«${city}»: укажите адрес`);
      if (!phoneItem) throw new ContentValidationError(`«${city}»: укажите телефон`);
      return { city, badge, address, hours, phone: phoneItem };
    },
    d.contacts.stores,
  );

  const faq = sanitizeList(
    c.faq,
    L.faq,
    'вопросы',
    (item) => {
      const q = str(item.q, L.faqQ);
      const answer = str(item.a, L.faqA);
      if (!q && !answer) return null;
      if (!q) throw new ContentValidationError('Вопрос: заполните текст вопроса');
      if (!answer) throw new ContentValidationError(`«${q}»: заполните ответ`);
      return { q, a: answer };
    },
    d.contacts.faq,
  );

  // ── О магазине ─────────────────────────────────────────────────────────
  const stats = sanitizeList(
    a.stats,
    L.stats,
    'цифры',
    (item) => {
      const value = str(item.value, L.statValue);
      const label = str(item.label, L.statLabel);
      if (!value && !label) return null;
      if (!value) throw new ContentValidationError('Цифра: заполните значение');
      if (!label) throw new ContentValidationError(`«${value}»: заполните подпись`);
      return { value, label };
    },
    d.about.stats,
  );

  const history = sanitizeList(
    a.history,
    L.history,
    'история',
    (item) => {
      const year = str(item.year, L.year);
      const text = str(item.text, L.historyText);
      if (!year && !text) return null;
      if (!year) throw new ContentValidationError('Событие истории: укажите год');
      if (!text) throw new ContentValidationError(`«${year}»: заполните описание`);
      return { year, text };
    },
    d.about.history,
  );

  return {
    contacts: {
      phone,
      email,
      hoursWeek: str(c.hoursWeek, L.hours) || d.contacts.hoursWeek,
      hoursWeekend: str(c.hoursWeekend, L.hours) || d.contacts.hoursWeekend,
      mapSrc,
      messengers,
      stores,
      faq,
    },
    about: { stats, history },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Список из payload: undefined/null → дефолт (частичный payload не может
 * стереть данные), не-массив → ошибка, переполнение → ошибка. Обработчик
 * элемента может вернуть null — элемент пропускается (пустая строка формы).
 */
function sanitizeList<T>(
  rawList: unknown,
  max: number,
  label: string,
  mapItem: (item: Record<string, unknown>) => T | null,
  fallback: T[],
): T[] {
  if (rawList === undefined || rawList === null) {
    return structuredClone(fallback);
  }
  if (!Array.isArray(rawList)) {
    throw new ContentValidationError(`Список «${label}» передан в неверном формате`);
  }
  if (rawList.length > max) {
    throw new ContentValidationError(`Не больше ${max} элементов в списке «${label}»`);
  }
  const out: T[] = [];
  for (const rawItem of rawList) {
    const item = rawItem && typeof rawItem === 'object' ? (rawItem as Record<string, unknown>) : {};
    const mapped = mapItem(item);
    if (mapped) out.push(mapped);
  }
  return out;
}

/**
 * Достраивает сохранённый контент до полной формы: старые записи (до
 * появления новых полей) валидно отдаются с дефолтными значениями.
 * Никогда не бросает — витрина не должна падать из-за контента.
 */
export function mergeSiteContent(stored: unknown): SiteContent {
  try {
    // Сохранённое валидировано при записи — повторная валидация безопасна.
    const merged = sanitizeSiteContent(stored);
    // sanitize ставит updatedAt = «сейчас» (семантика сохранения); при
    // чтении возвращаем настоящее время последнего сохранения из KV.
    const src = (stored && typeof stored === 'object' ? stored : {}) as { updatedAt?: unknown };
    merged.updatedAt = typeof src.updatedAt === 'string' ? src.updatedAt : '';
    return merged;
  } catch {
    // Но если правила ужесточились после старой записи — отдаём дефолты.
    return structuredClone(DEFAULT_SITE_CONTENT);
  }
}
