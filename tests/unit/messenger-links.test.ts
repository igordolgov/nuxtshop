// Тесты shared/messengerLinks.ts — глубокие ссылки на мессенджеры
// из пары { name, handle } карточки «Контакты».
import { describe, expect, it } from 'vitest';
import { messengerLink } from '../../shared/messengerLinks';

describe('messengerLink', () => {
  it('Telegram: @ник, голый ник и готовая t.me-ссылка → https://t.me/<ник>', () => {
    expect(messengerLink('Telegram', '@nuxtshop')).toBe('https://t.me/nuxtshop');
    expect(messengerLink('Telegram', 'shop_official')).toBe('https://t.me/shop_official');
    expect(messengerLink('Telegram', 't.me/nuxtshop')).toBe('https://t.me/nuxtshop');
    expect(messengerLink('Telegram', 'https://t.me/nuxtshop')).toBe('https://t.me/nuxtshop');
    expect(messengerLink('telegram', 'https://telegram.me/nuxtshop')).toBe(
      'https://telegram.me/nuxtshop',
    );
  });

  it('WhatsApp: телефон в любом формате → wa.me с 7-кодом', () => {
    expect(messengerLink('WhatsApp', '+7 800 555-35-35')).toBe('https://wa.me/78005553535');
    expect(messengerLink('WhatsApp', '8 999 123-45-67')).toBe('https://wa.me/79991234567');
    expect(messengerLink('whatsapp', '78005553535')).toBe('https://wa.me/78005553535');
  });

  it('Viber: телефон → viber://chat с закодированным плюсом', () => {
    expect(messengerLink('Viber', '+7 800 555-35-35')).toBe('viber://chat?number=%2B78005553535');
  });

  it('VK: vk.com/…, @ник и голый ник → https://vk.com/<ник>', () => {
    expect(messengerLink('VK', 'vk.com/nuxtshop')).toBe('https://vk.com/nuxtshop');
    expect(messengerLink('VK', '@club123')).toBe('https://vk.com/club123');
    expect(messengerLink('VK', 'nuxt.shop')).toBe('https://vk.com/nuxt.shop');
    expect(messengerLink('ВКонтакте', 'vk.ru/nuxtshop')).toBe('https://vk.com/nuxtshop');
  });

  it('Готовый http(s)-админом URL не перекодируется', () => {
    expect(messengerLink('Telegram', 'https://t.me/s/nuxtshop?topic=1')).toBe(
      'https://t.me/s/nuxtshop?topic=1',
    );
    expect(messengerLink('Незнакомец', 'https://example.com/chat')).toBe(
      'https://example.com/chat',
    );
  });

  it('Нераспознанный мессенджер с телефоном → tel:, без — null', () => {
    expect(messengerLink('Максим', '+7 800 555-35-35')).toBe('tel:+78005553535');
    expect(messengerLink('Максим', '@nuxtshop')).toBeNull();
  });

  it('Мусор и пустышки → null', () => {
    expect(messengerLink('Telegram', '')).toBeNull();
    expect(messengerLink('Telegram', '   ')).toBeNull();
    expect(messengerLink('Telegram', '@a')).toBeNull(); // слишком короткий ник
    expect(messengerLink('WhatsApp', '123')).toBeNull(); // не телефон
    expect(messengerLink('VK', 'vk.com/')).toBeNull(); // пустой путь
    expect(messengerLink('', '')).toBeNull();
    expect(messengerLink(undefined, undefined)).toBeNull();
  });
});
