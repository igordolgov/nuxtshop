// Тесты app/utils/productImage.ts — srcset миниатюр каталога.
import { describe, expect, it } from 'vitest';
import { productSrcset, withImageFormat } from '../../app/utils/productImage';

describe('productSrcset — 400w+800w для локальных фото каталога', () => {
  it('локальный путь /images/products/<id>.webp → srcset с small/ и 800w', () => {
    const url = '/images/products/photo-1481627834876-b7833e8f5570.webp';
    expect(productSrcset(url)).toBe(
      '/images/products/small/photo-1481627834876-b7833e8f5570.webp 400w, ' +
        '/images/products/photo-1481627834876-b7833e8f5570.webp 800w',
    );
  });

  it('data-URI, /api/images/*, плейсхолдер и внешние URL → undefined', () => {
    expect(productSrcset('data:image/webp;base64,AAAA')).toBeUndefined();
    expect(productSrcset('/api/images/products/product-123-abcd.webp')).toBeUndefined();
    expect(productSrcset('/images/placeholder.jpg')).toBeUndefined();
    expect(productSrcset('https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=500')).toBeUndefined();
    expect(productSrcset('/images/products/evil-../../etc.webp')).toBeUndefined();
  });

  it('мусор на входе → undefined, атрибут не выводится', () => {
    expect(productSrcset(null)).toBeUndefined();
    expect(productSrcset(undefined)).toBeUndefined();
    expect(productSrcset(42)).toBeUndefined();
    expect(productSrcset('')).toBeUndefined();
  });
});

describe('withImageFormat — регресс: q=75 остаётся строкой', () => {
  it('добавляет auto=format и q=75 к unsplash-URL', () => {
    const out = withImageFormat('https://images.unsplash.com/photo-1?w=500');
    expect(out).toContain('auto=format');
    expect(out).toContain('q=75');
  });
});
