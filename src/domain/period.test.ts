import { describe, expect, it } from 'vitest';
import { ANALYSIS_WEEKS, recentRange } from './period';

function dt(m: number, d: number, h: number, min = 0): Date {
  return new Date(2026, m - 1, d, h, min, 0, 0);
}
const DAY = 24 * 60 * 60 * 1000;

describe('recentRange', () => {
  const now = dt(6, 21, 14, 0); // 6/21(日) の日中

  it('既定(12週)は今日のlasdo日の終わり(翌5:00)から84日ぶん', () => {
    const { from, to } = recentRange(now);
    expect(to).toEqual(dt(6, 22, 5)); // 6/22 05:00
    expect((to.getTime() - from.getTime()) / DAY).toBe(ANALYSIS_WEEKS * 7);
    expect(from).toEqual(dt(3, 30, 5)); // 84日前の 5:00
  });

  it('weeks を渡すとその週数ぶんさかのぼる', () => {
    const { from, to } = recentRange(now, 4);
    expect((to.getTime() - from.getTime()) / DAY).toBe(28);
    expect(from).toEqual(dt(5, 25, 5)); // 28日前の 5:00
  });

  it('深夜(5:00未満)の now でも当日lasdo日の終わり(翌5:00)に揃う', () => {
    const { to } = recentRange(dt(6, 21, 2)); // 02:00 → lasdo日 6/20
    expect(to).toEqual(dt(6, 21, 5)); // 6/20 の終わり = 6/21 05:00
  });
});
