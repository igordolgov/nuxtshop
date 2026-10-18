#!/usr/bin/env node
// fix-orderstock-test.mjs — чинит изоляцию тестов в tests/unit/order-stock.test.ts
//
// Симптом: после зачистки orderHelpers.ts падают ровно 2 теста:
//   «отмена подтверждённого возвращает количество на склад»
//   «после отмены можно подтвердить снова — спишет заново»
// с 409 «Тестовый товар: доступно 1 шт., запрошено 2» на ПЕРВОЙ же строке —
// на createOrder, хотя beforeEach только что положил в KV товар со складом 5.
//
// Причина: в реальном проекте createOrder имеет собственную проверку остатка
// (в макете, на котором проверялась зачистка, её не было), а чтение каталога
// идёт через модульный кэш: заполняется при чтении, сбрасывается при записи
// (writeProducts). В тесте «нехватка на складе — 409» confirm бросает 409
// ПОСЛЕ readProducts (кэш уже заполнен копией с stock=1), но ДО writeProducts
// — кэш остаётся протухшим. beforeEach чистит KV напрямую, минуя кэш, поэтому
// следующие тесты видят stock=1 вместо 5. Тесты с quantity=1 проходят мимо
// проверки (1 <= 1) — потому падают только тесты №4 и №6.
//
// Фикс: beforeEach после сброса KV синхронизирует кэш каталога через
// writeProducts — единственный легальный способ сбросить его снаружи
// (ровно этот контракт заявлен в шапке тест-файла). Правка минимальна,
// логика самих тестов и orderHelpers.ts не трогается.
//
// Запуск из корня проекта:  node fix-orderstock-test.mjs
// Скрипт идемпотентен, делает бэкап, при неожиданном состоянии НЕ пишет файл.

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const FILE = 'tests/unit/order-stock.test.ts';
const MARK = 'await writeProducts(event, structuredClone([product]));';
const PH = 'server/lib/productHelpers.ts';

const raw = readFileSync(FILE, 'utf8');

// ── Идемпотентность ─────────────────────────────────────────────────────
if (raw.includes(MARK)) {
  console.log('OK — tests/unit/order-stock.test.ts уже содержит фикс, ничего не делаю.');
  printDiagnostics();
  process.exit(0);
}

// ── Якорь: текущий блок beforeEach (LF или CRLF) ────────────────────────
const re =
  /beforeEach\(\(\) => \{\r?\n  kvStore\.clear\(\);\r?\n  kvStore\.set\('data:products', structuredClone\(\[product\]\)\);\r?\n\}\);/;
const m = raw.match(re);
if (!m) {
  console.error('!! ABORT — не нашёл точный блок beforeEach в tests/unit/order-stock.test.ts');
  console.error('!! Файл НЕ изменён. Пришлите этот файл и вывод в чат.');
  process.exit(1);
}
if (raw.split("beforeEach(() => {").length - 1 !== 1) {
  console.error('!! ABORT — блок beforeEach встречается больше одного раза, нужна ручная правка');
  console.error('!! Файл НЕ изменён.');
  process.exit(1);
}
const eol = m[0].includes('\r\n') ? '\r\n' : '\n';

const fixed = [
  'beforeEach(async () => {',
  '  kvStore.clear();',
  "  kvStore.set('data:products', structuredClone([product]));",
  '  // KV мы почистили напрямую, но модульный кэш каталога',
  '  // внутри productHelpers (readProducts) об этом не знает и переживает тесты:',
  '  // после 409 в тесте «нехватка» кэш остался со старым остатком, и проверка',
  '  // в createOrder видела stock=1 вместо 5. writeProducts синхронизирует кэш —',
  '  // следующий readProducts обязан прочитать KV заново.',
  '  await writeProducts(event, structuredClone([product]));',
  '});',
].join(eol);

copyFileSync(FILE, `${FILE}.bak`);
writeFileSync(FILE, raw.replace(re, fixed), 'utf8');
console.log('OK — tests/unit/order-stock.test.ts обновлён (бэкап: order-stock.test.ts.bak)');
console.log('  * beforeEach стал async и синхронизирует кэш каталога через writeProducts');
console.log('OK — теперь выполните: pnpm test  (ожидается 132 passed, 0 failed)');
printDiagnostics();

// ── Диагностика для следующего шага (просто пришлите вывод) ─────────────
function printDiagnostics() {
  console.log('---- ДИАГНОСТИКА (для следующего разбора) ----');
  // 1) кэш в productHelpers: определения readProducts/writeProducts
  if (existsSync(PH)) {
    const lines = readFileSync(PH, 'utf8').split(/\r?\n/);
    let shown = 0;
    lines.forEach((line, i) => {
      if (shown >= 24) return;
      if (/readProducts|writeProducts|[Cc]ache/.test(line)) {
        console.log(`  ${PH}:${i + 1}: ${line.trim().slice(0, 120)}`);
        shown++;
      }
    });
    if (shown === 0) console.log(`  ${PH}: упоминаний readProducts/writeProducts/cache не найдено`);
  } else {
    console.log(`  ${PH} не найден (неизвестно, где именно лежит кэш)`);
  }
  // 2) git-состояние (отложенный вопрос о расхождении с origin)
  const tryGit = (cmd) => {
    try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
    catch { return '(недоступно)'; }
  };
  console.log('  git status -sb:');
  console.log('    ' + tryGit('git status -sb').split('\n').join('\n    '));
  console.log('  git log --oneline -6:');
  console.log('    ' + tryGit('git log --oneline -6').split('\n').join('\n    '));
  console.log('  git log --oneline origin/main..main (локальные ahead):');
  console.log('    ' + tryGit('git log --oneline origin/main..main').split('\n').join('\n    '));
  console.log('  git log --oneline main..origin/main (удалённые ahead):');
  console.log('    ' + tryGit('git log --oneline main..origin/main').split('\n').join('\n    '));
}
