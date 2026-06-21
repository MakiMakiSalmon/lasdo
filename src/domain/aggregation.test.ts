import { describe, expect, it } from 'vitest';
import {
  activeDurationMs,
  avgDurationByWeekday,
  dailyStartEnd,
} from './aggregation';
import type { TimeBlock } from './timeBlock';

/** 2026年のローカル日時を作るヘルパー（month は 1 始まり）。 */
function dt(m: number, d: number, h: number, min = 0): Date {
  return new Date(2026, m - 1, d, h, min, 0, 0);
}
function block(id: string, start: Date, end: Date): TimeBlock {
  return { id, start, end };
}
const MIN = 60_000;
const HOUR = 60 * MIN;

describe('activeDurationMs', () => {
  const blocks = [block('a', dt(6, 21, 9), dt(6, 21, 12))]; // 3h

  it('完全に内包される期間はその期間長', () => {
    expect(activeDurationMs(blocks, dt(6, 21, 10), dt(6, 21, 11))).toBe(HOUR);
  });
  it('部分重なりは重なり分だけ', () => {
    expect(activeDurationMs(blocks, dt(6, 21, 11), dt(6, 21, 14))).toBe(HOUR);
  });
  it('範囲外は 0', () => {
    expect(activeDurationMs(blocks, dt(6, 21, 13), dt(6, 21, 15))).toBe(0);
  });
  it('複数区間を合算する', () => {
    const bs = [
      block('a', dt(6, 21, 9), dt(6, 21, 10)),
      block('b', dt(6, 21, 12), dt(6, 21, 14)),
    ];
    expect(activeDurationMs(bs, dt(6, 21, 5), dt(6, 22, 5))).toBe(3 * HOUR);
  });
});

describe('avgDurationByWeekday', () => {
  it('lasdo日境界(5:00)をまたぐ区間を曜日へ分割して割り当てる', () => {
    // 6/22 03:00 → 07:00。境界5:00で割れ、前2h は日曜(6/21)、後2h は月曜(6/22)。
    const blocks = [block('a', dt(6, 22, 3), dt(6, 22, 7))];
    const range = { from: dt(6, 21, 5), to: dt(6, 23, 5) }; // 日・月の2日間
    const avg = avgDurationByWeekday(blocks, range);
    // 各曜日 1 日ずつなので 平均 = 合計
    expect(avg[0]).toBe(2 * HOUR); // 日曜(6/21): 03:00〜05:00
    expect(avg[1]).toBe(2 * HOUR); // 月曜(6/22): 05:00〜07:00
  });

  it('日数で割って平均/日になる', () => {
    // 2つの月曜にそれぞれ 2h と 4h → 平均 3h
    const blocks = [
      block('a', dt(6, 22, 9), dt(6, 22, 11)), // 6/22 月 2h
      block('b', dt(6, 29, 9), dt(6, 29, 13)), // 6/29 月 4h
    ];
    const range = { from: dt(6, 21, 5), to: dt(6, 30, 5) }; // 月曜が2日含まれる
    const avg = avgDurationByWeekday(blocks, range);
    expect(avg[1]).toBe(3 * HOUR);
  });

  it('該当日数 0 の曜日は 0', () => {
    const range = { from: dt(6, 22, 5), to: dt(6, 23, 5) }; // 月曜1日だけ
    const avg = avgDurationByWeekday([], range);
    expect(avg[0]).toBe(0);
    expect(avg[1]).toBe(0);
  });
});

describe('dailyStartEnd', () => {
  it('単一区間の日は開始=終了の分換算（5:00起点）', () => {
    const rows = dailyStartEnd([block('a', dt(6, 21, 9), dt(6, 21, 12))]);
    expect(rows).toEqual([
      { key: '2026-06-21', startMin: 4 * 60, endMin: 7 * 60 },
    ]);
  });

  it('複数区間の日は最初の開始と最後の終了', () => {
    const rows = dailyStartEnd([
      block('a', dt(6, 21, 9), dt(6, 21, 10)),
      block('b', dt(6, 21, 20), dt(6, 21, 22)),
    ]);
    expect(rows).toEqual([
      { key: '2026-06-21', startMin: 4 * 60, endMin: 17 * 60 },
    ]);
  });

  it('minBlockMinutes 未満の極短区間は開始/終了判定で無視する', () => {
    const rows = dailyStartEnd(
      [
        block('short', dt(6, 21, 6), dt(6, 21, 6, 3)), // 3分（無視）
        block('main', dt(6, 21, 9), dt(6, 21, 12)),
      ],
      5,
    );
    // 6:00 の極短区間が無視され、開始は 9:00（=240分）になる
    expect(rows).toEqual([
      { key: '2026-06-21', startMin: 4 * 60, endMin: 7 * 60 },
    ]);
  });

  it('lasdo日境界(5:00)をまたぐ区間は前後日に別々の開始/終了を作る', () => {
    // 6/22 03:00 → 07:00。境界5:00で前後日に割れる。
    const rows = dailyStartEnd([block('a', dt(6, 22, 3), dt(6, 22, 7))]);
    expect(rows.map((r) => r.key)).toEqual(['2026-06-21', '2026-06-22']);
    // 6/21: 03:00(=22h後=1320分) 〜 境界5:00(=24h=1440分)
    expect(rows[0]).toEqual({ key: '2026-06-21', startMin: 22 * 60, endMin: 24 * 60 });
    // 6/22: 5:00(=0分) 〜 07:00(=2h=120分)
    expect(rows[1]).toEqual({ key: '2026-06-22', startMin: 0, endMin: 2 * 60 });
  });
});
