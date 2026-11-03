// Тесты регистрации вебхука: setWebhook (payload: url + secret_token +
// allowed_updates; guard-ы без секретов) и getWebhookInfo (разбор WebhookInfo).
// Транспорт fetch мокается через vi.stubGlobal — как в telegram-news.test.ts.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getWebhookInfo, setWebhook } from '../../server/lib/telegram';

const env = {
  TELEGRAM_BOT_TOKEN: '123:abc',
  TELEGRAM_ADMIN_CHAT_ID: '-1001',
  TELEGRAM_WEBHOOK_SECRET: 's3cret_value',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('setWebhook', () => {
  it('шлёт url, secret_token и allowed_updates; description от Telegram пробрасывается', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, result: true, description: 'Webhook was set' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await setWebhook(env, 'https://shop.example.ru/api/telegram/webhook');

    expect(res.ok).toBe(true);
    expect(res.description).toBe('Webhook was set');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toContain('/bot123:abc/setWebhook');
    const payload = JSON.parse(String(init.body));
    expect(payload.url).toBe('https://shop.example.ru/api/telegram/webhook');
    expect(payload.secret_token).toBe('s3cret_value');
    expect(payload.allowed_updates).toEqual(['message', 'callback_query']);
  });

  it('без токена или секрета — ok:false, fetch не зовётся', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const noToken = await setWebhook({ ...env, TELEGRAM_BOT_TOKEN: undefined }, 'https://x');
    const noSecret = await setWebhook({ ...env, TELEGRAM_WEBHOOK_SECRET: undefined }, 'https://x');

    expect(noToken.ok).toBe(false);
    expect(noSecret.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('отказ Bot API (битый секрет) — ok:false с description от Telegram', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ ok: false, error_code: 400, description: 'Bad Request: bad secret token' }),
        { status: 400 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await setWebhook(env, 'https://x');
    expect(res.ok).toBe(false);
    expect(res.description).toBe('Bad Request: bad secret token');
  });

  it('не-JSON ответ (прокси/сеть) — ok:false без исключения', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>502</html>', { status: 502 })),
    );

    const res = await setWebhook(env, 'https://x');
    expect(res.ok).toBe(false);
    expect(res.description).toContain('502');
  });
});

describe('getWebhookInfo', () => {
  it('разбирает WebhookInfo: url, очередь, последняя ошибка', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          result: {
            url: 'https://shop.example.ru/api/telegram/webhook',
            pending_update_count: 2,
            last_error_date: 1700000000,
            last_error_message: 'Wrong response from the webhook',
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await getWebhookInfo(env);
    expect(res.ok).toBe(true);
    expect(res.result?.url).toBe('https://shop.example.ru/api/telegram/webhook');
    expect(res.result?.pending_update_count).toBe(2);
    expect(res.result?.last_error_message).toBe('Wrong response from the webhook');
  });

  it('без токена — ok:false, сеть не дёргается', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await getWebhookInfo({});
    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
