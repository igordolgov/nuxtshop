// Тесты server/lib/password.ts — PBKDF2-SHA256 через WebCrypto.
// Node 18+ имеет глобальный crypto.subtle/btoa/atob, поэтому хэширование
// проверяется по-настоящему, без моков криптографии.
import { describe, expect, it } from 'vitest';
import { comparePassword, hashPassword } from '../../server/lib/password';

/** Собирает хэш формата pbkdf2$<iterations>$<salt-b64>$<hash-b64> вручную —
 *  для проверки «число итераций читается из самого хэша». */
async function makeHashWithIterations(password: string, iterations: number): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
  return `pbkdf2$${iterations}$${toB64(salt)}$${toB64(new Uint8Array(bits))}`;
}

describe('hashPassword', () => {
  it('возвращает хэш в формате pbkdf2$<iterations>$<salt-b64>$<hash-b64>', async () => {
    const hash = await hashPassword('секрет123');
    expect(hash).toMatch(/^pbkdf2\$20000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  });

  it('генерирует случайную соль — два хэша одного пароля не совпадают', async () => {
    const a = await hashPassword('одинаковый-пароль');
    const b = await hashPassword('одинаковый-пароль');
    expect(a).not.toBe(b);
  });

  it('бросает исключение на пустом пароле', async () => {
    await expect(hashPassword('')).rejects.toThrow();
  });

  it('бросает исключение на пароле короче 6 символов', async () => {
    await expect(hashPassword('12345')).rejects.toThrow(/минимум 6/);
  });
});

describe('comparePassword', () => {
  it('верный пароль — true', async () => {
    const hash = await hashPassword('правильный-пароль');
    expect(await comparePassword('правильный-пароль', hash)).toBe(true);
  });

  it('неверный пароль — false (без исключений)', async () => {
    const hash = await hashPassword('правильный-пароль');
    expect(await comparePassword('неправильный', hash)).toBe(false);
  });

  it('юникодный пароль проходит полный цикл', async () => {
    const hash = await hashPassword('пароль-🔐-яёż');
    expect(await comparePassword('пароль-🔐-яёż', hash)).toBe(true);
    expect(await comparePassword('пароль-яёż', hash)).toBe(false);
  });

  it('чужой формат хэша — false, без исключений', async () => {
    expect(await comparePassword('пароль', 'bcrypt$abcdef')).toBe(false);
    expect(await comparePassword('пароль', '$$$$')).toBe(false);
    expect(await comparePassword('пароль', '')).toBe(false);
  });

  it('пустой пароль — false', async () => {
    const hash = await hashPassword('нормальный');
    expect(await comparePassword('', hash)).toBe(false);
  });

  it('число итераций читается ИЗ хэша: хэш с 1000 итераций проверяется', async () => {
    const hash = await makeHashWithIterations('старый-пароль', 1000);
    expect(hash).toContain('pbkdf2$1000$');
    expect(await comparePassword('старый-пароль', hash)).toBe(true);
    expect(await comparePassword('другой', hash)).toBe(false);
  });

  it('мусор в поле итераций — fallback на ITERATIONS (20000)', async () => {
    const good = await makeHashWithIterations('пароль', 20000);
    const parts = good.split('$');
    const broken = ['pbkdf2', 'не-число', parts[2]!, parts[3]!].join('$');
    expect(await comparePassword('пароль', broken)).toBe(true);
  });
});
