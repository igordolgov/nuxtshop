// server/lib/password.ts
/**
 * PBKDF2-SHA256 через WebCrypto — нативно в Workers.
 * Формат: pbkdf2$<iterations>$<salt-b64>$<hash-b64>
 */
const ITERATIONS = 100_000;
// ⚠️ Free-план (10ms CPU): если логин падает с "exceeded CPU time limit" — снизь до 20_000.

const encoder = new TextEncoder();
const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') throw new Error('Пароль обязателен');
  if (password.length < 6) throw new Error('Пароль должен содержать минимум 6 символов');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function comparePassword(password: string, stored: string): Promise<boolean> {
  if (!password || !stored) return false;
  const [algo, iterations, saltB64, hashB64] = stored.split('$');
  if (algo !== 'pbkdf2' || !saltB64 || !hashB64) return false;
  const expected = fromB64(hashB64);
  const actual = await derive(password, fromB64(saltB64), Number(iterations) || ITERATIONS);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}
