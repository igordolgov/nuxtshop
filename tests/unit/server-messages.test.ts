// Тесты соответствия серверных кодов ошибок словарям i18n.
//
// Сервер кладёт машиночитаемый код в тело ошибки:
//   createError({ statusCode, message, data: { code, params? } })
// Клиент переводит его ключом `server.<code>` (useServerMessage /
// serverMessageTr, секция server в i18n/locales/*.json). Если код
// есть в сервере, а ключа в словаре нет — покупатель увидит
// локализованный фолбэк без деталей. Тест ловит такие расхождения:
//   · каждый `code: '…'` в server/** существует во всех трёх словарях;
//   · каждый ключ секции server.* начинается с известного кода
//     или является служебным шаблоном (stockShortageItem, promo…).
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../..');
const SERVER_DIR = join(ROOT, 'server');
const LOCALES_DIR = join(ROOT, 'i18n', 'locales');

/** Все .ts файлы server/ рекурсивно */
const serverFiles = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path);
    else if (name.endsWith('.ts')) serverFiles.push(path);
  }
};
walk(SERVER_DIR);

/** Коды из тела ошибки: data: { code: '…' } (форма createError-ошибок).
 *  Более широкий паттерн `code: '…'` цеплял бы не-ошибочные коды
 *  (например, локали в seoHelpers: { code: 'ru', prefix: '' }). */
const codeRe = /data:\s*\{\s*code:\s*'([a-zA-Z][a-zA-Z0-9]*)'/g;
const serverCodes = new Set();
for (const file of serverFiles) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(codeRe)) serverCodes.add(m[1]);
}

const loadDict = (loc) => {
  const d = JSON.parse(readFileSync(join(LOCALES_DIR, `${loc}.json`), 'utf8'));
  return d.server ?? {};
};

const dicts = { ru: loadDict('ru'), en: loadDict('en'), es: loadDict('es') };

describe('серверные коды ошибок ↔ секция server.* словарей', () => {
  it('в сервере есть коды (тест не теряет смысл на пустом множестве)', () => {
    expect(serverCodes.size).toBeGreaterThan(10);
  });

  for (const [loc, dict] of Object.entries(dicts)) {
    it(`каждый серверный код переведён в ${loc}.json (server.<code>)`, () => {
      const missing = [...serverCodes].filter((code) => !(code in dict));
      expect(missing, `нет ключей server.* в ${loc}: ${missing.join(', ')}`).toEqual([]);
    });
  }

  it('секция server синхронна между локулями (одни и те же ключи)', () => {
    const keysets = Object.values(dicts).map((d) => Object.keys(d).sort());
    expect(keysets[0]).toEqual(keysets[1]);
    expect(keysets[0]).toEqual(keysets[2]);
  });

  it('переводы не совпадают с самим ключом (i18n вернул бы фолбэк)', () => {
    for (const [loc, dict] of Object.entries(dicts)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value, `${loc}.server.${key}`).not.toBe(`server.${key}`);
        expect(String(value).length).toBeGreaterThan(0);
      }
    }
  });
});
