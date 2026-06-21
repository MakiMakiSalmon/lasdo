import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CircularTimer } from './CircularTimer';

const timerStoreMock = vi.hoisted(() => ({
  state: { runningSince: null as Date | null },
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('../store/timerStore', () => ({
  useTimerStore: (selector: (state: unknown) => unknown) =>
    selector({
      runningSince: timerStoreMock.state.runningSince,
      start: timerStoreMock.start,
      stop: timerStoreMock.stop,
    }),
}));

function outerRingCount(html: string): number {
  return html.match(/stroke-width="5"/g)?.length ?? 0;
}

describe('CircularTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 21, 10, 0, 0));
    timerStoreMock.state.runningSince = null;
  });

  afterEach(() => {
    timerStoreMock.state.runningSince = null;
    vi.useRealTimers();
  });

  it('停止中は開始ラベルと 0:00 を表示する', () => {
    const html = renderToStaticMarkup(<CircularTimer />);

    expect(html).toContain('aria-label="計測を開始"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('0:00');
    expect(html).toContain('タップで開始');
    expect(outerRingCount(html)).toBe(0);
  });

  it('稼働中は停止ラベル・経過時間・完了単位ぶんの外周リングを表示する', () => {
    timerStoreMock.state.runningSince = new Date(2026, 5, 21, 8, 55, 0);

    const html = renderToStaticMarkup(<CircularTimer />);

    expect(html).toContain('aria-label="計測を停止"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('1:05:00');
    expect(html).toContain('タップで停止');
    expect(outerRingCount(html)).toBe(2);
  });

  it('4単位目以降は ×N 表示へ集約し、外周リングは1本に戻る', () => {
    timerStoreMock.state.runningSince = new Date(2026, 5, 21, 8, 20, 0);

    const html = renderToStaticMarkup(<CircularTimer />);

    expect(html).toContain('×4');
    expect(outerRingCount(html)).toBe(1);
  });
});
