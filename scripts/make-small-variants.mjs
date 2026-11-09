// scripts/make-small-variants.mjs
// Достраивает миниатюры 400w для локальных фотографий каталога: для каждого
// public/images/products/photo-<id>.webp без пары создаёт
// public/images/products/small/photo-<id>.webp (ширина 400, webp q80).
//
// Зачем: productSrcset() (app/utils/productImage.ts) кладёт в srcset карточек
// кандидата small/… 400w для ЛЮБОГО файла по маске photo-*.webp. Если
// миниатюру не сгенерировать, браузер выбирает её (слот карточки 300px),
// получает 404 — карточка рисует заглушку вместо фото (кейс: тестовый товар
// «Нинтендо свич 2», 2026-11). Инвариант дублирует product-images.test.ts —
// тест поймает пропуск в CI, этот скрипт чинит его локально.
//
// Запуск: node scripts/make-small-variants.mjs
// Нужен sharp: в зависимостях проекта его нет (тяжёлый, нужен только здесь) —
// скрипт ищет его в node_modules проекта, затем в глобальном npm; если нет —
// подскажет, как поставить.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FULL_DIR = join(ROOT, 'public', 'images', 'products');
const SMALL_DIR = join(FULL_DIR, 'small');
// Та же маска, что LOCAL_PRODUCT_IMAGE_RE в app/utils/productImage.ts
const FILE_RE = /^photo-\d+-[a-f0-9]+\.webp$/;
const SMALL_WIDTH = 400;
const WEBP_QUALITY = 80;

const list = (dir) => {
  try {
    return readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile());
  } catch {
    return [];
  }
};

// ─── sharp: проект → глобальный npm → понятная ошибка ────────────────────
async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch {
    /* ниже пробуем глобальный npm */
  }
  try {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return (await import(pathToFileURL(join(globalRoot, 'sharp')).href)).default;
  } catch {
    console.error(
      'make-small-variants: не найден sharp. Поставьте его глобально (npm i -g sharp)' +
        ' или в проект (pnpm add -D sharp) и повторите.',
    );
    process.exit(1);
  }
}

const sharp = await loadSharp();

const fulls = list(FULL_DIR).filter((f) => FILE_RE.test(f));
const smalls = new Set(list(SMALL_DIR));

// Осиротевшие миниатюры (small есть, полного файла нет): второй кандидат
// srcset (800w) отдаст 404 на retina-экранах. Скрипт их не удаляет —
// только сообщает: решение (добавить полный файл или удалить миниатюру)
// за человеком.
const orphans = [...smalls].filter((f) => FILE_RE.test(f) && !existsSync(join(FULL_DIR, f)));
for (const f of orphans) {
  console.warn(`make-small-variants: осиротевшая миниатюра без полного файла: small/${f}`);
}

const missing = fulls.filter((f) => !smalls.has(f));
if (missing.length === 0) {
  console.log(`make-small-variants: все миниатюры на месте (${fulls.length} фото).`);
} else {
  console.log(`make-small-variants: не хватает ${missing.length} из ${fulls.length}, генерирую…`);
}

let created = 0;
for (const f of missing) {
  const dst = join(SMALL_DIR, f);
  const info = await sharp(join(FULL_DIR, f))
    .resize({ width: SMALL_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(dst);
  created += 1;
  console.log(`  small/${f} — ${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB`);
}

if (orphans.length > 0) process.exitCode = 1;
else if (created === 0) console.log('make-small-variants: делать нечего.');
else console.log(`make-small-variants: готово, создано ${created}.`);
