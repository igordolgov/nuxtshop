#!/usr/bin/env node
// ── Применение переводов товаров к прод-каталогу (этап i18n-3) ──────────
//
// Заливает переводы из scripts/product-translations.json в KV-ключ
// data:products прода (Bindings: KV). Запускается ВРУЧНУЮ один раз,
// требует авторизованного wrangler — тех же прав, что и `pnpm deploy`:
//
//   node scripts/apply-product-translations.mjs           # заполнить пустые
//   node scripts/apply-product-translations.mjs --force   # перезаписать всё
//   node scripts/apply-product-translations.mjs --dry     # без записи в KV
//
// Безопасность:
//   - ПО УМОЛЧАНИЮ заполняются только ПУСТЫЕ переводы (nameEn/…/categoriesEs
//     отсутствуют или пусты). Ручные правки из админки не перетираются;
//     --force перезаписывает значениями из справочника.
//   - Перед записью создаётся бэкап текущего каталога
//     scripts/data-products-backup-<timestamp>.json.
//   - Запускать, когда в админке никто не правит товары (read-modify-write
//     с окном в пару секунд).
//
// Примечание: скрипт пишет только поля переводов; цены/остатки/фото не
// трогает. После записи новые названия видны на /en и /es сразу (swr-кэш
// страниц обновляется в течение минуты), в ru-версии ничего не меняется.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const dry = args.has('--dry');

const TEXT_FIELDS = ['nameEn', 'nameEs', 'descriptionEn', 'descriptionEs'];
const CATEGORY_FIELDS = ['categoriesEn', 'categoriesEs'];

function runWrangler(wranglerArgs) {
  const res = spawnSync('npx', ['wrangler', ...wranglerArgs], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status !== 0) {
    throw new Error(
      `wrangler ${wranglerArgs[0]} ${wranglerArgs[1]} упал:\n${(res.stderr || res.stdout || '').slice(-600)}`,
    );
  }
  return res.stdout;
}

// ── 1. Читаем текущий каталог с прода ───────────────────────────────────
console.log('1) Читаю data:products из прод-KV (wrangler kv key get --remote)…');
const raw = runWrangler([
  'kv', 'key', 'get', 'data:products', '--binding', 'KV', '--remote',
]);
// Баннер wrangler уходит в stderr, но на всякий случай берём JSON от первой [/{.
const candidates = ['[', '{'].map((ch) => raw.indexOf(ch)).filter((i) => i >= 0);
if (candidates.length === 0) throw new Error('В выводе wrangler не найден JSON каталога');
const products = JSON.parse(raw.slice(Math.min(...candidates)));
if (!Array.isArray(products) || products.length === 0) {
  throw new Error('Каталог пуст или не массив — запись отменена');
}
if (!products.every((p) => p && p.id && p.slug && p.name)) {
  throw new Error('В каталоге записи без id/slug/name — запись отменена');
}
console.log(`   товаров в каталоге: ${products.length}`);

// ── 2. Бэкап ────────────────────────────────────────────────────────────
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(root, `scripts/data-products-backup-${ts}.json`);
writeFileSync(backupPath, JSON.stringify(products, null, 2), 'utf8');
console.log(`2) Бэкап: ${path.relative(root, backupPath)}`);

// ── 3. Мержим переводы ──────────────────────────────────────────────────
const translations = JSON.parse(
  readFileSync(path.join(root, 'scripts/product-translations.json'), 'utf8'),
);

let translated = 0;
let filled = 0;
let overwritten = 0;
let notInGuide = [];

for (const product of products) {
  const t = translations[product.slug];
  if (!t) {
    notInGuide.push(product.slug);
    continue;
  }
  translated++;

  for (const field of TEXT_FIELDS) {
    const value = (t[field] ?? '').trim();
    if (!value) continue;
    const has = typeof product[field] === 'string' && product[field].trim() !== '';
    if (!has) {
      product[field] = value;
      filled++;
    } else if (force && product[field] !== value) {
      product[field] = value;
      overwritten++;
    }
  }

  for (const field of CATEGORY_FIELDS) {
    const value = Array.isArray(t[field]) ? t[field].filter(Boolean) : [];
    if (value.length === 0) continue;
    const has = Array.isArray(product[field]) && product[field].length > 0;
    if (!has) {
      product[field] = value;
      filled++;
    } else if (force && JSON.stringify(product[field]) !== JSON.stringify(value)) {
      product[field] = value;
      overwritten++;
    }
  }
}

console.log(
  `3) Переводы: товаров со справочником ${translated}/${products.length};` +
    ` заполнено пустых полей ${filled}` +
    (force ? `, перезаписано ${overwritten}` : ' (--force не задан: существующие не тронуты)'),
);
if (notInGuide.length > 0) {
  console.log(`   без перевода в справочнике (${notInGuide.length}): ${notInGuide.join(', ')}`);
}
if (dry) {
  console.log('--dry: запись в KV не выполнялась.');
  process.exit(0);
}

// ── 4. Пишем каталог обратно ────────────────────────────────────────────
const mergedPath = path.join(root, `scripts/.data-products-merged-${ts}.json`);
writeFileSync(mergedPath, JSON.stringify(products), 'utf8');
console.log('4) Пишу каталог в прод-KV (wrangler kv key put --remote)…');
try {
  runWrangler([
    'kv', 'key', 'put', 'data:products', '--path', mergedPath, '--binding', 'KV', '--remote',
  ]);
} finally {
  try {
    unlinkSync(mergedPath);
  } catch {
    // временный файл не критичен
  }
}
console.log('Готово. На /en и /es переводы появятся в течение минуты (swr 60).');
console.log('Переводы можно править дальше в админке: вкладки Русский/English/Español у товара.');
