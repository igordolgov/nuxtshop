// Тесты server/lib/cache.ts — TTL-кэш изолята: попадания/промахи, TTL,
// single-flight при параллельных запросах, клонирование, инвалидация.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheClear, cacheInvalidate, cacheStats, cached } from '../../server/lib/cache';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  cacheClear();
});

describe('cached — попадания и промахи', () => {
  it('промах вызывает loader и кэширует результат', async () => {
    const loader = vi.fn(async () => ({ n: 1 }));
    expect(await cached('k', 1000, loader)).toEqual({ n: 1 });
    expect(await cached('k', 1000, loader)).toEqual({ n: 1 });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cacheStats().misses).toBe(1);
    expect(cacheStats().hits).toBe(1);
  });

  it('истёкший TTL — повторное чтение', async () => {
    const loader = vi.fn(async () => ['v']);
    await cached('ttl', 30, loader);
    await sleep(60);
    await cached('ttl', 30, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('ttl 0 — кэш не запоминается', async () => {
    const loader = vi.fn(async () => 42);
    await cached('zero', 0, loader);
    await cached('zero', 0, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('ошибка loader не кэшируется и пробрасывается', async () => {
    const loader = vi.fn(async () => {
      throw new Error('kv недоступен');
    });
    await expect(cached('err', 1000, loader)).rejects.toThrow('kv недоступен');
    await expect(cached('err', 1000, loader)).rejects.toThrow('kv недоступен');
    expect(loader).toHaveBeenCalledTimes(2);
    expect(cacheStats().size).toBe(0);
  });
});

describe('cached — single-flight', () => {
  it('5 параллельных запросов при холодном кэше — один вызов loader', async () => {
    let release!: (v: string[]) => void;
    const loader = vi.fn(
      () =>
        new Promise<string[]>((resolve) => {
          release = resolve;
        }),
    );
    const all = Promise.all(
      Array.from({ length: 5 }, () => cached('flight', 1000, loader)),
    );
    await sleep(10);
    release(['x']);
    const results = await all;
    expect(loader).toHaveBeenCalledTimes(1);
    expect(results).toEqual([['x'], ['x'], ['x'], ['x'], ['x']]);
    expect(cacheStats().misses).toBe(1);
  });

  it('ошибка полёта видна всем ожидающим', async () => {
    let reject!: (e: Error) => void;
    const loader = vi.fn(
      () =>
        new Promise<never>((_resolve, rej) => {
          reject = rej;
        }),
    );
    const all = Promise.allSettled([
      cached('flight-err', 1000, loader),
      cached('flight-err', 1000, loader),
    ]);
    await sleep(10);
    reject(new Error('падение'));
    const results = await all;
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe('cached — клонирование', () => {
  it('мутация результата не портит кэш', async () => {
    const loader = vi.fn(async () => [{ id: 1 }, { id: 2 }]);
    const first = await cached('arr', 1000, loader);
    first.sort(() => -1); // вызывающий сортирует как хочет
    first.pop();
    const second = await cached('arr', 1000, loader);
    expect(second.map((p) => p.id)).toEqual([1, 2]);
  });

  it('результаты — независимые копии (не один объект)', async () => {
    const loader = vi.fn(async () => ({ list: [1] }));
    const a = await cached('ref', 1000, loader);
    const b = await cached('ref', 1000, loader);
    a.list.push(2);
    expect(b.list).toEqual([1]);
  });
});

describe('cacheInvalidate / cacheClear', () => {
  it('инвалидация по префиксу удаляет только свои ключи', async () => {
    const loader = vi.fn(async (v: string) => v);
    await cached('products:all', 1000, () => loader('a'));
    await cached('users:all', 1000, () => loader('b'));
    expect(cacheInvalidate('products:')).toBe(1);
    expect(cacheStats().size).toBe(1); // users:all остался
    // products перечитывается, users — из кэша
    await cached('products:all', 1000, () => loader('a2'));
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it('cacheClear сбрасывает кэш и счётчики', async () => {
    const loader = vi.fn(async () => 1);
    await cached('k', 1000, loader);
    cacheClear();
    expect(cacheStats()).toEqual({ hits: 0, misses: 0, size: 0 });
    await cached('k', 1000, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
