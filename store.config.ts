// store.config.ts — конфигурация витрины: ОДНА кодовая база — разные магазины.
// Копия под другой магазин правит ТОЛЬКО значения ниже (+ тексты i18n/locales,
// seed-данные каталога, контакты в шапке/футере). Значения по умолчанию —
// российский магазин (₽, ru, карта/наличные); кубинская инсталляция: USD,
// defaultLocale 'es', paymentMethods ['transfer', 'cash'].
//
// Файл импортируется НАПРЯМУЮ клиентом (composables/utils), сервером
// (server/lib) и nuxt.config.ts — относительные пути, без алиасов:
// vitest-конфиг проекта не знает алиасов Nuxt, а nitro бандлит всё сам.

// ─── Идентичность магазина ──────────────────────────────────────────────
// PWA-манифест (nuxt.config) и apple-mobile-web-app-title.
export const STORE_NAME = 'Магазин';
// Подпись магазина для PWA-манифеста (description в manifest.webmanifest —
// видна в диалоге установки PWA). Страницы перекрывают head-мету из i18n
// (app.vue), а манифест собирается на билде — отсюда. ⚙️ Куба: на испанском.
export const STORE_TAGLINE = 'Интернет-магазин с оффлайн поддержкой';
// Канонический origin для hreflang/sitemap (i18n.baseUrl). ⚙️ Копия: заменить
// на домен своего воркера/кастомный домен.
export const STORE_SITE_URL = 'https://nuxt-shop.igordolgov1972.workers.dev';

// ─── Локализация ────────────────────────────────────────────────────────
export type StoreLocale = 'ru' | 'en' | 'es';
// Коды локалей витрины — ЕДИНЫЙ источник реестра языков: из них
// выводятся i18n.locales (nuxt.config), hreflang sitemap (seoHelpers)
// и префиксные routeRules. По умолчанию все три.
// ⚙️ Куба: ['es', 'en'] — русский УБРАН из витрины целиком (отзыв: «уберем
// русский из языков на главной странице — друг не знает русского»):
// не регистрируется в i18n → в переключателе языка витрины только
// Español/English, маршруты /ru/** отдают 404, hreflang ru нет ни в
// sitemap, ни в <head>.
export const STORE_LOCALES: StoreLocale[] = ['ru', 'en', 'es'];

// BCP-47 теги и человекочитаемые имена локалей: «паспорта» кодов из
// STORE_LOCALES (потребители — i18n.locales в nuxt.config). Ключи покрывают
// все значения StoreLocale — лишние на копии не мешают.
export const STORE_LOCALE_BCP47: Record<StoreLocale, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  es: 'es-ES',
};
export const STORE_LOCALE_NAMES: Record<StoreLocale, string> = {
  ru: 'Русский',
  en: 'English',
  es: 'Español',
};

// Язык без URL-префикса (strategy prefix_except_default). ⚙️ Куба: 'es'.
export const STORE_DEFAULT_LOCALE: StoreLocale = 'ru';

// Порядок языковых вкладок в админке (форма добавления/редактирования
// товара, новости, контент): язык базового контента — первым, чтобы
// основной текст набирался без лишнего клика. RU-магазин: ru → en → es.
// ⚙️ Куба: ['es', 'en'] — русский УБРАН (отзыв: «уберем русский из
// кубинской версии — друг не знает русского»); вкладка ru на копии
// не показывается вовсе.
export const STORE_ADMIN_LANG_TABS: StoreLocale[] = ['ru', 'en', 'es'];

// Язык БАЗОВОГО контента записи: базовые поля товара (name/description/
// характеристики/категории) и тексты сайта админ набирает на этом языке,
// вкладки остальных языков — необязательные переводы (пусто → витрина
// показывает базовое). Должен совпадать с первым элементом
// STORE_ADMIN_LANG_TABS. ⚙️ Куба: 'es' — базовые поля набираются
// по-испански, ничего обязательного на русском нет.
export const STORE_BASE_CONTENT_LOCALE: StoreLocale = 'ru';

// ─── Валюта ─────────────────────────────────────────────────────────────
export type StoreCurrency = 'RUB' | 'USD';
// Валюта витрины: цены в каталоге/заказах/промокодах безразмерные числа,
// символ и позицию берёт formatMoney отсюда. ⚙️ Куба: 'USD'.
export const STORE_CURRENCY: StoreCurrency = 'RUB';

// Символ валюты (экспорт: используется composables/utils напрямую)
export const CURRENCY_SYMBOL: Record<StoreCurrency, string> = { RUB: '₽', USD: '$' };
// ₽ — после суммы с пробелом («1 234 ₽»), $ — перед суммой («$1,234»)
export const CURRENCY_AFTER: Record<StoreCurrency, boolean> = { RUB: true, USD: false };
// Числовой формат: разряды/десятичные по конвенции каждой валюты
export const CURRENCY_NUMBER_LOCALE: Record<StoreCurrency, string> = {
  RUB: 'ru-RU',
  USD: 'en-US',
};

/** Символ активной (или указанной) валюты: '₽' / '$'. */
export const currencySymbol = (currency: StoreCurrency = STORE_CURRENCY): string =>
  CURRENCY_SYMBOL[currency] ?? String(currency);

/**
 * Число + валюта одной строкой: '1 234 ₽' (RUB) / '$1,234' (USD).
 * Единый форматтер вывода цен — в шаблонах НЕ клеить символ руками
 * (после аудита F13 «₽ ₽» символ живёт только здесь).
 */
export const formatMoney = (price: number, currency: StoreCurrency = STORE_CURRENCY): string => {
  const n = new Intl.NumberFormat(CURRENCY_NUMBER_LOCALE[currency] ?? 'ru-RU').format(
    Number(price) || 0,
  );
  const s = currencySymbol(currency);
  return CURRENCY_AFTER[currency] ? `${n} ${s}` : `${s}${n}`;
};

// ─── Способы оплаты ─────────────────────────────────────────────────────
// card — карта при подтверждении (визуальная заглушка, PCI-безопасно),
// cash — наличными при получении,
// transfer — перевод по QR после подтверждения (Куба: Transfermóvil / EnZona).
// Список = то, что видит покупатель в чекауте И что валидирует сервер.
// ⚙️ Куба: ['transfer', 'cash'].
export type StorePaymentMethod = 'card' | 'cash' | 'transfer';
export const STORE_PAYMENT_METHODS: StorePaymentMethod[] = ['card', 'cash'];

// ─── Доставка ───────────────────────────────────────────────────────────
// Единый источник правил (раньше дублировались в app/utils/deliveryPrice.ts
// и server/lib/orderHelpers.ts и расходились). Курьер — бесплатно от порога,
// почта — всегда платно, самовывоз — 0. ⚙️ Куба: цифры свои, в валюте
// STORE_CURRENCY (символ в цифры НЕ входит — выводит formatMoney).
export const FREE_DELIVERY_FROM = 2000;
export const DELIVERY_PRICE_COURIER = 300;
export const DELIVERY_PRICE_POST = 200;

// ─── «О магазине»: витрина категорий ─────────────────────────────────────
// Подписи «от X» у плиток категорий на /about — демо-цифры в валюте
// STORE_CURRENCY (символ добавляет formatMoney, в цифры он не входит).
// Порядок: телефоны, ноутбуки, аудио, фототехника, часы, консоли.
// ⚙️ Куба: свои цифры в USD.
export const ABOUT_FROM_PRICES = [19990, 54990, 4990, 39990, 14990, 44990];
