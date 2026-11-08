// Тесты shared/cupRates.ts — парс ответа TRMI elTOQUE и формат CUP.
// Роут /api/rates на Cloudflare в тестах недоступен, поэтому проверяется
// чистая логика: валидация payload, обязательный USD, время Ла-Гаваны → ISO,
// фолбэк при отсутствующем времени и форматирование эквивалента.
import { describe, expect, it } from 'vitest';
import { formatCupAmount, parseTrmiResponse } from '../../shared/cupRates';

// Реальный ответ API (усечённый): 2026-11-08 17:45:22 по Ла-Гаване
const REAL_PAYLOAD = {
  date: '2026-11-08',
  hour: 17,
  minutes: 45,
  seconds: 22,
  tasas: { BNB: 450.0, BTC: 796.07, ECU: 1015.0, MLC: 726.72, TRX: 374.31, USD: 930.0 },
};

describe('parseTrmiResponse — валидный payload', () => {
  it('извлекает USD и все ставки, время Ла-Гаваны → ISO UTC−5', () => {
    const res = parseTrmiResponse(REAL_PAYLOAD);
    expect(res).toMatchObject({
      available: true,
      usd: 930,
      updatedAt: '2026-11-08T22:45:22Z',
      updatedAtText: '2026-11-08 17:45:22',
    });
    if (res.available) {
      expect(res.rates.MLC).toBe(726.72);
      expect(res.rates.ECU).toBe(1015);
    }
  });

  it('медианы приходят дробными: usd сохраняет дробь как есть', () => {
    const res = parseTrmiResponse({ ...REAL_PAYLOAD, tasas: { USD: 930.5 } });
    expect(res.available && res.usd).toBe(930.5);
  });

  it('без времени (нет date/hour/...) — ставка есть, строки времени пустые', () => {
    const res = parseTrmiResponse({ tasas: { USD: 400 } });
    expect(res).toMatchObject({
      available: true,
      usd: 400,
      updatedAt: '',
      updatedAtText: '',
    });
  });

  it('нечисловые/отрицательные ставки отбрасываются, валидные остаются', () => {
    const res = parseTrmiResponse({ tasas: { USD: 500, EUR: 'abc', BAD: -5, ZERO: 0 } });
    expect(res.available && res.rates).toEqual({ USD: 500 });
  });
});

describe('parseTrmiResponse — битые payload', () => {
  it('нет tasas / не объект → bad_payload', () => {
    expect(parseTrmiResponse(null)).toEqual({ available: false, reason: 'bad_payload' });
    expect(parseTrmiResponse({})).toEqual({ available: false, reason: 'bad_payload' });
    expect(parseTrmiResponse({ tasas: '930' })).toEqual({
      available: false,
      reason: 'bad_payload',
    });
  });

  it('нет USD (набор валют плавает) → bad_payload', () => {
    expect(parseTrmiResponse({ tasas: { MLC: 726.72 } })).toEqual({
      available: false,
      reason: 'bad_payload',
    });
  });

  it('USD = 0 или NaN → bad_payload', () => {
    expect(parseTrmiResponse({ tasas: { USD: 0 } }).available).toBe(false);
    expect(parseTrmiResponse({ tasas: { USD: NaN } }).available).toBe(false);
  });

  it('кривое время (25 часов, 61 минута) → без строк времени, но со ставкой', () => {
    const res = parseTrmiResponse({
      date: '2026-11-08',
      hour: 25,
      minutes: 61,
      seconds: 99,
      tasas: { USD: 930 },
    });
    expect(res.available && res.updatedAtText).toBe('');
    expect(res.available && res.updatedAt).toBe('');
  });
});

describe('formatCupAmount', () => {
  // es-CU в ICU: разделитель групп — ',' (см. '93,000'). Сравниваем цифры,
  // выкидывая все разделители — их вид не часть контракта
  const digits = (s: string) => s.replace(/[\s\u00A0.,]/g, '');

  it('пересчёт по ставке: $100 × 930 = ≈ 93 000 CUP', () => {
    expect(digits(formatCupAmount(100, 930))).toBe('≈93000CUP');
  });

  it('округление до целых песо: $9.99 × 930.5', () => {
    // 9.99 * 930.5 = 9295.695 → 9296
    expect(digits(formatCupAmount(9.99, 930.5))).toBe('≈9296CUP');
  });

  it('нулевые/битые аргументы не дают мусора', () => {
    expect(digits(formatCupAmount(0, 930))).toBe('≈0CUP');
    expect(digits(formatCupAmount(100, NaN))).toBe('≈0CUP');
    expect(digits(formatCupAmount(Number.NaN, 930))).toBe('≈0CUP');
  });
});
