#!/usr/bin/env node
// ── Применение скидок (oldPrice) к прод-каталогу (этап «скидки») ─────────
//
// Заливает скидки из scripts/product-discounts.json (справочник
// «slug → цена до скидки») в KV-ключ data:products прода (binding: KV).
// Запускается ВРУЧНУЮ, требует авторизованного wrangler — тех же прав,
// что и `pnpm deploy` (нужен доступ к Workers KV):
//
//   node scripts/apply-product-discounts.mjs           # заполнить пустые
//   node scripts/apply-product-discounts.mjs --force   # перезаписать всё
//   node scripts/apply-product-discounts.mjs --dry     # без записи в KV
//   node scripts/apply-product-discounts.mjs --clear   # снять ВСЕ скидки (откат)
//
// Безопасность:
//   - ПО УМОЛЧАНИЮ проставляются только ПУСТЫЕ oldPrice (отсутствующие) —
//     ручные правки из админки не перетираются; --force перезаписывает
//     значениями из справочника.
//   - oldPrice <= price в справочнике — ошибка запуска (бейджа −% не будет).
//   - Перед записью создаётся бэкап scripts/data-products-backup-<ts>.json.
//   - Запускать, когда в админке никто не правит товары (read-modify-write
//     с окном в пару секунд).
//
// Витрина показывает скидку сразу после записи (SSR читает KV без кэша);
// бейджи −% появляются после деплоя кода витрины.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const dry = args.has('--dry');
const clear = args.has('--clear');

// wrangler запускаем напрямую: node <путь к bin/wrangler.js> (см.
// apply-product-translations.mjs — spawnSync без shell не запускает .cmd).
let wranglerBin;
function resolveWranglerBin() {
  const pkgPath = path.join(root, 'node_modules', 'wrangler', 'package.json');
  let binRel = 'bin/wrangler.js';
  try {
    const bin = JSON.parse(readFileSync(pkgPath, 'utf8')).bin;
    binRel = typeof bin === 'string' ? bin : (bin?.wrangler ?? binRel);
  } catch {
    // нет package.json — ниже existsSync покажет понятную ошибку
  }
  const binPath = path.join(root, 'node_modules', 'wrangler', binRel);
  if (!existsSync(binPath)) {
    throw new Error(
      'wrangler не найден в node_modules. Выполните `pnpm install` в корне проекта и повторите.',
    );
  }
  return binPath;
}

function runWrangler(wranglerArgs) {
  wranglerBin ??= resolveWranglerBin();
  const res = spawnSync(process.execPath, [wranglerBin, ...wranglerArgs], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status !== 0) {
    const out = [res.stderr, res.stdout].filter(Boolean).join('\n').trim();
    const hint =
      /CLOUDFLARE_API_TOKEN|not authenticated|wrangler login|Failed to fetch|OAuth/i.test(out)
        ? '\n\n   Похоже, wrangler не авторизован. Варианты:\n' +
          '   1) `npx wrangler login` — войдите в аккаунт Cloudflare;\n' +
          '   2) переменная окружения CLOUDFLARE_API_TOKEN с правами на Workers KV.'
        : '';
    throw new Error(
      `wrangler ${wranglerArgs.slice(0, 3).join(' ')} упал` +
        ` (код выхода ${res.status ?? res.error?.code ?? '?'}):\n${out.slice(-800)}${hint}`,
    );
  }
  return res.stdout;
}

// ── 1. Читаем текущий каталог с прода ───────────────────────────────────
console.log('1) Читаю data:products из прод-KV (wrangler kv key get --remote)…');
const raw = runWrangler(['kv', 'key', 'get', 'data:products', '--binding', 'KV', '--remote']);
const candidates = ['[', '{'].map((ch) => raw.indexOf(ch)).filter((i) => i >= 0);
if (candidates.length === 0) throw new Error('В выводе wrangler не найден JSON каталога');
const products = JSON.parse(raw.slice(Math.min(...candidates)));
if (!Array.isArray(products) || products.length === 0) {
  throw new Error('Каталог пуст или не массив — запись отменена');
}
if (!products.every((p) => p && p.id && p.slug && typeof p.price === 'number')) {
  throw new Error('В каталоге записи без id/slug/price — запись отменена');
}
console.log(`   товаров в каталоге: ${products.length}`);

// ── 2. Бэкап ────────────────────────────────────────────────────────────
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(root, `scripts/data-products-backup-${ts}.json`);
writeFileSync(backupPath, JSON.stringify(products, null, 2), 'utf8');
console.log(`2) Бэкап: ${path.relative(root, backupPath)}`);

// ── 3. Проставляем скидки ───────────────────────────────────────────────
const guide = clear
  ? {}
  : JSON.parse(readFileSync(path.join(root, 'scripts/product-discounts.json'), 'utf8'));
for (const [slug, oldPrice] of Object.entries(guide)) {
  if (!Number.isFinite(oldPrice) || oldPrice <= 0) {
    throw new Error(`Справочник: ${slug} — oldPrice должно быть положительным числом`);
  }
}

let set = 0;
let overwritten = 0;
let skipped = 0;
const unknownSlugs = Object.keys(guide).filter((slug) => !products.some((p) => p.slug === slug));
if (unknownSlugs.length > 0) {
  throw new Error(`Справочник: товаров нет в каталоге: ${unknownSlugs.join(', ')}`);
}

for (const product of products) {
  const oldPrice = guide[product.slug];
  if (clear) {
    if (product.oldPrice !== undefined) {
      delete product.oldPrice;
      set++;
    }
    continue;
  }
  if (oldPrice === undefined) continue;
  if (oldPrice <= product.price) {
    throw new Error(
      `${product.slug}: oldPrice (${oldPrice}) <= price (${product.price}) — поправьте справочник`,
    );
  }
  if (product.oldPrice === undefined) {
    product.oldPrice = oldPrice;
    set++;
  } else if (force && product.oldPrice !== oldPrice) {
    product.oldPrice = oldPrice;
    overwritten++;
  } else {
    skipped++;
  }
}

console.log(
  clear
    ? `3) Скидки сняты у ${set} товаров (--clear)`
    : `3) Скидки: проставлено ${set}` +
        (force ? `, перезаписано ${overwritten}` : ', пропущено с существующими ' + skipped) +
        ' (--force не задан: существующие не тронуты)',
);
if (dry) {
  console.log('--dry: запись в KV не выполнялась.');
  process.exit(0);
}

// ── 4. Пишем каталог целиком ────────────────────────────────────────────
console.log('4) Пишу data:products в прод-KV (wrangler kv key put --remote)…');
const tmpPath = path.join(root, 'scripts/.data-products-tmp.json');
writeFileSync(tmpPath, JSON.stringify(products), 'utf8');
try {
  runWrangler([
    'kv',
    'key',
    'put',
    'data:products',
    '--path',
    tmpPath,
    '--binding',
    'KV',
    '--remote',
  ]);
} finally {
  unlinkSync(tmpPath);
}
console.log('Готово: скидки на проде. Проверьте главную и карточки товаров.');
