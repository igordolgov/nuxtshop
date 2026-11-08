// app/composables/useCupRate.ts — эквивалент цен в CUP по курсу elTOQUE.
//
// Активен только когда SHOW_CUP_EQUIVALENT (кубинская копия): компоненты
// вызывают cupFor(usdAmount) и получают строку «≈ 46 500 CUP» либо null
// (флаг выключен, ставка ещё не пришла, /api/rates недоступен — строка
// просто не рендерится, без скелетонов и CLS-прыжков).
//
// Ставка качается ОДИН раз на страницу после гидратации (client-only):
// SSR не ждёт внешний API (10с таймаут роута не тормозит TTFB карточки),
// useState шарит ответ между всеми вызовами на странице (карточка +
// панель корзины спрашивают один /api/rates).
import { SHOW_CUP_EQUIVALENT } from '../../store.config';
import { formatCupAmount, type RatesResponse } from '#shared/cupRates';

// Один fetch на страницу, даже если useCupRate() вызван из нескольких
// компонентов: на карточке товара его зовут И ProductInfo (строка под
// ценой), И страница (нижняя кнопка «В корзину») — оба смонтируются
// с параллельными onMounted. Без guard — два /api/rates подряд.
// inflight — НА УРОВНЕ МОДУЛЯ: объявленный внутри композабла он свой
// у каждого экземпляра и ничего не дедуплицирует (проверено счётчиком
// на роуте: 2 хита вместо 1).
let inflight: Promise<void> | null = null;

export const useCupRate = () => {
  const payload = useState<RatesResponse | null>('cup-rate', () => null);

  const load = async (): Promise<void> => {
    if (!SHOW_CUP_EQUIVALENT || payload.value?.available) return;
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const res = await $fetch<RatesResponse>('/api/rates');
        if (res?.available) payload.value = res;
      } catch {
        // Курс недоступен (оффлайн/сбой) — тихо живём без строки CUP;
        // повторная попытка — на следующей навигации
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  };

  if (SHOW_CUP_EQUIVALENT && import.meta.client) {
    onMounted(() => {
      load();
    });
  }

  /**
   * Строка эквивалента для суммы в валюте витрины (USD):
   * '≈ 46 500 CUP' или null, если показывать нечего.
   */
  const cupFor = (amount: number | null | undefined): string | null => {
    if (!SHOW_CUP_EQUIVALENT || !amount || amount <= 0) return null;
    const rate = payload.value?.available ? payload.value.usd : null;
    if (!rate || rate <= 0) return null;
    return formatCupAmount(amount, rate);
  };

  /** Момент ставки (для title-подсказки) либо null. */
  const rateUpdatedAt = computed<string | null>(() =>
    payload.value?.available && payload.value.updatedAtText ? payload.value.updatedAtText : null,
  );

  return { cupFor, rateUpdatedAt, load };
};
