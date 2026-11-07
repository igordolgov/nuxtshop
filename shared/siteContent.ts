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
  /**
   * Переводы (i18n): нет поля/пусто → витрина показывает русский
   * (фолбэк, localizedSiteContent). Телефон не переводится.
   */
  cityEn?: string;
  cityEs?: string;
  badgeEn?: string;
  badgeEs?: string;
  addressEn?: string;
  addressEs?: string;
  hoursEn?: string;
  hoursEs?: string;
}

export interface FaqEntry {
  q: string;
  a: string;
  /** Переводы: нет поля/пусто → фолбэк на русский. */
  qEn?: string;
  aEn?: string;
  qEs?: string;
  aEs?: string;
}

export interface StatEntry {
  /** «8 лет», «12 000+»… — крупная цифра. */
  value: string;
  /** «на рынке техники» — подпись. */
  label: string;
  /** Переводы: нет поля/пусто → фолбэк на русский. */
  valueEn?: string;
  labelEn?: string;
  valueEs?: string;
  labelEs?: string;
}

export interface HistoryEntry {
  year: string;
  text: string;
  /** Переводы: нет поля/пусто → фолбэк на русский. */
  textEn?: string;
  textEs?: string;
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

// ─── Дефолты ─────────────────────────────────────────────────────────────
// ⚙️ КУБИНСКАЯ ВЕТКА: базовые поля — испанские (основной язык витрины es,
// переводы-суффиксы En/Es не нужны: ru/en на копии показывают испанский).
// Демо-данные Гаваны — друг заменит их в админке («Контакты»/«О магазине»);
// их же видит витрина, пока KV пустой. Российские дефолты — в main.

export const DEFAULT_SITE_CONTENT: SiteContent = {
  contacts: {
    phone: '+53 5 123 4567',
    email: 'ventas@mitienda.cu',
    hoursWeek: '9:00–18:00',
    hoursWeekend: '9:00–13:00',
    mapSrc:
      'https://www.openstreetmap.org/export/embed.html?bbox=-82.4090%2C23.1050%2C-82.3390%2C23.1560&layer=mapnik&marker=23.1290%2C-82.3740',
    messengers: [
      { name: 'WhatsApp', handle: '+53 5 123 4567' },
      { name: 'Telegram', handle: '@mitiendacuba' },
    ],
    stores: [
      {
        city: 'La Habana',
        badge: 'Tienda insignia',
        address: 'Calle 23 e/ L y M, Vedado',
        hours: 'Lun–Sáb 9:00–18:00',
        phone: '+53 5 123 4567',
      },
      {
        city: 'Centro Habana',
        badge: 'Punto de recogida',
        address: 'Av. Simón Bolívar (Reina), 96',
        hours: 'Lun–Sáb 9:00–17:00',
        phone: '+53 5 234 5678',
      },
    ],
    faq: [
      {
        q: '¿Cómo puedo pagar mi pedido?',
        a: 'Con transferencia por QR desde Transfermóvil o EnZona al confirmar el pedido, o en efectivo al recibirlo. Tras confirmar, el gerente le envía los datos para la transferencia y marca el pago en el sistema.',
      },
      {
        q: '¿Hacen entregas a domicilio?',
        a: 'Sí. Dentro de La Habana el mensajero llega al día siguiente; el envío al resto del país se coordina por teléfono o WhatsApp. El coste exacto se muestra al finalizar la compra.',
      },
      {
        q: '¿Qué garantía tienen los equipos?',
        a: 'Todos los equipos del catálogo cuentan con garantía de la tienda. Si surge algún problema, escríbanos por WhatsApp: coordinamos la revisión con el taller y le mantenemos informado.',
      },
      {
        q: '¿Puedo devolver un producto?',
        a: 'Dentro de los 7 días posteriores a la entrega, conservando el embalaje y los accesorios. El dinero se devuelve por la misma vía con la que pagó.',
      },
      {
        q: '¿Se puede ver el producto antes de comprarlo?',
        a: 'Sí, en nuestra tienda de Vedado puede ver y probar los equipos antes de decidir. También respondemos consultas por WhatsApp con fotos y videos reales del producto.',
      },
    ],
  },
  about: {
    stats: [
      { value: '10 años', label: 'en el mercado cubano' },
      { value: '5 000+', label: 'clientes satisfechos' },
      { value: '15+', label: 'marcas en el catálogo' },
      { value: '2', label: 'puntos de recogida' },
    ],
    history: [
      {
        year: '2016',
        text: 'Abrimos el primer puesto de teléfonos en el centro de La Habana.',
      },
      {
        year: '2020',
        text: 'Ampliamos el catálogo: laptops, tablets y accesorios de electrónica.',
      },
      {
        year: '2024',
        text: 'Abrimos el taller de servicio técnico propio y la entrega a domicilio en La Habana.',
      },
      {
        year: '2026',
        text: 'Tienda online con pago por Transfermóvil y EnZona — pedidos desde cualquier provincia.',
      },
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
 * Добавляет перевод-строку в запись списка: непустая строка → trim+лимит;
 * пусто/не строка → поле в запись НЕ ставится (фолбэк на русский на
 * витрине). Мутирует переданный объект — используется только при сборке
 * записи в sanitizeList.
 */
function putTr(entry: object, key: string, raw: unknown, max: number): void {
  const value = str(raw, max);
  // Записи — типизированные интерфейсы без index-сигнатуры (StorePoint и др.),
  // запись вычисляемого ключа — только через Record-вид
  if (value) (entry as Record<string, unknown>)[key] = value;
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
  const c = (src.contacts && typeof src.contacts === 'object' ? src.contacts : {}) as Record<
    string,
    unknown
  >;
  const a = (src.about && typeof src.about === 'object' ? src.about : {}) as Record<
    string,
    unknown
  >;
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
      const entry: StorePoint = { city, badge, address, hours, phone: phoneItem };
      putTr(entry, 'cityEn', item.cityEn, L.city);
      putTr(entry, 'cityEs', item.cityEs, L.city);
      putTr(entry, 'badgeEn', item.badgeEn, L.badge);
      putTr(entry, 'badgeEs', item.badgeEs, L.badge);
      putTr(entry, 'addressEn', item.addressEn, L.address);
      putTr(entry, 'addressEs', item.addressEs, L.address);
      putTr(entry, 'hoursEn', item.hoursEn, L.storeHours);
      putTr(entry, 'hoursEs', item.hoursEs, L.storeHours);
      return entry;
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
      const entry: FaqEntry = { q, a: answer };
      putTr(entry, 'qEn', item.qEn, L.faqQ);
      putTr(entry, 'aEn', item.aEn, L.faqA);
      putTr(entry, 'qEs', item.qEs, L.faqQ);
      putTr(entry, 'aEs', item.aEs, L.faqA);
      return entry;
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
      const entry: StatEntry = { value, label };
      putTr(entry, 'valueEn', item.valueEn, L.statValue);
      putTr(entry, 'labelEn', item.labelEn, L.statLabel);
      putTr(entry, 'valueEs', item.valueEs, L.statValue);
      putTr(entry, 'labelEs', item.labelEs, L.statLabel);
      return entry;
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
      const entry: HistoryEntry = { year, text };
      putTr(entry, 'textEn', item.textEn, L.historyText);
      putTr(entry, 'textEs', item.textEs, L.historyText);
      return entry;
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

// ─── Локализация контента (i18n витрины) ─────────────────────────────────

// Суффиксы переводных полей. ru отсутствует: русский текст живёт в базовых
// полях, для него функция возвращает объект как есть.
const LOCALE_SUFFIX: Record<string, string> = {
  en: 'En',
  es: 'Es',
};

/**
 * Перевод строкового поля записи: непустой перевод → он; иначе базовое
 * (русское) значение. Записи списков типизированы интерфейсами — смотрим
 * через Record, чтобы читать поля с динамическим суффиксом.
 */
function trField(entry: object, base: string, suffix: string): string {
  const rec = entry as Record<string, unknown>;
  const translated = rec[`${base}${suffix}`];
  if (typeof translated === 'string' && translated.trim()) return translated;
  return typeof rec[base] === 'string' ? (rec[base] as string) : '';
}

/**
 * Локализованная копия контента сайта для витрины (/about, /contacts).
 * - ru → объект как есть (нулевые накладные расходы на русскую витрину);
 * - en/es → переводы полей-записей (магазины, FAQ, цифры, история)
 *   с ПОЭЛЕМЕНТНЫМ фолбэком на русский: нет перевода у одного поля —
 *   остальные записи переведены, это поле показывается по-русски.
 * Телефон/почта/мессенджеры/карта не переводятся (не зависят от языка).
 * Объект не мутируется: страницы получают поверхностную копию.
 */
export function localizedSiteContent(content: SiteContent, locale: string): SiteContent {
  if (!content || typeof content !== 'object') return content;
  const suffix = LOCALE_SUFFIX[locale];
  if (!suffix) return content;

  return {
    ...content,
    contacts: {
      ...content.contacts,
      stores: content.contacts.stores.map((store) => ({
        ...store,
        city: trField(store, 'city', suffix),
        badge: trField(store, 'badge', suffix),
        address: trField(store, 'address', suffix),
        hours: trField(store, 'hours', suffix),
      })),
      faq: content.contacts.faq.map((entry) => ({
        ...entry,
        q: trField(entry, 'q', suffix),
        a: trField(entry, 'a', suffix),
      })),
    },
    about: {
      ...content.about,
      stats: content.about.stats.map((stat) => ({
        ...stat,
        value: trField(stat, 'value', suffix),
        label: trField(stat, 'label', suffix),
      })),
      history: content.about.history.map((event) => ({
        ...event,
        text: trField(event, 'text', suffix),
      })),
    },
  };
}
