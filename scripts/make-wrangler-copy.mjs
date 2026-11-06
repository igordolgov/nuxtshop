// scripts/make-wrangler-copy.mjs
// Генерирует wrangler.cu.jsonc — конфиг КОПИИ магазина (воркер nuxt-shop-cu):
// отдельное имя воркера, ОТДЕЛЬНЫЙ KV-namespace (данные копии не пересекаются
// с продом), siteUrl копии, без бикона CF Analytics.
// Запускается workflow .github/workflows/deploy-copy.yml ПОСЛЕ сборки;
// env KV_ID — id KV-namespace копии (создаётся/ищется шагом workflow).
// Исходник — wrangler.jsonc: правки точечными заменами с проверкой, что
// паттерн найден ровно один раз (иначе ошибка — конфиг разъехался).
import { readFileSync, writeFileSync } from 'node:fs';

const KV_ID = process.env.KV_ID;
if (!KV_ID) throw new Error('env KV_ID обязателен (id KV-namespace копии)');

let src = readFileSync('wrangler.jsonc', 'utf8');

const replaceOnce = (text, from, to) => {
  if (!text.includes(from)) {
    throw new Error(`wrangler.jsonc: паттерн не найден: ${JSON.stringify(from)}`);
  }
  if (text.split(from).length - 1 !== 1) {
    throw new Error(`wrangler.jsonc: паттерн неуникален: ${JSON.stringify(from)}`);
  }
  return text.replace(from, to);
};

src = replaceOnce(src, '"name": "nuxt-shop"', '"name": "nuxt-shop-cu"');
src = replaceOnce(src, '"id": "2882e3a4601940b881c2140f1401989f"', `"id": "${KV_ID}"`);
src = replaceOnce(
  src,
  '"NUXT_PUBLIC_SITE_URL": "https://nuxt-shop.igordolgov1972.workers.dev"',
  '"NUXT_PUBLIC_SITE_URL": "https://nuxt-shop-cu.igordolgov1972.workers.dev"',
);
src = replaceOnce(
  src,
  '"NUXT_PUBLIC_CF_BEACON_TOKEN": "1298daaa1bfd4c10b2354d053a3d2a85"',
  '"NUXT_PUBLIC_CF_BEACON_TOKEN": ""',
);

writeFileSync('wrangler.cu.jsonc', src);
console.log('wrangler.cu.jsonc создан: воркер nuxt-shop-cu, KV', KV_ID);
