#!/usr/bin/env node
// ── Применение переводов новостей и контента к прод-KV (i18n витрины) ────
//
// Заливает переводы из scripts/news-content-translations.json в прод-ключи
// data:news и data:content (Bindings: KV). Запускается ВРУЧНУЮ один раз,
// требует авторизованного wrangler — тех же прав, что и `pnpm deploy`:
//
//   node scripts/apply-news-content-translations.mjs           # заполнить пустые
//   node scripts/apply-news-content-translations.mjs --force   # перезаписать всё
//   node scripts/apply-news-content-translations.mjs --dry     # без записи в KV
//
// Безопасность:
//   - ПО УМОМОЛЧАНИЮ заполняются только ПУСТЫЕ переводы (titleEn/…/bodyEs,
//     cityEn/…/textEs отсутствуют или пусты). Ручные правки из админки
//     не перетираются; --force перезаписывает значениями из справочника.
//   - Перед записью каждого ключа создаётся бэкап
//     scripts/data-<key>-backup-<timestamp>.json.
//   - Запускать, когда в админке никто не правит новости/контент
//     (read-modify-write с окном в пару секунд).
//
// Примечание: скрипт пишет только поля переводов; даты/рубрики/фото/
// телефоны/адреса RU не трогает. После записи переводы видны на /en и /es
// сразу (swr-кэш страниц обновляется в течение минуты), ru-версия не меняется.
// Дальше переводы правятся в админке (вкладки Русский/English/Español).

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const dry = args.has('--dry');

// Поля переводов: строковые и списочные (body — абзацы целиком).
const NEWS_TEXT_FIELDS = ['titleEn', 'titleEs', 'excerptEn', 'excerptEs'];
const NEWS_LIST_FIELDS = ['bodyEn', 'bodyEs'];
const STORE_FIELDS = [
  'cityEn',
  'cityEs',
  'badgeEn',
  'badgeEs',
  'addressEn',
  'addressEs',
  'hoursEn',
  'hoursEs',
];
const FAQ_FIELDS = ['qEn', 'aEn', 'qEs', 'aEs'];
const STAT_FIELDS = ['valueEn', 'labelEn', 'valueEs', 'labelEs'];
const HISTORY_FIELDS = ['textEn', 'textEs'];

// wrangler запускаем напрямую: node <путь к bin/wrangler.js> — обёртки
// npx/.cmd в spawnSync без shell не работают (CVE-2024-27980, EINVAL).
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
        ? '\n\n   Похоже, wrangler не авторизован на этой машине. Варианты:\n' +
          '   1) `npx wrangler login` — откроется браузер, войдите в аккаунт Cloudflare;\n' +
          '   2) переменная окружения CLOUDFLARE_API_TOKEN с токеном, у которого\n' +
          '      есть права на Workers KV (те же права, что нужны `pnpm deploy`).'
        : '';
    throw new Error(
      `wrangler ${wranglerArgs.slice(0, 3).join(' ')} упал` +
        ` (код выхода ${res.status ?? res.error?.code ?? '?'}):\n${out.slice(-800)}${hint}`,
    );
  }
  return res.stdout;
}

/** Читает JSON-ключ из прод-KV (баннер wrangler отрезаем от первой { или [). */
function readKvJson(key) {
  const raw = runWrangler(['kv', 'key', 'get', key, '--binding', 'KV', '--remote']);
  const candidates = ['[', '{'].map((ch) => raw.indexOf(ch)).filter((i) => i >= 0);
  if (candidates.length === 0) throw new Error(`В выводе wrangler для ${key} не найден JSON`);
  return JSON.parse(raw.slice(Math.min(...candidates)));
}

/** Пишет JSON-ключ в прод-KV (временный файл удаляется в любом случае). */
function writeKvJson(key, value) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const tmpPath = path.join(root, `scripts/.${key.replace(':', '-')}-merged-${ts}.json`);
  writeFileSync(tmpPath, JSON.stringify(value), 'utf8');
  try {
    runWrangler(['kv', 'key', 'put', key, '--path', tmpPath, '--binding', 'KV', '--remote']);
  } finally {
    try {
      unlinkSync(tmpPath);
    } catch {
      // временный файл не критичен
    }
  }
}

/** Бэкап ключа в scripts/ (файл остаётся — gitignore, см. 5d02946). */
function backupKv(key, value) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(root, `scripts/data-${key.replace(':', '-')}-backup-${ts}.json`);
  writeFileSync(backupPath, JSON.stringify(value, null, 2), 'utf8');
  console.log(`   бэкап: ${path.relative(root, backupPath)}`);
}

const isBlank = (v) => typeof v !== 'string' || v.trim() === '';
const listHas = (v) => Array.isArray(v) && v.some((p) => typeof p === 'string' && p.trim() !== '');
const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Заполняет пустые (или перезаписывает при --force) переводные поля.
 * Возвращает { filled, overwritten } — счётчики применённых полей.
 */
function applyFields(target, fields, guide) {
  const counters = { filled: 0, overwritten: 0 };
  for (const field of fields) {
    const value = guide?.[field];
    const isList = Array.isArray(value);
    if (isList ? !listHas(value) : isBlank(value)) continue;
    const has = isList ? listHas(target[field]) : !isBlank(target[field]);
    if (!has) {
      target[field] = value;
      counters.filled++;
    } else if (force && (isList ? !sameList(target[field], value) : target[field] !== value)) {
      target[field] = value;
      counters.overwritten++;
    }
  }
  return counters;
}

const guide = JSON.parse(
  readFileSync(path.join(root, 'scripts/news-content-translations.json'), 'utf8'),
);

// ── 1. Новости (data:news) ──────────────────────────────────────────────
console.log('1) Читаю data:news из прод-KV…');
const news = readKvJson('data:news');
if (!Array.isArray(news) || news.length === 0) throw new Error('data:news пуст или не массив');
backupKv('data:news', news);

let newsTouched = 0;
let newsFilled = 0;
let newsOverwritten = 0;
let newsWithoutGuide = [];

for (const item of news) {
  const t = guide.news?.[String(item?.id)];
  if (!t) {
    newsWithoutGuide.push(item?.id);
    continue;
  }
  const res = applyFields(item, NEWS_TEXT_FIELDS, t);
  const resList = applyFields(item, NEWS_LIST_FIELDS, t);
  if (res.filled + resList.filled + res.overwritten + resList.overwritten > 0) newsTouched++;
  newsFilled += res.filled + resList.filled;
  newsOverwritten += res.overwritten + resList.overwritten;
}

console.log(
  `   новостей ${news.length}; со справочником ${news.length - newsWithoutGuide.length};` +
    ` изменено ${newsTouched}, заполнено пустых полей ${newsFilled}` +
    (force ? `, перезаписано ${newsOverwritten}` : ' (--force не задан: существующие не тронуты)'),
);
if (newsWithoutGuide.length > 0) {
  console.log(`   без перевода в справочнике (id): ${newsWithoutGuide.join(', ')}`);
}

// ── 2. Контент сайта (data:content) ─────────────────────────────────────
console.log('2) Читаю data:content из прод-KV…');
const content = readKvJson('data:content');
if (!content || typeof content !== 'object' || !content.contacts || !content.about) {
  throw new Error('data:content пуст или не объект SiteContent');
}
backupKv('data:content', content);

const cg = guide.content;
let contentFilled = 0;
let contentOverwritten = 0;
const bump = (res) => {
  contentFilled += res.filled;
  contentOverwritten += res.overwritten;
};

for (const [i, store] of (content.contacts.stores ?? []).entries()) {
  bump(applyFields(store, STORE_FIELDS, cg.stores?.[i]));
}
for (const [i, faq] of (content.contacts.faq ?? []).entries()) {
  bump(applyFields(faq, FAQ_FIELDS, cg.faq?.[i]));
}
for (const [i, stat] of (content.about.stats ?? []).entries()) {
  bump(applyFields(stat, STAT_FIELDS, cg.stats?.[i]));
}
for (const [i, hist] of (content.about.history ?? []).entries()) {
  bump(applyFields(hist, HISTORY_FIELDS, cg.history?.[i]));
}

console.log(
  `   контент: магазинов ${(content.contacts.stores ?? []).length}, вопросов ${(content.contacts.faq ?? []).length},` +
    ` цифр ${(content.about.stats ?? []).length}, событий ${(content.about.history ?? []).length};` +
    ` заполнено пустых полей ${contentFilled}` +
    (force
      ? `, перезаписано ${contentOverwritten}`
      : ' (--force не задан: существующие не тронуты)'),
);

if (dry) {
  console.log('--dry: запись в KV не выполнялась.');
  process.exit(0);
}

// ── 3. Пишем обратно (только изменённые ключи) ──────────────────────────
if (newsFilled + newsOverwritten > 0) {
  console.log('3) Пишу data:news в прод-KV…');
  writeKvJson('data:news', news);
} else {
  console.log('3) data:news без изменений — запись не нужна.');
}
if (contentFilled + contentOverwritten > 0) {
  console.log('4) Пишу data:content в прод-KV…');
  writeKvJson('data:content', content);
} else {
  console.log('4) data:content без изменений — запись не нужна.');
}
console.log(
  'Готово. На /en/news, /en/about, /en/contacts (и /es/…) переводы появятся в течение минуты (swr 60).',
);
console.log(
  'Переводы можно править дальше в админке: вкладки Русский/English/Español у новости и в «Контенте сайта».',
);
