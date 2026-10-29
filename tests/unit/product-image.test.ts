// Тесты app/utils/productImage.ts — нормализация URL картинок:
// auto=format + q=75 для Unsplash (WebP/AVIF вместо JPEG), чужие
// домены и локальные пути не трогаем.
import { describe, expect, it } from 'vitest';

import { withImageFormat } from '../../app/utils/productImage';

describe('withImageFormat', () => {
  it('добавляет auto=format и q=75 к URL Unsplash без параметров', () => {
    const result = withImageFormat('https://images.unsplash.com/photo-123');
    expect(result).toBe('https://images.unsplash.com/photo-123?auto=format&q=75');
  });

  it('сохраняет существующие параметры ресайза и дополняет недостающие', () => {
    const result = withImageFormat(
      'https://images.unsplash.com/photo-123?w=500&h=400&fit=crop',
    );
    expect(result).toContain('w=500');
    expect(result).toContain('h=400');
    expect(result).toContain('fit=crop');
    expect(result).toContain('auto=format');
    expect(result).toContain('q=75');
  });

  it('не дублирует уже заданные auto/q', () => {
    const result = withImageFormat('https://images.unsplash.com/photo-123?auto=format&q=80');
    expect(result).toBe('https://images.unsplash.com/photo-123?auto=format&q=80');
  });

  it('не трогает чужие домены', () => {
    const url = 'https://example.com/photo-123?w=500';
    expect(withImageFormat(url)).toBe(url);
  });

  it('не трогает локальные пути', () => {
    expect(withImageFormat('/images/products/photo.webp')).toBe('/images/products/photo.webp');
  });

  it('некорректный URL возвращает как есть, без исключения', () => {
    expect(withImageFormat('::broken::')).toBe('::broken::');
  });
});
