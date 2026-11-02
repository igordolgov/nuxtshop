// Тесты app/composables/useActiveRoute.js — чистая логика matchActiveRoute /
// matchExactActiveRoute. localePath подменяется готовым локализованным путём:
// ru — без префикса ('/'), en — '/en', es — '/es' (strategy: prefix_except_default).
import { describe, expect, it } from 'vitest';
import { matchActiveRoute, matchExactActiveRoute } from '../../app/composables/useActiveRoute';

describe('matchActiveRoute — ru (localized корня = "/")', () => {
  it('«Главная» активна только на /', () => {
    expect(matchActiveRoute('/', '/', '/')).toBe(true);
    expect(matchActiveRoute('/favorites', '/', '/')).toBe(false);
    expect(matchActiveRoute('/news', '/', '/')).toBe(false);
    expect(matchActiveRoute('/admin/products', '/', '/')).toBe(false);
  });

  it('раздел активен на своей странице и вложенных', () => {
    expect(matchActiveRoute('/admin', '/admin', '/admin')).toBe(true);
    expect(matchActiveRoute('/admin/products', '/admin', '/admin')).toBe(true);
    expect(matchActiveRoute('/favorites', '/favorites', '/favorites')).toBe(true);
  });
});

describe('matchActiveRoute — en/es (localized корня = "/en", "/es")', () => {
  it('регрессия шапки: «Главная» активна только на /en, НЕ на всех страницах локали', () => {
    expect(matchActiveRoute('/en', '/en', '/')).toBe(true);
    // Наивный startsWith('/en') подсвечивал «Главную» на каждом из этих путей:
    expect(matchActiveRoute('/en/favorites', '/en', '/')).toBe(false);
    expect(matchActiveRoute('/en/news', '/en', '/')).toBe(false);
    expect(matchActiveRoute('/en/admin/products', '/en', '/')).toBe(false);
    expect(matchActiveRoute('/es', '/es', '/')).toBe(true);
    expect(matchActiveRoute('/es/admin/products', '/es', '/')).toBe(false);
  });

  it('раздел активен на локализованных вложенных путях', () => {
    expect(matchActiveRoute('/en/admin', '/en/admin', '/admin')).toBe(true);
    expect(matchActiveRoute('/en/admin/products', '/en/admin', '/admin')).toBe(true);
    expect(matchActiveRoute('/en/favorites', '/en/favorites', '/favorites')).toBe(true);
    expect(matchActiveRoute('/es/cart', '/es/cart', '/cart')).toBe(true);
  });

  it('граница префикса — по сегменту (/en/administrator не подсвечивает /admin)', () => {
    expect(matchActiveRoute('/en/administrator', '/en/admin', '/admin')).toBe(false);
    expect(matchActiveRoute('/administrator', '/admin', '/admin')).toBe(false);
  });
});

describe('matchExactActiveRoute', () => {
  it('только точное совпадение с локализованным путём', () => {
    expect(matchExactActiveRoute('/en', '/en')).toBe(true);
    expect(matchExactActiveRoute('/', '/')).toBe(true);
    expect(matchExactActiveRoute('/en/admin/products', '/en/admin')).toBe(false);
    expect(matchExactActiveRoute('/en/favorites', '/en/admin')).toBe(false);
  });
});
