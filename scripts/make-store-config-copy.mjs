// scripts/make-store-config-copy.mjs
// Подменяет store.config.ts на КУБИНСКИЙ для сборки копии магазина
// (воркер nuxt-shop-cu, см. .github/workflows/deploy-copy.yml):
//   имя Tienda Habana, USD/$, дефолтная локаль es, оплата transfer/cash
//   (Transfermóvil / EnZona), порог/цены доставки в долларах.
//   Русский УБРАН ЦЕЛИКОМ (отзыв: «уберем русский — друг не знает
//   русского»): локали витрины ['es','en'] — русский не регистрируется
//   в i18n (в переключателе языка на витрине его нет, /ru/** — 404,
//   hreflang ru исчезают из sitemap и <head>); вкладки админки
//   ['es','en'], базовый язык контента 'es'.
// Файл меняется ТОЛЬКО в рабочей копии workflow (не коммитится) —
// прод собирается в ci.yml из репозитория с дефолтами (₽, ru, card/cash).
// Замены точечные, с проверкой уникальности (иначе ошибка — конфиг разъехался).
import { readFileSync, writeFileSync } from 'node:fs';

const REPLACES = [
  // ─── Идентичность ────────────────────────────────────────────────────
  ["export const STORE_NAME = 'Магазин';", "export const STORE_NAME = 'Tienda Habana';"],
  [
    "export const STORE_TAGLINE = 'Интернет-магазин с оффлайн поддержкой';",
    "export const STORE_TAGLINE = 'Tienda online con soporte offline';",
  ],
  [
    "export const STORE_SITE_URL = 'https://nuxt-shop.igordolgov1972.workers.dev';",
    "export const STORE_SITE_URL = 'https://nuxt-shop-cu.igordolgov1972.workers.dev';",
  ],
  // ─── Локализация: локали витрины БЕЗ русского (es — дефолт, en — префикс;
  // русский не регистрируется в i18n: в переключателе языка витрины его
  // нет, /ru/** — 404, hreflang ru нет в sitemap и <head>) ────────────
  [
    "export const STORE_LOCALES: StoreLocale[] = ['ru', 'en', 'es'];",
    "export const STORE_LOCALES: StoreLocale[] = ['es', 'en'];",
  ],
  [
    "export const STORE_DEFAULT_LOCALE: StoreLocale = 'ru';",
    "export const STORE_DEFAULT_LOCALE: StoreLocale = 'es';",
  ],
  // ─── Админка: вкладки Español → English, русский убран ───────────────
  [
    "export const STORE_ADMIN_LANG_TABS: StoreLocale[] = ['ru', 'en', 'es'];",
    "export const STORE_ADMIN_LANG_TABS: StoreLocale[] = ['es', 'en'];",
  ],
  // ─── Базовый язык контента товара/новостей/контента — es ──────────────
  // (базовые поля записи набираются по-испански, обязательного русского
  // в формах админки копии нет)
  [
    "export const STORE_BASE_CONTENT_LOCALE: StoreLocale = 'ru';",
    "export const STORE_BASE_CONTENT_LOCALE: StoreLocale = 'es';",
  ],
  // ─── Валюта: USD ($ перед суммой, формат en-US — внутри formatMoney) ─
  [
    "export const STORE_CURRENCY: StoreCurrency = 'RUB';",
    "export const STORE_CURRENCY: StoreCurrency = 'USD';",
  ],
  // ─── Оплата: перевод (Transfermóvil / EnZona) + наличные ─────────────
  [
    "export const STORE_PAYMENT_METHODS: StorePaymentMethod[] = ['card', 'cash'];",
    "export const STORE_PAYMENT_METHODS: StorePaymentMethod[] = ['transfer', 'cash'];",
  ],
  // ─── Доставка: цифры копии в валюте STORE_CURRENCY (USD) ─────────────
  ['export const FREE_DELIVERY_FROM = 2000;', 'export const FREE_DELIVERY_FROM = 50;'],
  ['export const DELIVERY_PRICE_COURIER = 300;', 'export const DELIVERY_PRICE_COURIER = 5;'],
  ['export const DELIVERY_PRICE_POST = 200;', 'export const DELIVERY_PRICE_POST = 3;'],
  // ─── Эквивалент в CUP (курс elTOQUE): строка под ценой/итогом ──────
  // Секрет ELTOQUE_API_KEY ставится на воркер копии отдельно:
  //   npx wrangler secret put ELTOQUE_API_KEY --name nuxt-shop-cu
  ['export const SHOW_CUP_EQUIVALENT = false;', 'export const SHOW_CUP_EQUIVALENT = true;'],
  // ─── «О магазине»: цены витрины категорий в валюте копии (USD) ─────
  [
    'export const ABOUT_FROM_PRICES = [19990, 54990, 4990, 39990, 14990, 44990];',
    'export const ABOUT_FROM_PRICES = [199, 549, 49, 399, 149, 449];',
  ],
];

let src = readFileSync('store.config.ts', 'utf8');
for (const [from, to] of REPLACES) {
  const count = src.split(from).length - 1;
  if (count !== 1) {
    throw new Error(
      `store.config.ts: ожидалось ровно 1 вхождение, найдено ${count}: ${JSON.stringify(from)}`,
    );
  }
  src = src.replace(from, to);
}
writeFileSync('store.config.ts', src);
console.log(
  'store.config.ts → копия: Tienda Habana, USD, локали es/en (без русского), transfer/cash, доставка 50/5/3',
);
