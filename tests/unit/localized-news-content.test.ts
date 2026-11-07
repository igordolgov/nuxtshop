// Тесты i18n-контента: localizedNews (app/utils/news.ts), переводы новостей
// в sanitizeNewsItem/applySanitizedNews (server/lib/newsHelpers.ts),
// localizedSiteContent (shared/siteContent.ts) и синхронность справочника
// скрипта scripts/news-content-translations.json с сидом и дефолтами
// (паттерн «copies are in sync» — дрейф справочника невозможен).
import { describe, expect, it, vi } from 'vitest';

// ─── Мок KV (как в news-helpers.test.ts) — newsHelpers импортирует storage ─
vi.mock('../../server/lib/storage', () => ({
  kvGetJSON: vi.fn(async () => null),
  kvPutJSON: vi.fn(async () => undefined),
  kvDelete: vi.fn(async () => undefined),
}));

import {
  applySanitizedNews,
  newsSeed,
  sanitizeNewsItem,
  type NewsItem,
} from '../../server/lib/newsHelpers';
import { localizedNews, NEWS_CATEGORY_KEYS } from '../../app/utils/news';
import {
  DEFAULT_SITE_CONTENT,
  localizedSiteContent,
  mergeSiteContent,
  sanitizeSiteContent,
} from '../../shared/siteContent';
import guide from '../../scripts/news-content-translations.json';

// ─── localizedNews (витрина новостей) ────────────────────────────────────

const baseNews: NewsItem = {
  id: '1',
  date: '2026-10-28',
  category: 'Акции',
  title: 'Русский заголовок',
  excerpt: 'Русский лид',
  body: ['Абзац 1', 'Абзац 2'],
  image: '',
};

describe('localizedNews', () => {
  it('ru — объект как есть (тот же референс, нулевые расходы)', () => {
    expect(localizedNews(baseNews, 'ru')).toBe(baseNews);
  });

  it('en/es — переводы подставляются в базовые поля', () => {
    const en = localizedNews(
      { ...baseNews, titleEn: 'English title', excerptEn: 'English lead', bodyEn: ['Para one'] },
      'en',
    );
    expect(en.title).toBe('English title');
    expect(en.excerpt).toBe('English lead');
    expect(en.body).toEqual(['Para one']);
    // исходные поля не тронуты (копия)
    expect(baseNews.title).toBe('Русский заголовок');

    const es = localizedNews(
      { ...baseNews, titleEs: 'Título', excerptEs: 'Resumen', bodyEs: ['Párrafo'] },
      'es',
    );
    expect(es.title).toBe('Título');
    expect(es.excerpt).toBe('Resumen');
    expect(es.body).toEqual(['Párrafo']);
  });

  it('нет перевода (или пустой/из пробелов) → фолбэк на русский', () => {
    const en = localizedNews({ ...baseNews, titleEn: '   ', excerptEn: '', bodyEn: [] }, 'en');
    expect(en.title).toBe('Русский заголовок');
    expect(en.excerpt).toBe('Русский лид');
    expect(en.body).toEqual(['Абзац 1', 'Абзац 2']);
  });

  it('body замещается только целиком: пустой перевод → русский список', () => {
    const en = localizedNews({ ...baseNews, bodyEn: ['', '   '] }, 'en');
    expect(en.body).toEqual(['Абзац 1', 'Абзац 2']);
  });

  it('переведён только title — excerpt/body остаются русскими', () => {
    const en = localizedNews({ ...baseNews, titleEn: 'Only title' }, 'en');
    expect(en.title).toBe('Only title');
    expect(en.excerpt).toBe('Русский лид');
    expect(en.body).toEqual(['Абзац 1', 'Абзац 2']);
  });

  it('null/undefined и неизвестная локаль — без падений', () => {
    expect(localizedNews(null, 'en')).toBeNull();
    expect(localizedNews(undefined, 'es')).toBeUndefined();
    expect(localizedNews(baseNews, 'fr')).toBe(baseNews);
  });
});

describe('NEWS_CATEGORY_KEYS', () => {
  it('рубрики и фильтр «Все» имеют ключи словаря', () => {
    expect(NEWS_CATEGORY_KEYS['Все']).toBe('all');
    expect(NEWS_CATEGORY_KEYS['Акции']).toBe('promo');
    expect(NEWS_CATEGORY_KEYS['Новинки']).toBe('new');
    expect(NEWS_CATEGORY_KEYS['Компания']).toBe('company');
    expect(NEWS_CATEGORY_KEYS['Обзоры']).toBe('reviews');
  });
});

// ─── Переводы в sanitizeNewsItem/applySanitizedNews ─────────────────────

const validPayload = {
  title: 'Тестовая новость про переводы',
  category: 'Новинки',
  date: '2026-11-01',
  excerpt: 'Лид новости',
  body: 'Абзац 1\n\nАбзац 2',
  image: '',
};

describe('sanitizeNewsItem: переводы', () => {
  it('непустые переводы триммятся и сохраняются', () => {
    const clean = sanitizeNewsItem({
      ...validPayload,
      titleEn: '  English title  ',
      titleEs: 'Título',
      excerptEn: 'Lead',
      bodyEs: 'Párrafo uno\n\nPárrafo dos',
    });
    expect(clean.titleEn).toBe('English title');
    expect(clean.titleEs).toBe('Título');
    expect(clean.excerptEn).toBe('Lead');
    expect(clean.bodyEs).toEqual(['Párrafo uno', 'Párrafo dos']);
    // bodyEn не передан → null (не ставить)
    expect(clean.bodyEn).toBeNull();
    expect(clean.excerptEs).toBeNull();
  });

  it('пустые/пробельные переводы → null (удалить, фолбэк на русский)', () => {
    const clean = sanitizeNewsItem({
      ...validPayload,
      titleEn: '   ',
      excerptEs: '',
      bodyEn: ' \n \n ',
    });
    expect(clean.titleEn).toBeNull();
    expect(clean.excerptEs).toBeNull();
    expect(clean.bodyEn).toBeNull();
  });

  it('перевод не проходит лимиты базового поля: заголовок 120, лид 220', () => {
    const clean = sanitizeNewsItem({ ...validPayload, titleEn: 'x'.repeat(500) });
    expect(clean.titleEn).toBe('x'.repeat(120));
    const clean2 = sanitizeNewsItem({ ...validPayload, excerptEn: 'y'.repeat(500) });
    expect(clean2.excerptEn).toBe('y'.repeat(220));
  });

  it('слишком длинный абзац перевода — ошибка (как у базового body)', () => {
    expect(() => sanitizeNewsItem({ ...validPayload, bodyEn: 'x'.repeat(2001) })).toThrow(/2000/);
  });
});

describe('applySanitizedNews', () => {
  it('POST-семантика: null-переводы не попадают в новую запись', () => {
    const clean = sanitizeNewsItem(validPayload); // переводов в payload нет → все null
    const item = applySanitizedNews({ id: '12' } as NewsItem, clean);
    expect(item.title).toBe('Тестовая новость про переводы');
    expect(item).not.toHaveProperty('titleEn');
    expect(item).not.toHaveProperty('bodyEs');
  });

  it('PUT-семантика: null удаляет существующий перевод из записи', () => {
    const existing: NewsItem = {
      ...baseNews,
      titleEn: 'Old title',
      bodyEn: ['Old para'],
      productIds: ['1'],
    };
    const clean = sanitizeNewsItem({ ...validPayload, titleEn: 'New title' });
    const updated = applySanitizedNews(existing, clean);
    expect(updated.titleEn).toBe('New title'); // заменился
    expect(updated).not.toHaveProperty('bodyEn'); // null → удалён
    // productIds присутствует в sanitize-результате всегда (админка шлёт
    // список целиком): пустой payload → пустой массив (поведение PUT до i18n)
    expect(updated.productIds).toEqual([]);
  });

  it('базовые поля обновляются, id сохраняется', () => {
    const existing: NewsItem = { ...baseNews, id: '7' };
    const clean = sanitizeNewsItem(validPayload);
    const updated = applySanitizedNews(existing, clean);
    expect(updated.id).toBe('7');
    expect(updated.title).toBe('Тестовая новость про переводы');
    expect(updated.body).toEqual(['Абзац 1', 'Абзац 2']);
  });
});

// ─── localizedSiteContent (страницы «О магазине»/«Контакты») ────────────

describe('localizedSiteContent', () => {
  it('ru — объект как есть', () => {
    expect(localizedSiteContent(DEFAULT_SITE_CONTENT, 'ru')).toBe(DEFAULT_SITE_CONTENT);
  });

  it('en — переводы подставляются, телефон не переводится (механика на синтетической витрине)', () => {
    const content = {
      ...DEFAULT_SITE_CONTENT,
      contacts: {
        ...DEFAULT_SITE_CONTENT.contacts,
        stores: [
          {
            city: 'Москва',
            badge: 'Флагман',
            address: 'ул. Тверская, 12',
            hours: 'Ежедневно 10:00–21:00',
            phone: '+7 495 555-35-35',
            cityEn: 'Moscow',
            badgeEn: 'Flagship store',
            addressEn: '12 Tverskaya St.',
            hoursEn: 'Daily 10:00–21:00',
          },
        ],
        faq: [
          {
            q: 'Как быстро доставляете?',
            a: 'За один день.',
            qEn: 'How fast do you deliver?',
            aEn: 'In one day.',
          },
        ],
      },
      about: {
        stats: [
          { value: '8 лет', label: 'на рынке', valueEn: '8 years', labelEn: 'in the tech market' },
        ],
        history: [
          { year: '2018', text: 'Открыли магазин.', textEn: 'Opened our first electronics store.' },
        ],
      },
    };
    const loc = localizedSiteContent(content, 'en');
    expect(loc.contacts.stores[0].city).toBe('Moscow');
    expect(loc.contacts.stores[0].badge).toBe('Flagship store');
    expect(loc.contacts.stores[0].address).toBe('12 Tverskaya St.');
    expect(loc.contacts.stores[0].hours).toBe('Daily 10:00–21:00');
    expect(loc.contacts.stores[0].phone).toBe('+7 495 555-35-35'); // телефон не переводится
    expect(loc.contacts.faq[0].q).toBe('How fast do you deliver?');
    expect(loc.about.stats[0].value).toBe('8 years');
    expect(loc.about.stats[0].label).toBe('in the tech market');
    expect(loc.about.history[0].text).toContain('Opened our first electronics store');
    // исходник не мутирован
    expect(content.contacts.stores[0].city).toBe('Москва');
  });

  it('en/es на дефолтах кубинской копии — фолбэк на испанскую базу', () => {
    const en = localizedSiteContent(DEFAULT_SITE_CONTENT, 'en');
    expect(en.contacts.stores[0].city).toBe('La Habana');
    expect(en.contacts.faq[0].q).toBe(DEFAULT_SITE_CONTENT.contacts.faq[0].q);
    expect(en.contacts.stores[0].phone).toBe(DEFAULT_SITE_CONTENT.contacts.stores[0].phone);
    const es = localizedSiteContent(DEFAULT_SITE_CONTENT, 'es');
    expect(es.contacts.stores[1].city).toBe('Centro Habana');
    expect(es.about.stats[1].label).toBe('clientes satisfechos');
    expect(es.about.history[0].text).toContain('La Habana');
  });

  it('поэлементный фолбэк: нет перевода поля → базовый текст этого поля', () => {
    const partial = {
      ...DEFAULT_SITE_CONTENT,
      contacts: {
        ...DEFAULT_SITE_CONTENT.contacts,
        stores: [
          {
            city: 'Москва',
            badge: 'Флагман',
            address: 'ул. Тверская, 12',
            hours: '10:00–21:00',
            phone: '+7 495 000-00-00',
            cityEn: 'Moscow',
            badgeEn: '   ',
          },
        ],
      },
    };
    const loc = localizedSiteContent(partial, 'en');
    expect(loc.contacts.stores[0].city).toBe('Moscow');
    expect(loc.contacts.stores[0].badge).toBe('Флагман'); // фолбэк на базу
  });

  it('мессенджеры и карта проходят насквозь без изменений', () => {
    const loc = localizedSiteContent(DEFAULT_SITE_CONTENT, 'es');
    expect(loc.contacts.messengers).toEqual(DEFAULT_SITE_CONTENT.contacts.messengers);
    expect(loc.contacts.mapSrc).toBe(DEFAULT_SITE_CONTENT.contacts.mapSrc);
    expect(loc.contacts.phone).toBe(DEFAULT_SITE_CONTENT.contacts.phone);
  });
});

// ─── Переводы выживают sanitize/merge (KV-контракт) ─────────────────────

describe('sanitize/merge сохраняют переводы', () => {
  it('sanitizeSiteContent сохраняет переводы записей', () => {
    const clean = sanitizeSiteContent({
      contacts: {
        phone: '8 (800) 555-35-35',
        email: 'a@b.ru',
        stores: [
          {
            city: 'Москва',
            badge: 'Флагман',
            address: 'ул. Тверская, 12',
            hours: '10:00–21:00',
            phone: '8 (495) 000-00-00',
            cityEn: 'Moscow',
            badgeEs: 'Tienda insignia',
          },
        ],
        faq: [{ q: 'Вопрос?', a: 'Ответ.', qEn: 'Question?', aEs: 'Respuesta.' }],
      },
      about: {
        stats: [{ value: '8 лет', label: 'на рынке', valueEn: '8 years' }],
        history: [{ year: '2026', text: 'Событие.', textEs: 'Evento.' }],
      },
    });
    expect(clean.contacts.stores[0]).toMatchObject({
      cityEn: 'Moscow',
      badgeEs: 'Tienda insignia',
    });
    expect(clean.contacts.faq[0]).toMatchObject({ qEn: 'Question?', aEs: 'Respuesta.' });
    expect(clean.about.stats[0]).toMatchObject({ valueEn: '8 years' });
    expect(clean.about.history[0]).toMatchObject({ textEs: 'Evento.' });
  });

  it('пустые переводы не сохраняются (не превращаются в пустые строки)', () => {
    const clean = sanitizeSiteContent({
      contacts: {
        phone: '8 (800) 555-35-35',
        email: 'a@b.ru',
        stores: [
          {
            city: 'Казань',
            badge: 'Пункт выдачи',
            address: 'ул. Баумана, 58',
            hours: '10:00–20:00',
            phone: '8 (843) 000-00-00',
            cityEn: '   ',
          },
        ],
      },
    });
    expect(clean.contacts.stores[0]).not.toHaveProperty('cityEn');
  });

  it('mergeSiteContent (чтение из KV) сохраняет дефолты кубинской копии как есть', () => {
    const merged = mergeSiteContent(DEFAULT_SITE_CONTENT);
    // Кубинские дефолты — испанская база без суффиксов En/Es: merge не
    // добавляет переводов, витрина во всех локалях берёт испанскую базу
    expect(merged.contacts.stores[0].city).toBe(DEFAULT_SITE_CONTENT.contacts.stores[0].city);
    expect(merged.contacts.stores[0]).not.toHaveProperty('cityEn');
    expect(merged.contacts.stores[0]).not.toHaveProperty('cityEs');
    expect(merged.contacts.faq[0].a).toBe(DEFAULT_SITE_CONTENT.contacts.faq[0].a);
    expect(merged.about.history[3].text).toBe(DEFAULT_SITE_CONTENT.about.history[3].text);
  });
});

// ─── Синхронность справочника скрипта с сидом/дефолтами ─────────────────

const TEXT_FIELDS = ['titleEn', 'titleEs', 'excerptEn', 'excerptEs'] as const;
const LIST_FIELDS = ['bodyEn', 'bodyEs'] as const;

describe('справочник scripts/news-content-translations.json синхронен', () => {
  it('каждая новость сида покрыта справочником, значения совпадают', () => {
    for (const item of newsSeed) {
      const t = (guide.news as Record<string, Record<string, unknown>>)[item.id];
      expect(t, `нет записи справочника для новости id ${item.id}`).toBeTruthy();
      for (const field of TEXT_FIELDS) {
        expect(t[field], `${field} новости ${item.id}`).toBe(item[field]);
      }
      for (const field of LIST_FIELDS) {
        expect(t[field], `${field} новости ${item.id}`).toEqual(item[field]);
      }
    }
    expect(Object.keys(guide.news)).toHaveLength(newsSeed.length);
  });

  it('переводы сида совпадают со справочником и в обратную сторону', () => {
    // У всех новостей сида переводы заполнены (свежий KV сразу двуязычен)
    for (const item of newsSeed) {
      expect(item.titleEn, `titleEn новости ${item.id}`).toBeTruthy();
      expect(item.titleEs, `titleEs новости ${item.id}`).toBeTruthy();
      expect(item.bodyEn?.length, `bodyEn новости ${item.id}`).toBeGreaterThan(0);
      expect(item.bodyEs?.length, `bodyEs новости ${item.id}`).toBeGreaterThan(0);
    }
  });

  it('дефолты siteContent кубинской копии — испанская база без суффиксов', () => {
    const d = DEFAULT_SITE_CONTENT;
    // Кубинская копия не несёт En/Es-переводов контента: база испанская,
    // остальные локали показывают её через фолбэк localizedSiteContent.
    // Справочник scripts/news-content-translations.json на копию не
    // распространяется (его секция content относится к дефолтам main).
    const NO_FIELDS = {
      stores: [
        'cityEn',
        'cityEs',
        'badgeEn',
        'badgeEs',
        'addressEn',
        'addressEs',
        'hoursEn',
        'hoursEs',
      ],
      faq: ['qEn', 'aEn', 'qEs', 'aEs'],
      stats: ['valueEn', 'labelEn', 'valueEs', 'labelEs'],
      history: ['textEn', 'textEs'],
    } as const;
    for (const store of d.contacts.stores) {
      for (const field of NO_FIELDS.stores) expect(store, field).not.toHaveProperty(field);
    }
    for (const f of d.contacts.faq) {
      for (const field of NO_FIELDS.faq) expect(f, field).not.toHaveProperty(field);
    }
    for (const s of d.about.stats) {
      for (const field of NO_FIELDS.stats) expect(s, field).not.toHaveProperty(field);
    }
    for (const h of d.about.history) {
      for (const field of NO_FIELDS.history) expect(h, field).not.toHaveProperty(field);
    }
    // Испанская база на месте
    expect(d.contacts.stores[0].city).toBe('La Habana');
    expect(d.contacts.faq[0].q).toContain('¿');
  });
});
