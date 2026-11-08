// scripts/deploy-copy-in-ci.mjs
// Деплой КОПИИ магазина (воркер nuxt-shop-cu + ОТДЕЛЬНЫЙ KV-namespace
// nuxtshop-cu) из CI — вызывается из package.json → deploy СРАЗУ ПОСЛЕ
// прод-деплоя: в job 'deploy' (ci.yml) в env есть CLOUDFLARE_API_TOKEN /
// CLOUDFLARE_ACCOUNT_ID. Локально (без CF-токена в env) шаг пропускается —
// деплой остаётся прерогативой CI.
//
// Копия отличается от прода ТОЛЬКО store.config.ts (кубинский: Tienda
// Habana, USD, es, transfer/cash — подменяется в рабочей копии runner-а,
// НЕ коммитится), ценами каталога (USD из server/data/products.cu-prices.json
// — переписываются в рабочей копии runner-а, НЕ коммитятся) и
// wrangler.cu.jsonc (имя воркера, свой KV, siteUrl копии).
// Прод-воркер nuxt-shop, его KV и секреты не затрагиваются.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });

const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !accountId) {
  console.log(
    'CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID не заданы — деплой копии пропущен (локальный режим).',
  );
  process.exit(0);
}

const api = (path, init) =>
  fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

// 1. KV-namespace копии: найти или создать (идемпотентно на каждый деплой)
let kvId = '';
const listJson = await (await api('?per_page=100')).json();
if (listJson.success) {
  const ns = (listJson.result || []).find((n) => n.title === 'nuxtshop-cu');
  if (ns) kvId = ns.id;
}
if (!kvId) {
  const createdJson = await (
    await api('', { method: 'POST', body: JSON.stringify({ title: 'nuxtshop-cu' }) })
  ).json();
  if (!createdJson.success || !createdJson.result?.id) {
    console.error(
      'Не удалось создать KV-namespace nuxtshop-cu:',
      JSON.stringify(createdJson.errors),
    );
    process.exit(1);
  }
  kvId = createdJson.result.id;
}
console.log('KV копии:', kvId);

// 2. Кубинский store.config.ts + USD-цены каталога (оба — только в рабочей
//    копии runner-а) + сборка
run('node scripts/make-store-config-copy.mjs');
run('node scripts/make-products-copy.mjs');
run('pnpm build');

// 3. Конфиг воркера копии + деплой отдельным воркером
run('node scripts/make-wrangler-copy.mjs', { env: { ...process.env, KV_ID: kvId } });
run('pnpm exec wrangler deploy -c wrangler.cu.jsonc');
console.log('Копия задеплоена: https://nuxt-shop-cu.igordolgov1972.workers.dev');

// 4. Каталог копии в KV: разовая синхронизация цен сида на ВЕРСИЮ.
//    KV копии живой (админ правит товары/цены в своей админке), поэтому
//    перезаписывать data:products на каждый деплой нельзя — затирали бы
//    правки админа. Маркер data:products-seed-version совпадает с
//    version из products.cu-prices.json → каталог уже с нужными ценами,
//    НЕ трогаем. Версия новая/маркера нет → каталог переписывается
//    ценами сида (правки админа стираются — осознанно: смена версии
//    означает «пересеять каталог»), маркер обновляется.
const seedVersion = JSON.parse(readFileSync('server/data/products.cu-prices.json', 'utf8')).version;
const MARKER_KEY = 'data:products-seed-version';
const markerUrl = `/${kvId}/values/${encodeURIComponent(MARKER_KEY)}`;
let currentMarker = null;
try {
  const res = await api(markerUrl);
  if (res.ok) currentMarker = await res.text();
} catch {
  currentMarker = null;
}
if (currentMarker === seedVersion) {
  console.log(`KV копии: каталог уже сида ${seedVersion} — не трогаем`);
} else {
  const productsJson = readFileSync('server/data/products.json', 'utf8');
  const putRes = await api(`/${kvId}/values/${encodeURIComponent('data:products')}`, {
    method: 'PUT',
    body: productsJson,
  });
  const putJson = await putRes.json();
  if (!putRes.ok || !putJson.success) {
    console.error('Не удалось записать каталог копии в KV:', JSON.stringify(putJson.errors));
    process.exit(1);
  }
  const markerRes = await api(markerUrl, { method: 'PUT', body: seedVersion });
  if (!markerRes.ok) {
    console.error(
      'Каталог записан, но маркер версии не поставился — следующий деплой перезапишет снова',
    );
    process.exit(1);
  }
  console.log(
    `KV копии: каталог пересеян ценами сида ${seedVersion} (маркер ${MARKER_KEY} обновлён)`,
  );
}
