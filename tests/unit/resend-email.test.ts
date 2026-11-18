// Тесты email-канала back-in-stock (Resend): чистые генераторы письма
// (тема/HTML/текст) и отправка sendRestockEmail с моком fetch — файл
// самодостаточный, реальный сетевой вызов не выполняется.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isEmailContact,
  isResendConfigured,
  restockEmailHtml,
  restockEmailSubject,
  restockEmailText,
  sendRestockEmail,
  type ResendEnv,
} from '../../server/lib/resendEmail';

const ENV_OK: ResendEnv = {
  RESEND_API_KEY: 're_test_key',
  RESEND_FROM: 'Магазин <noreply@shop.example>',
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const PAYLOAD = { name: 'Товар', price: '1 000 ₽', url: 'https://shop.dev/tovar' };

describe('isResendConfigured / isEmailContact', () => {
  it('конфиг: нужны И ключ, И адрес отправителя', () => {
    expect(isResendConfigured(ENV_OK)).toBe(true);
    expect(isResendConfigured({ RESEND_API_KEY: 're_x' })).toBe(false); // нет FROM
    expect(isResendConfigured({ RESEND_FROM: 'a@b.c' })).toBe(false); // нет ключа
    expect(isResendConfigured({})).toBe(false);
    expect(isResendConfigured(null)).toBe(false);
    expect(isResendConfigured(undefined)).toBe(false);
  });

  it('email-контакт: наличие @, пустые/телефоны — false', () => {
    expect(isEmailContact('ivan@x.ru')).toBe(true);
    expect(isEmailContact('IVAN@X.RU')).toBe(true);
    expect(isEmailContact('+7 999 123-45-67')).toBe(false);
    expect(isEmailContact('')).toBe(false);
    expect(isEmailContact(null)).toBe(false);
    expect(isEmailContact(undefined)).toBe(false);
  });
});

describe('restockEmailSubject', () => {
  it('тема с названием товара', () => {
    expect(restockEmailSubject('Кроссовки')).toBe('Товар снова в наличии — «Кроссовки»');
  });

  it('переносы в названии вырезаются (subject — однострочный)', () => {
    expect(restockEmailSubject('Часы\nX — <b>Pro</b>\r\n2026')).toBe(
      'Товар снова в наличии — «Часы X — <b>Pro</b> 2026»',
    );
    expect(restockEmailSubject('')).toBe('Товар снова в наличии — «»');
  });
});

describe('restockEmailHtml / restockEmailText', () => {
  it('HTML: экранирование имени, ссылка-кнопка, цена', () => {
    const html = restockEmailHtml({
      name: 'Наушники <Pro> & Co',
      price: '2 500 ₽',
      url: 'https://shop.dev/p?x=1&y=2',
    });
    expect(html).toContain('«Наушники &lt;Pro&gt; &amp; Co»');
    expect(html).toContain('href="https://shop.dev/p?x=1&y=2"');
    expect(html).toContain('2 500 ₽');
    expect(html).toContain('Перейти к товару');
    // служебный HTML не экранируется (теги на месте)
    expect(html).toContain('<a ');
  });

  it('HTML без цены: строка цены не выводится', () => {
    const html = restockEmailHtml({ name: 'Товар', url: 'https://shop.dev/t' });
    expect(html).not.toContain(' — <b');
  });

  it('Текст: название, цена, ссылка', () => {
    const text = restockEmailText(PAYLOAD);
    expect(text).toContain('«Товар» — 1 000 ₽');
    expect(text).toContain('https://shop.dev/tovar');
    expect(text).toContain('сообщить о поступлении');
  });
});

describe('sendRestockEmail', () => {
  it('успех: POST на api.resend.com с Bearer-ключом, from/to/subject/html/text', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'email-1' }), { status: 200 }));

    await expect(sendRestockEmail(ENV_OK, 'ivan@x.ru', PAYLOAD)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer re_test_key');

    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.from).toBe('Магазин <noreply@shop.example>');
    expect(body.to).toEqual(['ivan@x.ru']);
    expect(body.subject).toBe('Товар снова в наличии — «Товар»');
    expect(String(body.html)).toContain('href="https://shop.dev/tovar"');
    expect(String(body.text)).toContain('«Товар»');
  });

  it('ошибка API (4xx/5xx): false, тело ошибки залогировано', async () => {
    fetchMock.mockResolvedValue(new Response('{"message":"Domain not verified"}', { status: 403 }));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(sendRestockEmail(ENV_OK, 'ivan@x.ru', PAYLOAD)).resolves.toBe(false);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[resend] send failed: 403'));
    errSpy.mockRestore();
  });

  it('сетевой сбой fetch: false, не бросает исключение', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(sendRestockEmail(ENV_OK, 'ivan@x.ru', PAYLOAD)).resolves.toBe(false);
    errSpy.mockRestore();
  });

  it('не настроен Resend / пустой адрес: false без вызова fetch', async () => {
    await expect(sendRestockEmail({}, 'ivan@x.ru', PAYLOAD)).resolves.toBe(false);
    await expect(sendRestockEmail(null, 'ivan@x.ru', PAYLOAD)).resolves.toBe(false);
    await expect(sendRestockEmail(ENV_OK, '', PAYLOAD)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
