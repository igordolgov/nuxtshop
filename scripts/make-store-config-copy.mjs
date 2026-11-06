// scripts/make-store-config-copy.mjs
// Подменяет store.config.ts на КУБИНСКИЙ для сборки копии магазина
// (воркер nuxt-shop-cu, см. .github/workflows/deploy-copy.yml):
//   имя Tienda Habana, USD/$, дефолтная локаль es, оплата transfer/cash
//   (Transfermóvil / EnZona), порог/цены доставки в долларах.
// Файл меняется ТОЛЬКО в рабочей копии workflow (не коммитится) —
// прод собирается в ci.yml из репозитория с дефолтами (₽, ru, card/cash).
// Замены точечные, с проверкой уникальности (иначе ошибка — конфиг разъехался).
import { readFileSync, writeFileSync } from 'node:fs';

const REPLACES = [
  // ─── Идентичность ────────────────────────────────────────────────────
  ["export const STORE_NAME = 'Магазин';", "export const STORE_NAME = 'Tienda Habana';"],
  [
    "export const STORE_SITE_URL = 'https://nuxt-shop.igordolgov1972.workers.dev';",
    "export const STORE_SITE_URL = 'https://nuxt-shop-cu.igordolgov1972.workers.dev';",
  ],
  // ─── Локализация: дефолт es (es без префикса, ru/en с префиксами) ────
  [
    "export const STORE_DEFAULT_LOCALE: StoreLocale = 'ru';",
    "export const STORE_DEFAULT_LOCALE: StoreLocale = 'es';",
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
console.log('store.config.ts → копия: Tienda Habana, USD, es, transfer/cash, доставка 50/5/3');
