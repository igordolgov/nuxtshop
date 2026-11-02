// server/lib/newsHelpers.ts
// Новости магазина: KV-хранилище + сид + валидация.
// Зеркало паттерна productHelpers: live-данные в KV `data:news`,
// при пустом KV — самоисцеление записью сида (best-effort: сбой записи
// не ломает выдачу — страница новостей не должна 500-ить из-за лимитов).
import type { H3Event } from 'h3';
import { kvGetJSON, kvPutJSON } from './storage';
import type { Product } from './productHelpers';

export const NEWS_KEY = 'data:news';

/** Рубрики — единый список для API, админки и витрины. */
export const NEWS_CATEGORIES = ['Акции', 'Новинки', 'Компания', 'Обзоры'] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export interface NewsItem {
  id: string;
  /** ISO-дата YYYY-MM-DD (input type=date); на витрине форматируется. */
  date: string;
  category: NewsCategory;
  title: string;
  excerpt: string;
  /** Абзацы полного текста (пустые не хранятся). */
  body: string[];
  /** Путь ('/…'), data-URI или внешний URL; '' — плитка без фото. */
  image: string;
  /**
   * Товары из новости (перелинковка с каталогом): id из data:products,
   * порядок = порядок показа. Необязательно; несуществующие id при
   * показе просто пропускаются (товар мог быть удалён).
   */
  productIds?: string[];
  /**
   * Опубликовано? false — черновик: виден только в админке, на витрине
   * фильтруется (publishedNews). undefined — опубликовано (обратная
   * совместимость со старыми записями и сидом).
   */
  published?: boolean;
  // ── Переводы (i18n): контрак как у товаров — базовые поля хранят
  // русский текст, переводы необязательны; нет перевода → витрина
  // показывает русский (фолбэк). Миграция KV не требуется.
  titleEn?: string;
  titleEs?: string;
  excerptEn?: string;
  excerptEs?: string;
  /** Перевод полного текста: список абзацев ЦЕЛИКОМ замещает body. */
  bodyEn?: string[];
  bodyEs?: string[];
  updatedAt: string;
}

/** Максимум товаров в одной новости — от переполненных payload и UI. */
export const MAX_NEWS_PRODUCTS = 6;

/** Мини-карточка товара для витрины новости (джойн на GET /api/news). */
export interface NewsProductCard {
  id: string;
  slug: string;
  name: string;
  /** Переводы названия — витрина локализует карточку по локали URL. */
  nameEn?: string;
  nameEs?: string;
  price: number;
  image: string;
  inStock: boolean;
}

// ─── Сид: те же 9 новостей, что были статикой на витрине ────────────────
// Дата — ISO; витрина форматирует по-русски (без toLocaleDateString —
// одинаково на сервере и клиенте).
export const newsSeed: NewsItem[] = [
  {
    id: '1',
    date: '2026-10-28',
    category: 'Акции',
    title: 'Осенняя распродажа: до −25% на смартфоны и ноутбуки',
    titleEn: 'Autumn sale: up to −25% on smartphones and laptops',
    titleEs: 'Rebajas de otoño: hasta −25 % en smartphones y portátiles',
    excerpt: 'Неделя скидок на самые востребованные категории: смартфоны, ноутбуки и аксессуары.',
    excerptEn:
      'A week of discounts on the most wanted categories: smartphones, laptops and accessories.',
    excerptEs:
      'Una semana de descuentos en las categorías más demandadas: smartphones, portátiles y accesorios.',
    body: [
      'С 28 октября по 5 ноября действует осенняя распродажа: скидки до 25% на смартфоны Samsung Galaxy, ноутбуки Apple MacBook и популярные аксессуары. Количество товаров по акционным ценам ограничено.',
      'Скидка применяется в корзине автоматически — промокоды не нужны. Для участников программы лояльности акционные цены суммируются с бонусными баллами.',
      'Подборка акционных товаров собрана на главной странице каталога.',
    ],
    bodyEn: [
      'From October 28 to November 5, the autumn sale is on: up to 25% off Samsung Galaxy smartphones, Apple MacBook laptops and popular accessories. Items at sale prices are limited.',
      'The discount is applied in the cart automatically — no promo codes needed. Loyalty members can combine sale prices with bonus points.',
      'The sale picks are collected on the main catalog page.',
    ],
    bodyEs: [
      'Del 28 de octubre al 5 de noviembre están abiertas las rebajas de otoño: hasta un 25 % de descuento en smartphones Samsung Galaxy, portátiles Apple MacBook y accesorios populares. Las unidades a precio rebajado son limitadas.',
      'El descuento se aplica en el carrito automáticamente — no hacen falta cupones. Los miembros del programa de fidelidad pueden combinar los precios rebajados con puntos de bonificación.',
      'La selección de productos en rebaja está reunida en la página principal del catálogo.',
    ],
    image: '/images/products/photo-1511707171634-5f897ff02aa9.webp',
    // Смартфоны/ноутбуки/планшет — суть акции (id из data:products)
    productIds: ['1', '2', '28'],
    updatedAt: '2026-10-28T09:00:00.000Z',
  },
  {
    id: '2',
    date: '2026-10-21',
    category: 'Новинки',
    title: 'PlayStation 5 Slim в наличии: комплект с двумя геймпадами',
    titleEn: 'PlayStation 5 Slim in stock: bundle with two controllers',
    titleEs: 'PlayStation 5 Slim disponible: pack con dos mandos',
    excerpt: 'Ожидаемая консоль добралась до склада — комплект с двумя DualSense уже в каталоге.',
    excerptEn:
      'The long-awaited console has arrived — the bundle with two DualSense pads is already in the catalog.',
    excerptEs: 'La consola más esperada ya llegó — el pack con dos DualSense está en el catálogo.',
    body: [
      'В продажу поступила PlayStation 5 Slim в комплекте с двумя беспроводными геймпадами DualSense. Консоль на 30% компактнее предыдущей версии и оснащена SSD на 1 ТБ.',
      'Отдельно отметим: комплект дешевле, чем консоль и второй геймпад по отдельности. Количество ограничено — успейте оформить заказ с доставкой на ближайший день.',
    ],
    bodyEn: [
      'The PlayStation 5 Slim bundle with two wireless DualSense controllers is now on sale. The console is 30% more compact than the previous version and features a 1 TB SSD.',
      'Worth noting: the bundle is cheaper than the console and a second controller bought separately. Quantities are limited — order today for next-day delivery.',
    ],
    bodyEs: [
      'Ya está a la venta la PlayStation 5 Slim en pack con dos mandos inalámbricos DualSense. La consola es un 30 % más compacta que la versión anterior y equipa un SSD de 1 TB.',
      'Un detalle importante: el pack sale más barato que la consola y un segundo mando por separado. Las unidades son limitadas — haz tu pedido con entrega para el día más próximo.',
    ],
    image: '/images/products/photo-1606813907291-d86efa9b94db.webp',
    // Консоли из новости: PS5 + Nintendo Switch
    productIds: ['6', '27'],
    updatedAt: '2026-10-21T09:00:00.000Z',
  },
  {
    id: '3',
    date: '2026-10-14',
    category: 'Компания',
    title: 'Новый пункт выдачи в центре: заберите заказ за 15 минут',
    titleEn: 'New pickup point downtown: collect your order in 15 minutes',
    titleEs: 'Nuevo punto de recogida en el centro: recoja su pedido en 15 minutos',
    excerpt: 'Третий пункт выдачи открылся в шаговой доступности от метро.',
    excerptEn: 'Our third pickup point opened within walking distance of the metro.',
    excerptEs: 'Abrimos el tercer punto de recogida, a un paso del metro.',
    body: [
      'Мы открыли третий пункт выдачи — теперь в центре города, в пяти минутах от метро. Заказы, оформленные до 18:00, будут ждать вас там уже на следующий день.',
      'В пункте выдачи можно проверить технику при получении, оформить возврат и получить консультацию. Адрес и часы работы — на странице «Контакты».',
    ],
    bodyEn: [
      'We opened our third pickup point — now in the city center, five minutes from the metro. Orders placed before 6 PM will be waiting there the next day.',
      'At the pickup point you can inspect your purchase on collection, arrange a return and get advice. Address and opening hours are on the Contacts page.',
    ],
    bodyEs: [
      'Hemos abierto el tercer punto de recogida — ahora en el centro de la ciudad, a cinco minutos del metro. Los pedidos hechos antes de las 18:00 le estarán esperando allí al día siguiente.',
      'En el punto de recogida puede revisar el equipo al recibirlo, tramitar una devolución y recibir asesoría. La dirección y el horario están en la página «Contactos».',
    ],
    image: '/images/products/news-pickup.webp',
    // Пункт выдачи: стеллажи-постаматы (Pexels #32952173)
    updatedAt: '2026-10-14T09:00:00.000Z',
  },
  {
    id: '4',
    date: '2026-09-30',
    category: 'Обзоры',
    title: 'Sony WH-1000XM4: почему их берут для перелётов',
    titleEn: 'Sony WH-1000XM4: why travelers keep choosing them',
    titleEs: 'Sony WH-1000XM4: por qué son los favoritos para volar',
    excerpt: 'Разбираем флагманские наушники: шумоподавление, автономность и комфорт.',
    excerptEn:
      'A closer look at the flagship headphones: noise cancelling, battery life and comfort.',
    excerptEs: 'Analizamos los auriculares insignia: cancelación de ruido, autonomía y confort.',
    body: [
      'WH-1000XM4 — те самые наушники, которые чаще всего советуют частым путешественникам. Активное шумоподавление глушит гул самолёта почти полностью, а 30 часов автономности хватает на дальний перелёт и обратно.',
      'Из приятного: сенсорное управление, одновременное подключение к двум устройствам и быстрая зарядка — 10 минут на зарядке дают 5 часов воспроизведения.',
      'Полные характеристики и цены — в карточке товара в каталоге.',
    ],
    bodyEn: [
      'The WH-1000XM4 are the headphones most often recommended to frequent travelers. Active noise cancelling almost completely mutes the drone of the plane, and 30 hours of battery life cover a long-haul flight and back.',
      'Also nice: touch controls, pairing with two devices at once and fast charging — 10 minutes gives you 5 hours of playback.',
      'Full specs and prices are on the product page in the catalog.',
    ],
    bodyEs: [
      'Los WH-1000XM4 son los auriculares que más se recomiendan a quienes vuelan a menudo. La cancelación activa de ruido apaga casi por completo el rumor del avión, y sus 30 horas de autonomía bastan para un vuelo largo y el regreso.',
      'Lo mejor: control táctil, conexión simultánea a dos dispositivos y carga rápida — 10 minutos de carga dan 5 horas de reproducción.',
      'Las especificaciones completas y los precios están en la ficha del producto del catálogo.',
    ],
    image: '/images/products/photo-1505740420928-5e560c06d30e.webp',
    // Герой обзора + альтернатива из той же категории
    productIds: ['3', '25'],
    updatedAt: '2026-09-30T09:00:00.000Z',
  },
  {
    id: '5',
    date: '2026-09-18',
    category: 'Акции',
    title: 'Учебный сезон: скидки до −20% на ноутбуки',
    titleEn: 'Back to school: up to −20% off laptops',
    titleEs: 'Temporada de estudio: descuentos de hasta −20 % en portátiles',
    excerpt: 'Подбираем машину для учёбы и работы: от лёгких моделей до мощных станций.',
    excerptEn: 'Picking a machine for study and work: from light models to powerful stations.',
    excerptEs:
      'Elegimos equipo para estudiar y trabajar: de modelos ligeros a estaciones potentes.',
    body: [
      'До конца сентября — скидки до 20% на ноутбуки для учёбы и удалённой работы. В подборке — от лёгких моделей для учёбы до мощных станций для монтажа.',
      'Консультанты помогут выбрать конфигурацию под задачи и бюджет: напишите нам или приходите в шоурум.',
    ],
    bodyEn: [
      'Until the end of September — up to 20% off laptops for study and remote work. The selection ranges from light study models to powerful stations for video editing.',
      'Our consultants will help you pick a configuration for your tasks and budget: message us or visit our showroom.',
    ],
    bodyEs: [
      'Hasta finales de septiembre — hasta un 20 % de descuento en portátiles para estudiar y teletrabajar. En la selección hay desde modelos ligeros para estudiar hasta estaciones potentes para montaje de vídeo.',
      'Nuestros consultores le ayudarán a elegir la configuración según sus tareas y presupuesto: escríbanos o visite nuestro showroom.',
    ],
    image: '/images/products/photo-1541807084-5c52b6b3adef.webp',
    // Ноутбук для учёбы + монитор и внешнее хранилище к нему
    productIds: ['2', '19', '20'],
    updatedAt: '2026-09-18T09:00:00.000Z',
  },
  {
    id: '6',
    date: '2026-09-05',
    category: 'Компания',
    title: 'Гарантия 2 года на всю технику — теперь официально',
    titleEn: '2-year warranty on all devices — now official',
    titleEs: 'Garantía de 2 años en todos los equipos — ahora oficialmente',
    excerpt: 'Расширяем стандартную гарантию производителя — за наш счёт.',
    excerptEn: 'We extend the standard manufacturer warranty — at our expense.',
    excerptEs: 'Ampliamos la garantía estándar del fabricante — por nuestra cuenta.',
    body: [
      'С сентября мы добавляем к стандартной гарантии производителей ещё один год — теперь на всю технику в каталоге действует гарантия 2 года.',
      'Всё просто: не нужно доплачивать за расширенный сервис. Обращаетесь в любой наш пункт выдачи, а мы сами свяжемся с сервисным центром и проконтролируем ремонт.',
    ],
    bodyEn: [
      'Starting September we add one more year on top of the standard manufacturer warranty — now every device in the catalog comes with a 2-year warranty.',
      'It is simple: no extra payments for extended service. Visit any of our pickup points and we will contact the service center ourselves and supervise the repair.',
    ],
    bodyEs: [
      'Desde septiembre añadimos un año más a la garantía estándar del fabricante — ahora todos los equipos del catálogo tienen garantía de 2 años.',
      'Todo es sencillo: no hay que pagar de más por el servicio ampliado. Acuda a cualquiera de nuestros puntos de recogida: nosotros mismos contactaremos con el servicio técnico y supervisaremos la reparación.',
    ],
    // Гарантия/сервис: пайка платы, мастерская (Pexels #33388388)
    image: '/images/products/news-warranty.webp',
    updatedAt: '2026-09-05T09:00:00.000Z',
  },
  {
    id: '7',
    date: '2026-08-22',
    category: 'Новинки',
    title: 'Apple Watch Series 9: все цвета в наличии',
    titleEn: 'Apple Watch Series 9: all colors back in stock',
    titleEs: 'Apple Watch Series 9: todos los colores disponibles',
    excerpt: 'Популярную модель снова можно забрать в день заказа.',
    excerptEn: 'The popular model is again available for same-day pickup.',
    excerptEs: 'El modelo popular vuelve a estar disponible para recoger el mismo día.',
    body: [
      'Пополнен запас Apple Watch Series 9: в наличии все расцветки корпуса и ремешков. Как и раньше, часы можно примерить в шоуруме перед покупкой.',
      'Напоминаем: на часы действует программа гарантии 2 года, а при получении поможем с первичной настройкой.',
    ],
    bodyEn: [
      'Apple Watch Series 9 stock is replenished: all case and band colors are available. As before, you can try the watch on in our showroom before buying.',
      'Reminder: the watch is covered by our 2-year warranty program, and at pickup we will help with the initial setup.',
    ],
    bodyEs: [
      'Se ha repuesto el stock de Apple Watch Series 9: disponibles todos los colores de caja y correa. Como antes, puede probarse el reloj en el showroom antes de comprarlo.',
      'Recordatorio: el reloj está cubierto por el programa de garantía de 2 años y, al recogerlo, le ayudaremos con la configuración inicial.',
    ],
    image: '/images/products/photo-1544117519-31a4b719223d.webp',
    // Часы из новости + альтернативы в тех же категориях
    productIds: ['5', '26', '16'],
    updatedAt: '2026-08-22T09:00:00.000Z',
  },
  {
    id: '8',
    date: '2026-08-10',
    category: 'Обзоры',
    title: 'Canon EOS R6 для начинающих: с чего начать',
    titleEn: 'Canon EOS R6 for beginners: where to start',
    titleEs: 'Canon EOS R6 para principiantes: por dónde empezar',
    excerpt: 'Первая беззеркалка без страха: режимы, объективы и первые кадры.',
    excerptEn: 'A first mirrorless camera without the fear: modes, lenses and first shots.',
    excerptEs: 'La primera cámara sin espejo sin miedo: modos, objetivos y primeras tomas.',
    body: [
      'EOS R6 часто становится первой «серьёзной» камерой. Рассказываем, с каких режимов начать, какой объектив взять первым делом и почему автофокус этой камеры прощает новичку почти всё.',
      'Камеру можно потрогать и протестировать в шоуруме — приносите свою карту памяти.',
    ],
    bodyEn: [
      'The EOS R6 often becomes a photographer’s first “serious” camera. We explain which modes to start with, which lens to pick first and why this camera’s autofocus forgives a beginner almost everything.',
      'You can try the camera in our showroom — bring your own memory card.',
    ],
    bodyEs: [
      'La EOS R6 suele ser la primera cámara «seria» de quien se inicia en la fotografía. Contamos con qué modos empezar, qué objetivo elegir primero y por qué el autofoco de esta cámara perdona casi todo al principiante.',
      'Puede probar la cámara en nuestro showroom — traiga su propia tarjeta de memoria.',
    ],
    image: '/images/products/photo-1502920917128-1aa500764cbd.webp',
    // Камера из обзора
    productIds: ['4'],
    updatedAt: '2026-08-10T09:00:00.000Z',
  },
  {
    id: '9',
    date: '2026-07-28',
    category: 'Компания',
    title: 'Итоги июля: 1 200 заказов и доставка за 1,5 дня',
    titleEn: 'July in review: 1,200 orders and 1.5-day delivery',
    titleEs: 'Balance de julio: 1 200 pedidos y entrega en 1,5 días',
    excerpt: 'Спасибо каждому покупателю: делимся цифрами месяца.',
    excerptEn: 'Thank you to every customer — sharing the numbers of the month.',
    excerptEs: 'Gracias a cada comprador: compartimos las cifras del mes.',
    body: [
      'Июль стал рекордным: 1 200 заказов, средний срок доставки — 1,5 дня, 98% заказов доставлены в срок.',
      'Спасибо, что выбираете нас. В августе ускорим обработку заказов и добавим новые пункты выдачи — следите за новостями.',
    ],
    bodyEn: [
      'July set a record: 1,200 orders, average delivery time of 1.5 days, and 98% of orders delivered on time.',
      'Thank you for choosing us. In August we will speed up order processing and open new pickup points — stay tuned.',
    ],
    bodyEs: [
      'Julio fue récord: 1 200 pedidos, plazo medio de entrega de 1,5 días y el 98 % de los pedidos entregados a tiempo.',
      'Gracias por elegirnos. En agosto aceleraremos el procesamiento de pedidos y abriremos nuevos puntos de recogida — estén atentos.',
    ],
    // Итоги месяца: коробки в пункте отправления (Pexels #4440800)
    image: '/images/products/news-delivery.webp',
    updatedAt: '2026-07-28T09:00:00.000Z',
  },
];

// ─── Чтение / запись ─────────────────────────────────────────────────────

/**
 * Читает новости из KV; при пустом хранилище отдаёт сид и пытается
 * записать его в KV (best-effort — сбой записи не роняет выдачу).
 * Для уже хранящихся записей — разовая досадка переводов из сида
 * (см. mergeSeedTranslations): live-KV мог быть записан до появления
 * i18n-полей, и без досадки /en и /es показывали русский фолбэк.
 */
export async function readNews(event: H3Event): Promise<NewsItem[]> {
  const stored = await kvGetJSON<NewsItem[]>(event, NEWS_KEY);
  if (!Array.isArray(stored)) {
    const seed = newsSeed.map((n) => structuredClone(n));
    try {
      await kvPutJSON(event, NEWS_KEY, seed);
    } catch (e) {
      console.warn('news: не удалось записать сид в KV (отдаю сид без записи)', e);
    }
    return seed;
  }
  // Досадка переводов: идемпотентно — после записи в KV changed=false,
  // лишних записей в KV нет (лимит free-тарифа). best-effort: сбой записи
  // не роняет выдачу — отдаём досаженный массив без сохранения.
  const { items, changed } = mergeSeedTranslations(stored);
  if (!changed) return stored;
  try {
    await kvPutJSON(event, NEWS_KEY, items);
  } catch (e) {
    console.warn('news: не удалось записать переводы сида в KV (отдаю без записи)', e);
  }
  return items;
}

/** Единственная точка записи: массив ЦЕЛИКОМ в KV (валидация типа). */
export async function writeNews(event: H3Event, items: NewsItem[]): Promise<void> {
  if (!Array.isArray(items)) throw new Error('News must be an array');
  await kvPutJSON(event, NEWS_KEY, items);
}

/** Поля переводов, досаживаемые из сида. */
const SEED_TRANSLATION_FIELDS = [
  'titleEn', 'titleEs', 'excerptEn', 'excerptEs', 'bodyEn', 'bodyEs',
] as const;

/**
 * Чистая: досадка переводов из сида в id-совпадающие live-записи.
 *
 * Зачем: сид перезаписывает KV только при ПУСТОМ хранилище, поэтому
 * новости, записанные в KV до появления i18n-полей, остались без
 * titleEn/titleEs/… — витрина /en и /es показывала русский фолбэк.
 *
 * Правила безопасности:
 *  - русский текст live-записи (title/excerpt/body) должен совпадать
 *    с сидом дословно: отредактированные админом новости НЕ трогаем
 *    (переводы из сида могли бы разойтись с новым текстом);
 *  - уже заполненные переводные поля НЕ перезаписываются;
 *  - записи без сид-аналога не изменяются; вход не мутируется.
 *
 * Возвращает новый массив и флаг changed (для best-effort записи).
 */
export function mergeSeedTranslations(
  stored: NewsItem[],
): { items: NewsItem[]; changed: boolean } {
  if (!Array.isArray(stored)) return { items: [], changed: false };
  let changed = false;
  const items = stored.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const seed = newsSeed.find((n) => n.id === item.id);
    if (!seed) return item;
    // Защита правок админа: русский текст должен совпадать с сидом дословно
    const baseMatchesSeed =
      item.title === seed.title &&
      item.excerpt === seed.excerpt &&
      JSON.stringify(item.body) === JSON.stringify(seed.body);
    if (!baseMatchesSeed) return item;
    const patch: Partial<Pick<NewsItem, (typeof SEED_TRANSLATION_FIELDS)[number]>> = {};
    for (const field of SEED_TRANSLATION_FIELDS) {
      if (item[field] === undefined && seed[field] !== undefined) {
        patch[field] = structuredClone(seed[field]);
      }
    }
    if (Object.keys(patch).length === 0) return item;
    changed = true;
    return { ...item, ...patch };
  });
  return { items, changed };
}

// ─── Валидация / нормализация (чистые функции — покрыты тестами) ─────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PARAGRAPHS = 20;
const MAX_PARAGRAPH_LEN = 2000;

export class NewsValidationError extends Error {}

/**
 * Список id товаров из новости: строки, тримминг, без пустых и дублей,
 * не больше MAX_NEWS_PRODUCTS. Мягкая нормализация (без ошибок):
 * несуществующие id безвредны — при показе просто не джойнятся.
 */
export function normalizeNewsProductIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const raw of input) {
    const id = typeof raw === 'string' ? raw.trim() : String(raw ?? '').trim();
    if (id && !out.includes(id)) out.push(id);
    if (out.length >= MAX_NEWS_PRODUCTS) break;
  }
  return out;
}

/**
 * Тело новости: строка (переносы строк = абзацы) или массив строк.
 * Тримминг, пустые отбрасываются, лимиты на количество и длину.
 */
export function normalizeNewsBody(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input.map(String)
    : typeof input === 'string'
      ? input.split(/\r?\n/)
      : [];

  const paras = raw
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .slice(0, MAX_PARAGRAPHS);

  if (paras.length === 0) {
    throw new NewsValidationError('Добавьте хотя бы один абзац полного текста');
  }
  for (const p of paras) {
    if (p.length > MAX_PARAGRAPH_LEN) {
      throw new NewsValidationError(`Абзац длиннее ${MAX_PARAGRAPH_LEN} символов — разбейте его`);
    }
  }
  return paras;
}

// ── Переводы новости (titleEn/…/bodyEs): контракт как у товаров ──────────
//
// PUT получает форму ЦЕЛИКОМ (админка шлёт все три вкладки), поэтому
// семантика простая: пусто/пробелы → перевод УДАЛЯЕТСЯ из записи (фолбэк
// на русский), непустая строка → trim + лимит базового поля.
//
// sanitizeNewsItem возвращает переводы со значением string | string[] | null,
// где null = «удалить поле». Применяет их к записи applySanitizedNews —
// endpoints (POST/PUT) работают только через неё.

export type NewsTranslations = {
  titleEn: string | null;
  titleEs: string | null;
  excerptEn: string | null;
  excerptEs: string | null;
  bodyEn: string[] | null;
  bodyEs: string[] | null;
};

/** Результат sanitizeNewsItem: базовые поля + переводы (null = удалить). */
export type SanitizedNewsData = Omit<NewsItem, 'id'> & NewsTranslations;

const LOCALIZED_TEXT_FIELDS = ['titleEn', 'titleEs', 'excerptEn', 'excerptEs'] as const;
const LOCALIZED_TEXT_LIMITS: Record<(typeof LOCALIZED_TEXT_FIELDS)[number], number> = {
  titleEn: 120,
  titleEs: 120,
  excerptEn: 220,
  excerptEs: 220,
};

/** Перевод-строка: trim; пусто → null (удалить перевода). */
function localizedTextOrNull(
  raw: unknown,
  field: (typeof LOCALIZED_TEXT_FIELDS)[number],
): string | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, LOCALIZED_TEXT_LIMITS[field]);
}

/**
 * Перевод полного текста: строка (переносы = абзацы) или массив строк.
 * В отличие от обязательного body перевод опционален: пустой → null
 * (фолбэк на русский), без броска ошибки. Лимиты те же, что у body.
 */
function localizedBodyOrNull(input: unknown): string[] | null {
  const raw = Array.isArray(input)
    ? input.map(String)
    : typeof input === 'string'
      ? input.split(/\r?\n/)
      : [];
  const paras = raw
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .slice(0, MAX_PARAGRAPHS);
  if (paras.length === 0) return null;
  for (const p of paras) {
    if (p.length > MAX_PARAGRAPH_LEN) {
      throw new NewsValidationError(
        `Абзац перевода длиннее ${MAX_PARAGRAPH_LEN} символов — разбейте его`,
      );
    }
  }
  return paras;
}

/**
 * Применяет sanitize-результат к записи (мутирует item и возвращает его):
 * базовые поля присваиваются, переводы — null → поле удаляется из записи,
 * строка/массив → присваивается. Единственная точка правки записи из
 * payload — POST и PUT /api/news работают только через неё.
 */
export function applySanitizedNews(item: NewsItem, data: SanitizedNewsData): NewsItem {
  const { titleEn, titleEs, excerptEn, excerptEs, bodyEn, bodyEs, ...base } = data;
  Object.assign(item, base);
  const target = item as unknown as Record<string, unknown>;
  for (const [field, value] of Object.entries({
    titleEn,
    titleEs,
    excerptEn,
    excerptEs,
    bodyEn,
    bodyEs,
  })) {
    if (value === null) delete target[field];
    else target[field] = value;
  }
  return item;
}

/**
 * Приводит полезную нагрузку формы к NewsItem (плюс переводы; null =
 * «удалить перевод» — см. NewsTranslations). Кидает NewsValidationError
 * с сообщением на русском — endpoints отдают их как 400.
 */
export function sanitizeNewsItem(raw: Record<string, unknown>): SanitizedNewsData {
  const title = typeof raw?.title === 'string' ? raw.title.trim() : '';
  if (title.length < 5 || title.length > 120) {
    throw new NewsValidationError('Заголовок — от 5 до 120 символов');
  }

  const category = typeof raw?.category === 'string' ? raw.category.trim() : '';
  if (!NEWS_CATEGORIES.includes(category as NewsCategory)) {
    throw new NewsValidationError(`Рубрика должна быть одной из: ${NEWS_CATEGORIES.join(', ')}`);
  }

  const date = typeof raw?.date === 'string' ? raw.date.trim() : '';
  if (!ISO_DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
    throw new NewsValidationError('Дата обязательна в формате ГГГГ-ММ-ДД');
  }

  const excerpt = typeof raw?.excerpt === 'string' ? raw.excerpt.trim() : '';
  if (excerpt.length > 220) {
    throw new NewsValidationError('Краткое описание — не длиннее 220 символов');
  }

  const body = normalizeNewsBody(raw?.body);

  let image = typeof raw?.image === 'string' ? raw.image.trim() : '';
  if (image && !/^(\/|data:image\/|https?:\/\/)/.test(image)) {
    throw new NewsValidationError('Изображение: путь (/…), data-URI или http(s):// URL');
  }

  return {
    date,
    category: category as NewsCategory,
    title,
    excerpt,
    body,
    image,
    productIds: normalizeNewsProductIds(raw?.productIds),
    // Переводы: пусто/отсутствует → null (удалить/не ставить; фолбэк на ru).
    titleEn: localizedTextOrNull(raw?.titleEn, 'titleEn'),
    titleEs: localizedTextOrNull(raw?.titleEs, 'titleEs'),
    excerptEn: localizedTextOrNull(raw?.excerptEn, 'excerptEn'),
    excerptEs: localizedTextOrNull(raw?.excerptEs, 'excerptEs'),
    bodyEn: localizedBodyOrNull(raw?.bodyEn),
    bodyEs: localizedBodyOrNull(raw?.bodyEs),
    // Черновик: только явное false; отсутствие поля/любое другое — публикация
    published: raw?.published === false ? false : true,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Витринный фильтр: черновики (published === false) не показываются.
 * Старые записи и сид без поля — публикуются.
 */
export function publishedNews(items: NewsItem[]): NewsItem[] {
  return items.filter((n) => n && n.published !== false);
}

/** Свежие сверху; при равных датах — больший id (стабильно). */
export function sortNewsDesc(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    if (d !== 0) return d;
    return (Number(b.id) || 0) - (Number(a.id) || 0);
  });
}

/** Следующий свободный числовой id (как у товаров). */
export function nextNewsId(items: NewsItem[]): string {
  return items.length > 0 ? String(Math.max(...items.map((n) => Number(n.id) || 0)) + 1) : '1';
}

/** Новость с уже джойненными товарами (для витрины). */
export type NewsWithProducts = NewsItem & { products: NewsProductCard[] };

// ─── Автоподбор товаров по рубрике (пустой productIds → правило рубрики) ─
//
// Новости без ручного выбора не должны оставаться без перелинковки:
// витрина подбирает товары сама, по рубрике новости. Правила
// детерминированные (без Date.now/random — SSR-выдача и тесты стабильны)
// и опираются на реальные данные каталога. Ручной выбор в админке всегда
// приоритетнее — автоподбор только заполняет пробел.

const numericId = (p: Product): number => Number(p.id) || 0;

/**
 * Автоподбор товаров новости по её рубрике: возвращает id (до
 * MAX_NEWS_PRODUCTS) в порядке показа. Чистая функция — вход не мутируется
 * (фильтр копирует, сортируется копия), покрыта тестами.
 *
 * - Акции    → в наличии, от самого доступного по цене (выгодные предложения);
 * - Новинки  → свежие добавления каталога (больше числовой id — позже добавлен);
 * - Обзоры   → самые подробные карточки (больше фото в галерее);
 * - Компания → хиты склада (больше запас — активнее продвигаем);
 * - неизвестная рубрика → [] (секция на витрине просто не рендерится).
 */
export function autopickProductIds(category: string, products: Product[]): string[] {
  const pool = products.filter((p) => p && typeof p === 'object');
  let picked: Product[] = [];
  switch (category) {
    case 'Акции':
      picked = pool
        .filter((p) => p.inStock)
        .sort((a, b) => a.price - b.price || numericId(a) - numericId(b));
      break;
    case 'Новинки':
      picked = pool.sort((a, b) => numericId(b) - numericId(a));
      break;
    case 'Обзоры':
      picked = pool.sort(
        (a, b) =>
          (b.gallery?.length ?? 0) - (a.gallery?.length ?? 0) || numericId(b) - numericId(a),
      );
      break;
    case 'Компания':
      picked = pool.sort(
        (a, b) => (b.stockQuantity ?? 0) - (a.stockQuantity ?? 0) || numericId(a) - numericId(b),
      );
      break;
    default:
      picked = [];
  }
  return picked.slice(0, MAX_NEWS_PRODUCTS).map((p) => String(p.id));
}

/**
 * Перелинковка: к каждой новости — её товары из каталога. Порядок ручного
 * productIds сохраняется, несуществующие/удалённые id пропускаются; пустой
 * список → автоподбор по рубрике новости (autopickProductIds), секция на
 * витрине не пропадает. Чистая функция — покрыта тестами; на GET /api/news
 * джойнит readProducts.
 */
export function attachProducts(items: NewsItem[], products: Product[]): NewsWithProducts[] {
  const byId = new Map(products.map((p) => [String(p.id), p]));
  return items.map((item) => {
    // Ручной выбор приоритетен; пусто → автоподбор по рубрике.
    // В ответ отдаём только карточки: сохранённые productIds не подменяем.
    const ids = item.productIds?.length
      ? item.productIds
      : autopickProductIds(item.category, products);
    return {
      ...item,
      products: ids.flatMap((id) => {
        const p = byId.get(String(id));
        if (!p) return [];
        return [
          {
            id: String(p.id),
            slug: p.slug,
            name: p.name,
            // Переводы названия — для локализации мини-карточки на витрине
            // (localizedProduct на стороне клиента/SSR).
            ...(typeof p.nameEn === 'string' && p.nameEn.trim() ? { nameEn: p.nameEn } : {}),
            ...(typeof p.nameEs === 'string' && p.nameEs.trim() ? { nameEs: p.nameEs } : {}),
            price: p.price,
            image: p.image,
            inStock: Boolean(p.inStock),
          },
        ];
      }),
    };
  });
}
