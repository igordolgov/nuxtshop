#!/usr/bin/env node
// fix-orderhelpers.mjs — зачистка server/lib/orderHelpers.ts после
// многократного «git apply --reject»:
//   1) оставляет РОВНО ОДНУ копию функции adjustStockForOrder;
//   2) удаляет ВСЕ блоки «Склад пишем ПОСЛЕ заказа…» (включая затесавшийся
//      в createOrder) и возвращает один такой блок на единственное правильное
//      место — в updateOrderStatus, сразу после await writeOrders(event, orders);
//   3) проверяет import { … } from './productHelpers' и добавляет
//      writeProducts / type Product, если их там нет;
//   4) проверяет, что поле stockApplied и блок deduct/restore встречаются
//      ровно один раз.
// Скрипт работает по уникальным текстовым якорям, а не по номерам строк.
// При любом неожиданном состоянии он завершается БЕЗ записи файла.
// Бэкап исходного состояния: server/lib/orderHelpers.ts.bak
// Запуск из корня проекта:  node fix-orderhelpers.mjs

import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const FILE = 'server/lib/orderHelpers.ts';

const raw = readFileSync(FILE, 'utf8');
const isCRLF = raw.includes('\r\n');
let src = isCRLF ? raw.replaceAll('\r\n', '\n') : raw;

const count = (needle) => src.split(needle).length - 1;
const report = [];
const fail = (msg) => {
  console.error(`!! ABORT — ${msg}`);
  console.error('!! Файл НЕ изменён. Пришлите server/lib/orderHelpers.ts и этот вывод в чат.');
  process.exit(1);
};

// ── Предпроверки: всё ли на месте для зачистки ──────────────────────────
if (count('export async function updateOrderStatus(') !== 1)
  fail(`функция updateOrderStatus должна быть 1, найдено ${count('export async function updateOrderStatus(')}`);
if (count("const deduct = status === 'confirmed'") !== 1)
  fail('блок deduct/restore не найден или задвоен — нужна ручная правка');
if (count('stockApplied?: boolean;') !== 1)
  fail(`поле stockApplied в интерфейсе должно быть 1 раз, найдено ${count('stockApplied?: boolean;')}`);
if (count('async function adjustStockForOrder(') === 0)
  fail('функция adjustStockForOrder не найдена вовсе');

// ── 1. adjustStockForOrder: удалить все копии, КРОМЕ первой ─────────────
const DEF = 'async function adjustStockForOrder(';
const RET = 'return changed ? products : null;';
const firstDef = src.indexOf(DEF);
const firstRet = src.indexOf(RET, firstDef);
if (firstRet === -1) fail('у первой копии adjustStockForOrder не найден конец');
const firstClose = src.indexOf('\n}', firstRet);
if (firstClose === -1) fail('у первой копии adjustStockForOrder не найдена закрывающая скобка "}"');
let head = src.slice(0, firstClose + 2);
let tail = src.slice(firstClose + 2);
let removedFn = 0;
for (;;) {
  const d = tail.indexOf(DEF);
  if (d === -1) break;
  const r = tail.indexOf(RET, d);
  if (r === -1) fail('у повторной копии adjustStockForOrder не найден конец');
  const c = tail.indexOf('\n}', r);
  if (c === -1) fail('у повторной копии adjustStockForOrder не найдена закрывающая скобка "}"');
  // захватываем шапку-комментарий, если она прилегает к копии
  let start = tail.lastIndexOf('\n', d) + 1;
  const h = tail.lastIndexOf('/**', d);
  if (h !== -1 && tail.slice(h, d).includes('Списывает') && tail.slice(h, d).split('\n').length <= 12) {
    start = tail.lastIndexOf('\n', h) + 1;
  }
  tail = tail.slice(0, start) + tail.slice(c + 2);
  removedFn++;
}
src = head + tail;
report.push(`лишних копий adjustStockForOrder удалено: ${removedFn}`);

// ── 2. Блоки «Склад пишем ПОСЛЕ заказа»: удалить все ────────────────────
const C5_START = '  // Склад пишем ПОСЛЕ заказа';
const C5_END = '  if (updatedProducts) await writeProducts(event, updatedProducts);';
let removedC5 = 0;
for (;;) {
  const s = src.indexOf(C5_START);
  if (s === -1) break;
  const e = src.indexOf(C5_END, s);
  if (e === -1 || e - s > 800)
    fail('найден блок «Склад пишем ПОСЛЕ заказа» без ожидаемого завершения');
  const lineEnd = src.indexOf('\n', e);
  src = src.slice(0, s) + (lineEnd === -1 ? '' : src.slice(lineEnd + 1));
  removedC5++;
}
report.push(`блоков «Склад пишем ПОСЛЕ заказа» удалено: ${removedC5} (один будет вставлен заново)`);

// ── 3. Вставить блок на единственное правильное место ───────────────────
//     updateOrderStatus: сразу после await writeOrders(event, orders);
const deductIdx = src.indexOf("const deduct = status === 'confirmed'");
const updIdx = src.indexOf('export async function updateOrderStatus(');
if (deductIdx < updIdx) fail('блок deduct/restore находится ВНЕ updateOrderStatus');
const WO = 'await writeOrders(event, orders);';
const woIdx = src.indexOf(WO, deductIdx);
if (woIdx === -1) fail('в updateOrderStatus не найден await writeOrders(event, orders);');
const insertAt = woIdx + WO.length;
const c5Block = [
  '  // Склад пишем ПОСЛЕ заказа: если упадёт запись каталога, статус уже',
  '  // «confirmed» и stockApplied=true — повторный вызов не спишет дважды',
  '  // (остаток корректируется вручную). Обратный порядок опаснее: упавшая',
  '  // запись заказа оставила бы склад списанным при статусе «new», а ретрай',
  '  // списал бы снова.',
  C5_END,
].join('\n');
src = src.slice(0, insertAt) + '\n' + c5Block + src.slice(insertAt);

// нормализуем пустые строки перед updateOrderStatus (швы после удалений)
src = src.replace(/\n{3,}(export async function updateOrderStatus\()/g, '\n\n$1');

// ── 4. Import из productHelpers ─────────────────────────────────────────
const m = src.match(/import\s*\{([^}]*)\}\s*from\s*'\.\/productHelpers';/);
if (!m) fail("не найден import из './productHelpers'");
const names = m[1].split(',').map((x) => x.trim()).filter(Boolean);
let importFixed = false;
for (const need of ['writeProducts', 'type Product']) {
  if (!names.includes(need)) {
    names.push(need);
    importFixed = true;
  }
}
if (importFixed) {
  src = src.replace(m[0], `import { ${names.join(', ')} } from './productHelpers';`);
  report.push(`import дополнен: ${names.join(', ')}`);
} else {
  report.push('import из productHelpers уже содержит writeProducts и type Product');
}

// ── 5. Финальные проверки (после правок всё должно сходиться) ───────────
const checks = [
  ['async function adjustStockForOrder(', 1],
  [C5_END, 1],
  ["const deduct = status === 'confirmed'", 1],
  ['stockApplied?: boolean;', 1],
  ['updatedProducts', 3],
  ['export async function updateOrderStatus(', 1],
];
for (const [needle, want] of checks) {
  const got = count(needle);
  if (got !== want) fail(`после правок «${needle}» встречается ${got} раз(а), ожидалось ${want}`);
}

// ── Запись (с бэкапом) ──────────────────────────────────────────────────
copyFileSync(FILE, `${FILE}.bak`);
writeFileSync(FILE, isCRLF ? src.replaceAll('\n', '\r\n') : src);
console.log('OK — server/lib/orderHelpers.ts зачищен (бэкап: orderHelpers.ts.bak)');
for (const line of report) console.log('  * ' + line);
console.log('OK — теперь выполните: pnpm test');
