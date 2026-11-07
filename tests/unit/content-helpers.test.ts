// Тесты shared/siteContent.ts и server/lib/contentHelpers.ts — валидация
// sanitizeSiteContent (сообщения ошибок), normalizePhoneHref, mergeSiteContent
// (достраивание до полной формы, сохранение updatedAt) и roundtrip KV
// readContent/writeContent.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Мок KV (тот же паттерн, что в news-helpers.test.ts) ────────────────
const kvStore = new Map<string, unknown>();

vi.mock('../../server/lib/storage', () => ({
  kvGetJSON: vi.fn(async (_event: unknown, key: string) => {
    const stored = kvStore.get(key);
    return stored === undefined ? null : (structuredClone(stored) as unknown);
  }),
  kvPutJSON: vi.fn(async (_event: unknown, key: string, value: unknown) => {
    kvStore.set(key, structuredClone(value));
  }),
  kvDelete: vi.fn(async (_event: unknown, key: string) => {
    kvStore.delete(key);
  }),
}));

import {
  CONTENT_LIMITS,
  DEFAULT_SITE_CONTENT,
  ContentValidationError,
  mergeSiteContent,
  normalizePhoneHref,
  sanitizeSiteContent,
} from '../../shared/siteContent';
import { CONTENT_KEY, readContent, writeContent } from '../../server/lib/contentHelpers';

const EVENT = {} as never;

const validPayload = {
  contacts: {
    phone: ' 8 (800) 555-35-35 ',
    email: 'hi@shop.ru',
    hoursWeek: '9:00–20:00',
    hoursWeekend: 'выходной',
    mapSrc: '',
    messengers: [
      { name: ' Telegram ', handle: ' @shop ' },
      { name: '', handle: '' }, // пустая строка формы — пропускается
    ],
    stores: [
      {
        city: 'Москва',
        badge: 'Флагман',
        address: 'ул. Тверская, 12',
        hours: '10:00–21:00',
        phone: '8 (495) 000-00-00',
      },
    ],
    faq: [{ q: 'Как быстро доставляете?', a: 'За один день.' }],
  },
  about: {
    stats: [{ value: '8 лет', label: 'на рынке' }],
    history: [{ year: '2026', text: 'Запустили редактор контента.' }],
  },
};

beforeEach(() => {
  kvStore.clear();
});

describe('normalizePhoneHref', () => {
  it('8-ка в 11-значном номере → +7', () => {
    expect(normalizePhoneHref('8 (800) 555-35-35')).toBe('+78005553535');
    expect(normalizePhoneHref('84951234567')).toBe('+74951234567');
  });

  it('+7 и прочие форматы остаются валидными tel:-ссылками', () => {
    expect(normalizePhoneHref('+7 495 123-45-67')).toBe('+74951234567');
    expect(normalizePhoneHref('555-35-35')).toBe('+5553535');
  });
});

describe('sanitizeSiteContent', () => {
  it('валидирует payload: тримминг, пропуск пустых строк, ISO updatedAt', () => {
    const clean = sanitizeSiteContent(validPayload);
    expect(clean.contacts.phone).toBe('8 (800) 555-35-35');
    expect(clean.contacts.messengers).toEqual([{ name: 'Telegram', handle: '@shop' }]);
    expect(clean.contacts.stores).toHaveLength(1);
    expect(clean.contacts.faq).toHaveLength(1);
    expect(clean.about.stats).toHaveLength(1);
    expect(clean.about.history).toHaveLength(1);
    expect(new Date(clean.updatedAt).getTime()).not.toBeNaN();
  });

  it('отсутствующие поля берутся из дефолтов (частичный payload ничего не стирает)', () => {
    const clean = sanitizeSiteContent({
      contacts: { phone: '8 (800) 100-00-00', email: 'a@b.ru' },
    });
    expect(clean.contacts.stores).toEqual(DEFAULT_SITE_CONTENT.contacts.stores);
    expect(clean.contacts.faq).toEqual(DEFAULT_SITE_CONTENT.contacts.faq);
    expect(clean.about.stats).toEqual(DEFAULT_SITE_CONTENT.about.stats);
    expect(clean.about.history).toEqual(DEFAULT_SITE_CONTENT.about.history);
    expect(clean.contacts.hoursWeek).toBe(DEFAULT_SITE_CONTENT.contacts.hoursWeek);
  });

  it('пустой объект → ошибка обязательных полей (merge достроит до дефолтов)', () => {
    // PUT из формы всегда несёт phone/email; если админ стёр телефон —
    // сохранение отклоняется. Пустой KV на GET обрабатывает mergeSiteContent.
    expect(() => sanitizeSiteContent({})).toThrow(ContentValidationError);
    expect(() => sanitizeSiteContent({})).toThrow(/телефон/);
  });

  it('пустой телефон → ошибка', () => {
    expect(() => sanitizeSiteContent({ contacts: { phone: '   ', email: 'a@b.ru' } })).toThrow(
      ContentValidationError,
    );
  });

  it('кривой email → ошибка с внятным сообщением', () => {
    expect(() =>
      sanitizeSiteContent({ contacts: { phone: '8 (800) 555-35-35', email: 'не-почта' } }),
    ).toThrow(/корректный email/);
  });

  it('карта — только openstreetmap.org', () => {
    expect(() =>
      sanitizeSiteContent({
        contacts: {
          phone: '8 (800) 555-35-35',
          email: 'a@b.ru',
          mapSrc: 'https://maps.example.com/embed',
        },
      }),
    ).toThrow(/openstreetmap/);
  });

  it('переполнение списка → ошибка с лимитом', () => {
    const many = Array.from({ length: CONTENT_LIMITS.stores + 1 }, () => ({
      city: `Город ${Math.random()}`,
      address: 'адрес',
      phone: '8 (800) 000-00-00',
    }));
    expect(() =>
      sanitizeSiteContent({
        contacts: { phone: '8 (800) 555-35-35', email: 'a@b.ru', stores: many },
      }),
    ).toThrow(/Не больше 8/);
  });

  it('частично заполненная строка → ошибка с городом', () => {
    expect(() =>
      sanitizeSiteContent({
        contacts: {
          phone: '8 (800) 555-35-35',
          email: 'a@b.ru',
          stores: [{ city: 'Сочи', address: '', phone: '' }],
        },
      }),
    ).toThrow(/Сочи/);
  });

  it('пустые строки списка пропускаются; осознанно пустой список сохраняется пустым', () => {
    const clean = sanitizeSiteContent({
      contacts: {
        phone: '8 (800) 555-35-35',
        email: 'a@b.ru',
        messengers: [{ name: '', handle: '' }],
      },
    });
    // Пустая строка формы выкинута, а админ осознанно удалил остальных —
    // воскресать дефолты нельзя.
    expect(clean.contacts.messengers).toEqual([]);
  });

  it('undefined-список → дефолт, [] → пусто (различаем «не прислали» и «удалили всё»)', () => {
    const kept = sanitizeSiteContent({
      contacts: { phone: '8 (800) 555-35-35', email: 'a@b.ru' },
    });
    expect(kept.contacts.messengers).toEqual(DEFAULT_SITE_CONTENT.contacts.messengers);

    const emptied = sanitizeSiteContent({
      contacts: { phone: '8 (800) 555-35-35', email: 'a@b.ru', messengers: [] },
    });
    expect(emptied.contacts.messengers).toEqual([]);
  });
});

describe('mergeSiteContent', () => {
  it('null / мусор → дефолты (глубокая копия, мутации не портят DEFAULT)', () => {
    const originalPhone = DEFAULT_SITE_CONTENT.contacts.phone; // запомнили до мутаций
    const merged = mergeSiteContent(null);
    expect(merged).toEqual({ ...DEFAULT_SITE_CONTENT, updatedAt: '' });
    merged.contacts.phone = 'испортили';
    expect(DEFAULT_SITE_CONTENT.contacts.phone).toBe(originalPhone);

    expect(mergeSiteContent('строка')).toEqual({ ...DEFAULT_SITE_CONTENT, updatedAt: '' });
    expect(mergeSiteContent(42)).toEqual({ ...DEFAULT_SITE_CONTENT, updatedAt: '' });
  });

  it('частичную запись достраивает до полной формы', () => {
    const merged = mergeSiteContent({ contacts: { phone: '8 (800) 100-00-00', email: 'a@b.ru' } });
    expect(merged.contacts.phone).toBe('8 (800) 100-00-00');
    expect(merged.about.stats).toEqual(DEFAULT_SITE_CONTENT.about.stats);
    expect(merged.updatedAt).toBe('');
  });

  it('сохранённую запись отдаёт с исходным updatedAt (не «сейчас»)', () => {
    const savedAt = '2026-11-01T10:00:00.000Z';
    const clean = sanitizeSiteContent(validPayload);
    const merged = mergeSiteContent({ ...clean, updatedAt: savedAt });
    expect(merged.updatedAt).toBe(savedAt);
  });
});

describe('readContent / writeContent (KV roundtrip)', () => {
  it('пустое KV → дефолты, записи в KV нет (без самоисцеления)', async () => {
    const content = await readContent(EVENT);
    expect(content.contacts.phone).toBe(DEFAULT_SITE_CONTENT.contacts.phone);
    expect(kvStore.has(CONTENT_KEY)).toBe(false);
  });

  it('записали → прочитали то же самое', async () => {
    const clean = sanitizeSiteContent(validPayload);
    await writeContent(EVENT, clean);
    const back = await readContent(EVENT);
    expect(back.contacts.phone).toBe('8 (800) 555-35-35');
    expect(back.about.history).toHaveLength(1);
    expect(kvStore.get(CONTENT_KEY)).toBeTruthy();
  });

  it('writeContent отвергает не-объекты', async () => {
    await expect(writeContent(EVENT, null as never)).rejects.toThrow(/SiteContent/);
    await expect(writeContent(EVENT, 'строка' as never)).rejects.toThrow(/SiteContent/);
  });
});
