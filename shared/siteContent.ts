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
        cityEn: 'Moscow',
        cityEs: 'Moscú',
        badge: 'Флагман',
        badgeEn: 'Flagship store',
        badgeEs: 'Tienda insignia',
        address: 'ул. Тверская, 12',
        addressEn: '12 Tverskaya St.',
        addressEs: 'c/ Tverskaya, 12',
        hours: 'Ежедневно 10:00–21:00',
        hoursEn: 'Daily 10:00–21:00',
        hoursEs: 'Todos los días 10:00–21:00',
        phone: '8 (495) 555-35-35',
      },
      {
        city: 'Санкт-Петербург',
        cityEn: 'Saint Petersburg',
        cityEs: 'San Petersburgo',
        badge: 'Шоурум и пункт выдачи',
        badgeEn: 'Showroom & pickup point',
        badgeEs: 'Showroom y punto de recogida',
        address: 'Невский проспект, 45',
        addressEn: '45 Nevsky Prospekt',
        addressEs: 'prospekt Nevski, 45',
        hours: 'Ежедневно 10:00–21:00',
        hoursEn: 'Daily 10:00–21:00',
        hoursEs: 'Todos los días 10:00–21:00',
        phone: '8 (812) 555-35-35',
      },
      {
        city: 'Казань',
        cityEn: 'Kazan',
        cityEs: 'Kazán',
        badge: 'Пункт выдачи',
        badgeEn: 'Pickup point',
        badgeEs: 'Punto de recogida',
        address: 'ул. Баумана, 58',
        addressEn: '58 Bauman St.',
        addressEs: 'c/ Baumana, 58',
        hours: 'Ежедневно 10:00–20:00',
        hoursEn: 'Daily 10:00–20:00',
        hoursEs: 'Todos los días 10:00–20:00',
        phone: '8 (843) 555-35-35',
      },
    ],
    faq: [
      {
        q: 'Как быстро вы доставляете?',
        qEn: 'How fast do you deliver?',
        qEs: '¿Con qué rapidez entregan?',
        a: 'Заказы, оформленные до 18:00, отправляем в тот же день. По городу курьер приезжает на следующий день, в пункты выдачи заказ поступает за 1–2 дня. Точный срок и стоимость показываются при оформлении.',
        aEn: 'Orders placed before 6 PM ship the same day. In-city couriers arrive the next day; pickup points receive the order within 1–2 days. The exact timing and cost are shown at checkout.',
        aEs: 'Los pedidos hechos antes de las 18:00 se envían el mismo día. En la ciudad el mensajero llega al día siguiente; en los puntos de recogida el pedido entra en 1–2 días. El plazo y el coste exactos se muestran al finalizar la compra.',
      },
      {
        q: 'Как вернуть товар?',
        qEn: 'How do I return an item?',
        qEs: '¿Cómo devolver un producto?',
        a: 'В течение 14 дней после получения — при сохранении товарного вида и комплектации. Оформить возврат можно в любом нашем пункте выдачи или через форму на этой странице: привезём деньги обратно тем же способом, которым платили.',
        aEn: 'Within 14 days of delivery, keeping the original condition and complete set. You can arrange a return at any of our pickup points or via the form on this page: we send the money back the same way you paid.',
        aEs: 'Dentro de los 14 días tras la entrega, conservando el aspecto original y el conjunto completo. Puede tramitar la devolución en cualquiera de nuestros puntos de recogida o mediante el formulario de esta página: le devolvemos el dinero por la misma vía con la que pagó.',
      },
      {
        q: 'Какая гарантия на технику?',
        qEn: 'What is the warranty on devices?',
        qEs: '¿Qué garantía tienen los equipos?',
        a: 'Стандартная гарантия производителя плюс ещё один год от магазина — итого 2 года на всю технику в каталоге. Обращайтесь в любой пункт выдачи: мы сами свяжемся с сервисным центром и проконтролируем ремонт.',
        aEn: 'The standard manufacturer warranty plus one extra year from the store — 2 years in total for every device in the catalog. Visit any pickup point: we will contact the service center ourselves and supervise the repair.',
        aEs: 'La garantía estándar del fabricante más un año adicional de la tienda — 2 años en total para todos los equipos del catálogo. Acuda a cualquier punto de recogida: nosotros mismos contactaremos con el servicio técnico y supervisaremos la reparación.',
      },
      {
        q: 'Как можно оплатить заказ?',
        qEn: 'How can I pay for my order?',
        qEs: '¿Cómo puedo pagar el pedido?',
        a: 'Картой онлайн (защищённый платёж) или наличными/картой при получении. Для юридических лиц выставляем счёт — напишите в форме выше, выбрав тему «Сотрудничество».',
        aEn: 'Online by card (secure payment) or in cash/by card on delivery. For business customers we issue invoices — write via the form above and pick the “Partnership” topic.',
        aEs: 'Con tarjeta en línea (pago protegido) o en efectivo/tarjeta al recibir. Para empresas emitimos factura — escríbanos mediante el formulario de arriba, eligiendo el tema «Colaboración».',
      },
      {
        q: 'Можно ли посмотреть товар перед покупкой?',
        qEn: 'Can I see the product before buying?',
        qEs: '¿Se puede ver el producto antes de comprarlo?',
        a: 'Да, во всех наших магазинах-шоурумах. Адреса и часы работы — в разделе «Наши магазины» на этой странице. В Москве техника к протестированию доступна в полном объёме.',
        aEn: 'Yes, in all our showroom stores. Addresses and opening hours are in the “Our stores” section on this page. In Moscow the full demo range is available to test.',
        aEs: 'Sí, en todas nuestras tiendas showroom. Las direcciones y el horario están en la sección «Nuestras tiendas» de esta página. En Moscú la técnica está disponible para probar en su totalidad.',
      },
    ],
  },
  about: {
    stats: [
      {
        value: '8 лет',
        valueEn: '8 years',
        valueEs: '8 años',
        label: 'на рынке техники',
        labelEn: 'in the tech market',
        labelEs: 'en el mercado de tecnología',
      },
      {
        value: '12 000+',
        valueEn: '12,000+',
        valueEs: '12 000+',
        label: 'довольных клиентов',
        labelEn: 'happy customers',
        labelEs: 'clientes satisfechos',
      },
      {
        value: '30+',
        valueEn: '30+',
        valueEs: '30+',
        label: 'брендов в каталоге',
        labelEn: 'brands in the catalog',
        labelEs: 'marcas en el catálogo',
      },
      {
        value: '4',
        valueEn: '4',
        valueEs: '4',
        label: 'пункта выдачи',
        labelEn: 'pickup points',
        labelEs: 'puntos de recogida',
      },
    ],
    history: [
      {
        year: '2018',
        text: 'Открыли первый магазин техники с принципом «покажи и расскажи честно».',
        textEn: 'Opened our first electronics store built on the honest show-and-tell principle.',
        textEs:
          'Abrimos la primera tienda de tecnología con el principio de «mostrar y contar con honestidad».',
      },
      {
        year: '2020',
        text: 'Запустили интернет-магазин с доставкой по стране — покупки стали доступнее.',
        textEn:
          'Launched the online store with nationwide delivery — shopping became more accessible.',
        textEs:
          'Lanzamos la tienda online con entrega en todo el país — las compras se hicieron más accesibles.',
      },
      {
        year: '2023',
        text: 'Четыре пункта выдачи и собственная курьерская служба: доставка от одного дня.',
        textEn: 'Four pickup points and our own courier service: next-day delivery.',
        textEs: 'Cuatro puntos de recogida y servicio de mensajería propio: entrega desde un día.',
      },
      {
        year: '2026',
        text: 'Программа гарантии 2 года на всю технику и 12 000+ довольных клиентов.',
        textEn: 'The 2-year warranty program for all devices and 12,000+ happy customers.',
        textEs:
          'Programa de garantía de 2 años para todos los equipos y más de 12 000 clientes satisfechos.',
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
