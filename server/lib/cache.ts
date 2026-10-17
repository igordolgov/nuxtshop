// server/lib/cache.ts
/**
 * In-memory TTL-кэш уровня изолята Cloudflare Workers.
 *
 * Зачем: изолят Workers обслуживает много запросов подряд, а чтение KV —
 * платная операция (лимиты бесплатного тарифа считаются за КАЖДОЕ чтение).
 * Кэш сокращает повторы вида «каждый запрос каталога = 1 чтение KV»
 * до «1 чтение за TTL на изолят».
 *
 * Свойства:
 * - TTL: запись живёт ttlMs миллисекунд, затем перечитывается loader'ом.
 * - Single-flight: параллельные запросы при холодном кэше делят ОДИН вызов
 *   loader'а (никаких N одновременных чтений KV).
 * - Клонирование: значения хранятся и выдаются через structuredClone,
 *   вызывающий может свободно мутировать полученное (sort/filter) —
 *   кэш не портится.
 * - Инвалидация по префиксу ключа для сценариев «записали — забыли».
 *
 * Ограничение честности: кэш живёт внутри одного изолята. После записи
 * в KV на другом изоляте изменения станут видны не позже TTL + окно
 * глобальной консистентности KV (~60 c). Поэтому TTL имеет смысл
 * держать не больше этого окна.
 */

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

const store = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();
const counters = { hits: 0, misses: 0 };

/** Глубокая копия (KV-данные — обычный JSON; structuredClone есть в Workers и Node 17+). */
function deepClone<T>(value: T): T {
  return typeof structuredClone === 'function' ? structuredClone(value) : value;
}

/**
 * Читает key из кэша; при промахе вызывает loader (один раз для всех
 * параллельных вызовов) и кэширует результат на ttlMs.
 * Возвращает глубокую копию — мутации результата не затрагивают кэш.
 */
export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = store.get(key);
  if (entry && entry.expiresAt > now) {
    counters.hits++;
    return deepClone(entry.value) as T;
  }

  const pending = inflight.get(key);
  if (pending) {
    // Повторный запрос уходит в полёт первого — своего чтения не делает.
    return deepClone(await pending) as T;
  }

  counters.misses++;
  const promise = (async () => {
    const value = await loader();
    store.set(key, { value: deepClone(value), expiresAt: Date.now() + ttlMs });
    return value;
  })();
  inflight.set(key, promise);

  try {
    return deepClone(await promise) as T;
  } finally {
    inflight.delete(key);
  }
}

/** Сбрасывает записи, ключи которых начинаются с prefix. Возвращает число удалённых. */
export function cacheInvalidate(prefix: string): number {
  let removed = 0;
  // Итератор Map корректно переживает удаление текущего элемента.
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      removed++;
    }
  }
  return removed;
}

/** Полный сброс кэша и счётчиков — для тестов. */
export function cacheClear(): void {
  store.clear();
  inflight.clear();
  counters.hits = 0;
  counters.misses = 0;
}

/** Счётчики попаданий/промахов и текущий размер — для /api/admin/stats. */
export function cacheStats(): CacheStats {
  return { hits: counters.hits, misses: counters.misses, size: store.size };
}
