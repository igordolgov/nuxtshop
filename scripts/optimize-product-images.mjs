// scripts/optimize-product-images.mjs
// Пересжатие статических фото каталога (public/images/products): на замере
// производительности 2026-11 файлы 800w весили 85-228KB при норме ~40-70KB
// (webp q76), один админ-файл был 1124px при инварианте «полная версия = 800w»
// (productSrcset). Скрипт пережимает webp IN PLACE:
//   - полные версии: ресайз до max 800px по ширине (без увеличения) +
//     q76/effort6/smartSubsample — файлы >800w записываются ВСЕГДА,
//     остальным достаточно ≥3% экономии, чтобы не плодить бинарный diff;
//   - миниатюры small/: без ресайза, q80/effort6/smartSubsample (качество
//     генератора make-small-variants сохраняется), тот же порог 3%.
//
// Запуск: node scripts/optimize-product-images.mjs
// sharp не в зависимостях проекта — ищется как в make-small-variants.mjs.
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FULL_DIR = join(ROOT, 'public', 'images', 'products');
const SMALL_DIR = join(FULL_DIR, 'small');
const FULL_MAX_WIDTH = 800;
const FULL_QUALITY = 76;
const SMALL_QUALITY = 80;
const MIN_SAVING_RATIO = 0.03; // <3% экономии — не трогаем

async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch {
    /* ниже пробуем глобальный npm */
  }
  const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  return (await import(pathToFileURL(join(globalRoot, 'sharp')).href)).default;
}

const sharp = await loadSharp();

const list = (dir) =>
  readdirSync(dir).filter((f) => f.endsWith('.webp') && statSync(join(dir, f)).isFile());

let beforeTotal = 0;
let afterTotal = 0;
let written = 0;
let skipped = 0;
let downscaled = 0;

async function processDir(dir, { maxWidth, quality }) {
  for (const f of list(dir)) {
    const p = join(dir, f);
    const before = readFileSync(p);
    beforeTotal += before.length;
    const meta = await sharp(before).metadata();
    const needsResize = !!maxWidth && meta.width > maxWidth;
    const buf = await sharp(before)
      .resize(maxWidth ? { width: maxWidth, withoutEnlargement: true } : {})
      .webp({ quality, effort: 6, smartSubsample: true })
      .toBuffer();
    const paysOff = buf.length < before.length * (1 - MIN_SAVING_RATIO);
    if (needsResize || paysOff) {
      writeFileSync(p, buf);
      afterTotal += buf.length;
      written += 1;
      if (needsResize) {
        downscaled += 1;
        console.log(`  ${f}: ${meta.width}px -> ${maxWidth}px`);
      }
    } else {
      afterTotal += before.length;
      skipped += 1;
    }
  }
}

await processDir(FULL_DIR, { maxWidth: FULL_MAX_WIDTH, quality: FULL_QUALITY });
await processDir(SMALL_DIR, { maxWidth: undefined, quality: SMALL_QUALITY });

const kb = (n) => `${Math.round(n / 1024)} KB`;
console.log(
  `optimize-product-images: было ${kb(beforeTotal)}, стало ${kb(afterTotal)} ` +
    `(−${Math.round(((beforeTotal - afterTotal) / Math.max(beforeTotal, 1)) * 100)}%)`,
);
console.log(`  записано ${written}, без изменений ${skipped}, приведено к 800w ${downscaled}`);
