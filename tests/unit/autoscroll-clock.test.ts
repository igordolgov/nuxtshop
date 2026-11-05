// tests/unit/autoscroll-clock.test.ts
// Чистая таймерная логика автоскролла галереи (createAutoscrollClock):
// тик по интервалу, пауза по действию пользователя, возобновление через
// resumeMs бездействия со сдвигом при повторных действиях, пропуск тиков
// в скрытой вкладке и при canTick: false, dispose, защита от двойного
// цикла. DOM не нужен — фейковые таймеры vitest.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutoscrollClock } from '../../app/utils/autoscrollClock';

const INTERVAL = 4000;
const RESUME = 5000;

type ClockState = { hidden: boolean; canTick: boolean };

const makeClock = () => {
  const ticks: number[] = [];
  const state: ClockState = { hidden: false, canTick: true };
  const clock = createAutoscrollClock({
    intervalMs: INTERVAL,
    resumeMs: RESUME,
    isHidden: () => state.hidden,
    canTick: () => state.canTick,
    onTick: () => ticks.push(ticks.length + 1),
  });
  return { clock, ticks, state };
};

describe('createAutoscrollClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('тик раз в intervalMs, цикл продолжается', () => {
    const { clock, ticks } = makeClock();
    clock.start();
    vi.advanceTimersByTime(INTERVAL);
    expect(ticks).toHaveLength(1);
    vi.advanceTimersByTime(INTERVAL);
    expect(ticks).toHaveLength(2);
  });

  it('pause() снимает ближайший тик, возобновление через resumeMs бездействия', () => {
    const { clock, ticks } = makeClock();
    clock.start();
    vi.advanceTimersByTime(1000);
    clock.pause();
    // момент, когда тик случился бы без паузы
    vi.advanceTimersByTime(INTERVAL - 1000);
    expect(ticks).toHaveLength(0);
    // возобновление не дёргает слайд сразу
    vi.advanceTimersByTime(RESUME);
    expect(ticks).toHaveLength(0);
    // первый шаг после возобновления — через intervalMs
    vi.advanceTimersByTime(INTERVAL);
    expect(ticks).toHaveLength(1);
  });

  it('повторные действия сдвигают возобновление: нужны 5 с полного бездействия', () => {
    const { clock, ticks } = makeClock();
    clock.start();
    vi.advanceTimersByTime(1000);
    clock.pause();
    vi.advanceTimersByTime(4000);
    clock.pause(); // новое действие в t=5000 — отсчёт заново
    vi.advanceTimersByTime(RESUME - 1000);
    expect(ticks).toHaveLength(0);
    vi.advanceTimersByTime(1000 + INTERVAL);
    expect(ticks).toHaveLength(1);
  });

  it('скрытая вкладка: тик пропускается с перепланированием, цикл живёт', () => {
    const { clock, ticks, state } = makeClock();
    clock.start();
    state.hidden = true;
    vi.advanceTimersByTime(INTERVAL * 3);
    expect(ticks).toHaveLength(0);
    state.hidden = false;
    vi.advanceTimersByTime(INTERVAL);
    expect(ticks).toHaveLength(1);
  });

  it('canTick: false — тики пропускаются, но цикл не умирает', () => {
    const { clock, ticks, state } = makeClock();
    clock.start();
    state.canTick = false;
    vi.advanceTimersByTime(INTERVAL * 2);
    expect(ticks).toHaveLength(0);
    state.canTick = true;
    vi.advanceTimersByTime(INTERVAL);
    expect(ticks).toHaveLength(1);
  });

  it('dispose() останавливает всё навсегда: start/pause больше не работают', () => {
    const { clock, ticks } = makeClock();
    clock.start();
    clock.dispose();
    vi.advanceTimersByTime(INTERVAL * 3);
    expect(ticks).toHaveLength(0);
    clock.start();
    clock.pause();
    vi.advanceTimersByTime(RESUME + INTERVAL * 2);
    expect(ticks).toHaveLength(0);
  });

  it('start() во время паузы не создаёт второй цикл', () => {
    const { clock, ticks } = makeClock();
    clock.start();
    vi.advanceTimersByTime(1000);
    clock.pause();
    clock.start();
    vi.advanceTimersByTime(RESUME + INTERVAL);
    expect(ticks).toHaveLength(1);
  });

  it('pause() до start(): цикл пойдёт после возобновления, без двойного тика', () => {
    const { clock, ticks } = makeClock();
    clock.pause();
    clock.start();
    vi.advanceTimersByTime(RESUME + INTERVAL);
    expect(ticks).toHaveLength(1);
  });
});
