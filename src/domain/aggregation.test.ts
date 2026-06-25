import { describe, expect, it } from 'vitest';
import {
  activeDurationMs,
  avgDurationByWeekday,
  avgMinutesByWeekdayHour,
  dailyActiveMs,
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

  it('記録開始前の空白日は分母に数えない（少データで平均が薄まらない）', () => {
    // 月曜が5日ある窓だが、記録は最後寄りの月曜1日(6/22 2h)だけ。
    const blocks = [block('a', dt(6, 22, 9), dt(6, 22, 11))];
    const range = { from: dt(6, 1, 5), to: dt(6, 30, 5) };
    const avg = avgDurationByWeekday(blocks, range);
    // 分母は最初の記録日(6/22)以降の月曜=2日(6/22, 6/29)。6/1・6/8・6/15 は数えない。
    // → 2h / 2日 = 1h（窓全体の5日で割る 0.4h ではない）。
    expect(avg[1]).toBe(1 * HOUR);
  });
});

describe('avgMinutesByWeekdayHour', () => {
  // 既定枠 = 2時間。枠0 = 5:00〜7:00、枠1 = 7:00〜9:00、枠2 = 9:00〜11:00。
  it('区間を曜日×時間枠へ割り当てる（分単位）', () => {
    const blocks = [block('a', dt(6, 22, 9), dt(6, 22, 11))]; // 月 9:00〜11:00
    const range = { from: dt(6, 21, 5), to: dt(6, 23, 5) }; // 日・月
    const { avgMinutes, bucketCount } = avgMinutesByWeekdayHour(blocks, range);
    expect(bucketCount).toBe(12);
    expect(avgMinutes[1][2]).toBe(120); // 月・枠2(9:00〜11:00)
    expect(avgMinutes[1][1]).toBe(0); // 隣の枠は 0
  });

  it('枠の境界をまたぐ区間を分割して各枠へ加算する', () => {
    const blocks = [block('a', dt(6, 22, 8), dt(6, 22, 10))]; // 月 8:00〜10:00
    const range = { from: dt(6, 21, 5), to: dt(6, 23, 5) };
    const { avgMinutes } = avgMinutesByWeekdayHour(blocks, range);
    expect(avgMinutes[1][1]).toBe(60); // 7:00〜9:00 のうち 8:00〜9:00
    expect(avgMinutes[1][2]).toBe(60); // 9:00〜11:00 のうち 9:00〜10:00
  });

  it('lasdo日境界(5:00)をまたぐ区間は前後の曜日・枠へ分かれる', () => {
    // 6/22 03:00〜07:00。境界5:00で割れ、前2h は日曜(6/21)の最終枠、後2h は月曜(6/22)の先頭枠。
    const blocks = [block('a', dt(6, 22, 3), dt(6, 22, 7))];
    const range = { from: dt(6, 21, 5), to: dt(6, 23, 5) };
    const { avgMinutes } = avgMinutesByWeekdayHour(blocks, range);
    expect(avgMinutes[0][11]).toBe(120); // 日曜 枠11(3:00〜5:00 = 27:00〜29:00)
    expect(avgMinutes[1][0]).toBe(120); // 月曜 枠0(5:00〜7:00)
  });

  it('同じ枠の複数日を日数で割って平均/日になる', () => {
    const blocks = [
      block('a', dt(6, 22, 9), dt(6, 22, 10)), // 月 60分
      block('b', dt(6, 29, 9), dt(6, 29, 11)), // 月 120分
    ];
    const range = { from: dt(6, 21, 5), to: dt(6, 30, 5) }; // 月曜が2日
    const { avgMinutes } = avgMinutesByWeekdayHour(blocks, range);
    expect(avgMinutes[1][2]).toBe(90); // (60 + 120) / 2
  });
});

describe('dailyActiveMs', () => {
  it('lasdo日キーごとに合算し、境界(5:00)またぎは前後日へ分ける', () => {
    const blocks = [
      block('a', dt(6, 21, 9), dt(6, 21, 11)), // 6/21 2h
      block('b', dt(6, 21, 14), dt(6, 21, 15)), // 6/21 1h
      block('c', dt(6, 22, 3), dt(6, 22, 7)), // 03-05 は 6/21、05-07 は 6/22
    ];
    const m = dailyActiveMs(blocks, { from: dt(6, 21, 5), to: dt(6, 23, 5) });
    expect(m.get('2026-06-21')).toBe(5 * HOUR); // 3h + またぎ前半2h
    expect(m.get('2026-06-22')).toBe(2 * HOUR);
  });

  it('範囲外の日はキーを持たない', () => {
    const m = dailyActiveMs([block('a', dt(6, 21, 9), dt(6, 21, 10))], {
      from: dt(6, 22, 5),
      to: dt(6, 23, 5),
    });
    expect(m.size).toBe(0);
  });
});
