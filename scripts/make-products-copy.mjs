// scripts/make-products-copy.mjs
// Переписывает цены каталога в server/data/products.json на КУБИНСКИЕ
// (USD из server/data/products.cu-prices.json) — для сборки копии магазина
// (воркер nuxt-shop-cu, см. deploy-copy-in-ci.mjs). Файл меняется ТОЛЬКО
// в рабочей копии runner-а (не коммитится): прод собирается из репозитория
// с исходными ценами (₽).
//
// Вызывается из deploy-copy-in-ci.mjs ПЕРЕД `pnpm build` копии и вручную
// для локальной проверки копии (после проверки — `git checkout
// server/data/products.json`).
//
// Карта обязана покрывать ВСЕ товары сида (и наоборот, не содержать
// чужих id) — иначе ошибка: молчаливый пропуск оставил бы в копии
// рублёвую цену с символом $ (инвариант дублирует cu-prices.test.ts).
import { readFileSync, writeFileSync } from 'node:fs';

const SEED_FILE = 'server/data/products.json';
const MAP_FILE = 'server/data/products.cu-prices.json';

const seed = JSON.parse(readFileSync(SEED_FILE, 'utf8'));
const map = JSON.parse(readFileSync(MAP_FILE, 'utf8'));

const fail = (msg) => {
  console.error(`make-products-copy: ${msg}`);
  process.exit(1);
};

if (!Array.isArray(seed) || seed.length === 0) fail(`${SEED_FILE}: пустой или не массив`);
if (!map?.version || typeof map.version !== 'string') fail(`${MAP_FILE}: нет строки version`);
if (!map.prices || typeof map.prices !== 'object') fail(`${MAP_FILE}: нет карты prices`);

const errors = [];
const seedIds = new Set(seed.map((p) => String(p?.id)));

for (const p of seed) {
  const id = String(p?.id);
  const m = map.prices[id];
  if (!m || !Number.isFinite(Number(m.price)) || Number(m.price) <= 0) {
    errors.push(`${id} (${p?.slug}): нет цены в карте`);
    continue;
  }
  if (m.oldPrice !== undefined && !(Number(m.oldPrice) > Number(m.price))) {
    errors.push(`${id}: oldPrice (${m.oldPrice}) должен быть больше price (${m.price})`);
  }
  const variants = Array.isArray(p.variants) ? p.variants : [];
  if (variants.length > 0 && !m.variants) {
    errors.push(`${id}: у товара есть варианты, в карте — нет цен вариантов`);
  }
  for (const v of variants) {
    const vp = m.variants?.[v.id];
    if (!Number.isFinite(Number(vp)) || Number(vp) <= 0) {
      errors.push(`${id}: нет цены варианта ${v.id}`);
    }
  }
}

for (const id of Object.keys(map.prices)) {
  if (!seedIds.has(id)) errors.push(`${id}: id нет в ${SEED_FILE}`);
}

if (errors.length > 0) fail(`${errors.length} проблем:\n  - ${errors.join('\n  - ')}`);

// Применяем: цена/старая цена товара и цены вариантов. oldPrice без
// записи в карте снимается (в копии товар без скидки, а не с рублёвой).
let changed = 0;
for (const p of seed) {
  const m = map.prices[String(p.id)];
  if (p.price !== m.price || p.oldPrice !== m.oldPrice) changed++;
  p.price = m.price;
  if (m.oldPrice !== undefined) p.oldPrice = m.oldPrice;
  else if (p.oldPrice !== undefined) delete p.oldPrice;
  for (const v of p.variants ?? []) v.price = m.variants[v.id];
}

writeFileSync(SEED_FILE, `${JSON.stringify(seed, null, 2)}\n`);
console.log(
  `products.json → копия (USD, сид ${map.version}): цены обновлены у ${seed.length} товаров ` +
    `(${changed} с изменением суммы), скидки/варианты пересчитаны`,
);
