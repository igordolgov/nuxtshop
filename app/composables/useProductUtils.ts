// app/composables/useProductUtils.ts
// Валюта витрины — из конфига (₽ / $, позиция и числовой формат там же)
import {
  CURRENCY_AFTER,
  CURRENCY_NUMBER_LOCALE,
  CURRENCY_SYMBOL,
  STORE_CURRENCY,
} from '../../store.config';

const NO_IMAGE = '/images/no-image.svg';

// Форматтер цены — модульный singleton: конструктор Intl.NumberFormat
// дорогой, а formatPrice/formatMoney вызываются на КАЖДОЙ карточке
// каталога (30+ раз только на гидрации главной; локаль/валюта —
// константы build'а из store.config, реактивности не требуют)
const priceFormatter = new Intl.NumberFormat(CURRENCY_NUMBER_LOCALE[STORE_CURRENCY] ?? 'ru-RU');

export const useProductUtils = () => {
  /**
   * Возвращает URL картинки или заглушку.
   * Внешние плейсхолдеры (placeholder.com и т.п.) заменяются на локальную заглушку.
   */
  const getSafeImage = (url?: unknown): string => {
    if (!url) return NO_IMAGE;
    if (typeof url !== 'string') return NO_IMAGE;
    if (url.includes('placeholder.com')) return NO_IMAGE;
    if (url.includes('via.placeholder.com')) return NO_IMAGE;
    return url;
  };

  /**
   * Форматирование цены для каталога (БЕЗ валюты, компактно).
   * Символ валюты клеит formatMoney — в шаблонах руками ₽/$ не писать
   * (аудит F13: вторая реализация с валютой давала «₽ ₽»).
   */
  const formatPrice = (price: number): string => priceFormatter.format(price);

  /** Символ активной валюты витрины ('₽' / '$') — для подписей-плейсхолдеров. */
  const currencySymbol = (): string => CURRENCY_SYMBOL[STORE_CURRENCY] ?? STORE_CURRENCY;

  /**
   * Цена с валютой одной строкой: '1 234 ₽' (RUB) / '$1,234' (USD).
   * Единый вывод цен в шаблонах: formatPrice(x) + ' ₽' → formatMoney(x).
   */
  const formatMoney = (price: number): string => {
    const n = formatPrice(price);
    const s = currencySymbol();
    return CURRENCY_AFTER[STORE_CURRENCY] ? `${n} ${s}` : `${s}${n}`;
  };

  return {
    getSafeImage,
    formatPrice,
    formatMoney,
    currencySymbol,
    NO_IMAGE,
  };
};
