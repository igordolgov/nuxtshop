// Тесты telegram-постинга новостей: formatNewsCard (текст поста) и
// sendNewsPost (no-op без секретов, успех при доставке хотя бы в один чат).
// formatNewsCard — чистая функция; sendNewsPost проверяется на моке fetch
// (callApi ходит в api.telegram.org через globalThis.fetch).
import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatNewsCard, sendNewsPost } from '../../server/lib/telegram';

const news = {
  id: '12',
  title: 'Осенняя распродажа <до> −25%',
  excerpt: 'Неделя скидок & бонусов',
  category: 'Акции',
};

describe('formatNewsCard', () => {
  it('рубрика, заголовок, excerpt и диплинк ?news=<id>', () => {
    const text = formatNewsCard(news, 'https://shop.example.ru');
    expect(text).toContain('Новая публикация');
    expect(text).toContain('Акции');
    expect(text).toContain('Осенняя распродажа &lt;до&gt; −25%');
    expect(text).toContain('Неделя скидок &amp; бонусов');
    expect(text).toContain('https://shop.example.ru/news?news=12');
  });

  it('хвостовые слэши origin срезаются, без excerpt — без лишних блоков', () => {
    const text = formatNewsCard({ ...news, excerpt: '' }, 'https://shop.example.ru///');
    expect(text).toContain('https://shop.example.ru/news?news=12');
    expect(text).not.toContain('&amp;');
    expect(text).not.toContain('undefined');
  });

  it('экранирует HTML: голые < > & из данных не ломают parse_mode', () => {
    const text = formatNewsCard(news, 'https://shop.example.ru');
    expect(text).not.toContain('<до>');
    expect(text).toContain('<b>');
  });
});

describe('sendNewsPost', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('без секретов — тихий no-op (false), fetch не зовётся', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(sendNewsPost({}, news, 'https://shop.example.ru')).resolves.toBe(false);
    await expect(sendNewsPost(null, news, 'https://shop.example.ru')).resolves.toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('доставлен хотя бы в один чат → true, сбой другого — не помеха', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init?: { body?: string }) => {
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ ok: true }), {
        status: String(body.chat_id) === '100' ? 200 : 500,
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const env = { TELEGRAM_BOT_TOKEN: 't', TELEGRAM_ADMIN_CHAT_ID: '100,200' };
    await expect(sendNewsPost(env, news, 'https://shop.example.ru')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('оба чата недоступны → false (новость при этом создаётся — на уровне API)', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    const env = { TELEGRAM_BOT_TOKEN: 't', TELEGRAM_ADMIN_CHAT_ID: '100' };
    await expect(sendNewsPost(env, news, 'https://shop.example.ru')).resolves.toBe(false);
  });
});
