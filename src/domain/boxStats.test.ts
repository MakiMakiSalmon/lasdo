import { describe, expect, it } from 'vitest';
import type { DailyStartEnd } from './aggregation';
import { boxStats } from './boxStats';

/** key の曜日: 2026-06-21=日,22=月,...,27=土。startMin/endMin は任意。 */
function row(key: string, startMin: number, endMin: number): DailyStartEnd {
  return { key, startMin, endMin };
}

describe('boxStats', () => {
  it('all は全体1群の五数要約を返す', () => {
    const rows = [
      row('2026-06-21', 1, 10),
      row('2026-06-22', 2, 20),
      row('2026-06-23', 3, 30),
      row('2026-06-24', 4, 40),
      row('2026-06-25', 5, 50),
    ];
    const [g] = boxStats(rows, 'all');
    expect(g.label).toBe('全体');
    expect(g.count).toBe(5);
    // [1,2,3,4,5] → min1 Q1=2 med3 Q3=4 max5（線形補間）
    expect(g.start).toEqual([1, 2, 3, 4, 5]);
    expect(g.end).toEqual([10, 20, 30, 40, 50]);
  });

  it('weekday は7群を 日..土 の順で返す', () => {
    const stats = boxStats([row('2026-06-22', 100, 200)], 'weekday'); // 6/22=月
    expect(stats.map((s) => s.label)).toEqual(['日', '月', '火', '水', '木', '金', '土']);
    expect(stats[1].count).toBe(1); // 月に1件
    expect(stats[1].start).toEqual([100, 100, 100, 100, 100]); // 1件は全て同値
    expect(stats[0].start).toBeNull(); // 日はサンプルなし
    expect(stats[0].count).toBe(0);
  });

  it('偶数個でも線形補間で分位点を出す', () => {
    const rows = [
      row('2026-06-21', 1, 0),
      row('2026-06-21', 2, 0),
      row('2026-06-21', 3, 0),
      row('2026-06-21', 4, 0),
    ];
    const [g] = boxStats(rows, 'all');
    // [1,2,3,4] → Q1=1.75 med=2.5 Q3=3.25
    expect(g.start).toEqual([1, 1.75, 2.5, 3.25, 4]);
  });

  it('該当群が空なら start/end は null', () => {
    const [g] = boxStats([], 'all');
    expect(g).toMatchObject({ label: '全体', start: null, end: null, count: 0 });
  });
});
