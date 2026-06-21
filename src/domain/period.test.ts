import { describe, expect, it } from 'vitest';
import { presetRange } from './period';
import type { TimeBlock } from './timeBlock';

function dt(m: number, d: number, h: number, min = 0): Date {
  return new Date(2026, m - 1, d, h, min, 0, 0);
}
const DAY = 24 * 60 * 60 * 1000;

describe('presetRange', () => {
  const now = dt(6, 21, 14, 0); // 6/21(日) の日中

  it('recent4w は今日のlasdo日の終わり(翌5:00)から28日ぶん', () => {
    const { from, to } = presetRange('recent4w', now, []);
    expect(to).toEqual(dt(6, 22, 5)); // 6/22 05:00
    expect((to.getTime() - from.getTime()) / DAY).toBe(28);
    expect(from).toEqual(dt(5, 25, 5)); // 28日前の 5:00
  });

  it('recent12w は84日ぶん', () => {
    const { from, to } = presetRange('recent12w', now, []);
    expect((to.getTime() - from.getTime()) / DAY).toBe(84);
  });

  it('all は最古ブロックが属するlasdo日の5:00から', () => {
    const blocks: TimeBlock[] = [
      { id: 'a', start: dt(6, 10, 9), end: dt(6, 10, 10) },
      { id: 'b', start: dt(6, 18, 9), end: dt(6, 18, 10) },
    ];
    const { from, to } = presetRange('all', now, blocks);
    expect(from).toEqual(dt(6, 10, 5)); // 6/10 の 5:00
    expect(to).toEqual(dt(6, 22, 5));
  });

  it('all は深夜(5:00未満)の最古ブロックを前日lasdo日に寄せる', () => {
    const blocks: TimeBlock[] = [
      { id: 'a', start: dt(6, 11, 2), end: dt(6, 11, 3) }, // 02:00 → lasdo日 6/10
    ];
    const { from } = presetRange('all', now, blocks);
    expect(from).toEqual(dt(6, 10, 5));
  });

  it('all はブロックなしなら空レンジ(from === to)', () => {
    const { from, to } = presetRange('all', now, []);
    expect(from).toEqual(to);
  });
});
