// server/lib/password.ts
// Хэширование и проверка паролей: PBKDF2-SHA256 через WebCrypto.
// Выбран нативный crypto.subtle — работает в Cloudflare Workers без зависимостей
// (bcrypt на Free-плане не проходит по лимиту CPU и требует сторонний пакет).
// Формат хэша: pbkdf2$<iterations>$<salt-b64>$<hash-b64>
// Число итераций хранится В САМОМ ХЭШЕ, поэтому изменение ITERATIONS
// не ломает проверку старых хэшей (см. comparePassword) — механизм
// обратно совместим намеренно.

// ⚙️ НАСТРОЙКА: стоимость хэширования.
// 20_000 — безопасно для Free-плана Workers (лимит ~10ms CPU на запрос):
// 100_000 приводил к превышению лимита (хэш в сида users.json — след этого).
// При переезде на платный план можно поднять до 100_000 —
// существующие хэши останутся валидными без какой-либо миграции.
const ITERATIONS = 20_000;

const encoder = new TextEncoder();
// Uint8Array <-> base64 (в Workers нет Buffer, поэтому btoa/atob)
const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// Вывод 256 бит из пароля и соли
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

/**
 * Хэширует пароль в формат pbkdf2$<iterations>$<salt-b64>$<hash-b64>.
 * Валидация: непустая строка, минимум 6 символов.
 * ⚙️ НАСТРОЙКА: порог 6 символов синхронизирован со сниппетом в README.md.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') throw new Error('Пароль обязателен');
  if (password.length < 6) throw new Error('Пароль должен содержать минимум 6 символов');
  // Соль: 16 случайных байт на каждый хэш (защита от радужных таблиц)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

/**
 * Проверяет пароль против сохранённого хэша.
 * Число итераций читается из самого хэша — старые хэши с любой стоимостью
 * продолжают проверяться; fallback на ITERATIONS для битых/старых записей.
 * Сравнение constant-time (XOR всех байтов) — защита от timing-атак.
 * Любой чужой формат хэша трактуется как «неверный пароль», без исключений.
 */
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