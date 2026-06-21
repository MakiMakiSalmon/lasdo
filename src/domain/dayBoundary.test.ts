import { describe, expect, it } from 'vitest';
import {
  daySegments,
  dayWindow,
  lasdoDayKey,
  minutesFromDayStart,
  splitByDayBoundary,
} from './dayBoundary';
import type { TimeBlock } from './timeBlock';

/** 2026年のローカル日時を作るヘルパー（month は 1 始まりで渡す）。 */
function dt(m: number, d: number, h: number, min = 0): Date {
  return new Date(2026, m - 1, d, h, min, 0, 0);
}

describe('lasdoDayKey', () => {
  it('5:00 ちょうどはその日に属する', () => {
    expect(lasdoDayKey(dt(6, 21, 5, 0))).toBe('2026-06-21');
  });
  it('5:00 未満（深夜）は前日に属する', () => {
    expect(lasdoDayKey(dt(6, 21, 4, 59))).toBe('2026-06-20');
    expect(lasdoDayKey(dt(6, 21, 0, 0))).toBe('2026-06-20');
  });
  it('日中はその暦日のまま', () => {
    expect(lasdoDayKey(dt(6, 21, 14, 30))).toBe('2026-06-21');
  });
  it('月またぎの深夜も前日（前月末）に寄る', () => {
    expect(lasdoDayKey(dt(7, 1, 2, 0))).toBe('2026-06-30');
  });
});

describe('dayWindow', () => {
  it('[5:00, 翌5:00) を返す', () => {
    const { start, end } = dayWindow('2026-06-21');
    expect(start).toEqual(dt(6, 21, 5));
    expect(end).toEqual(dt(6, 22, 5));
  });
});

describe('minutesFromDayStart', () => {
  it('5:00 起点の経過分（タイムライン軸 0〜1440）', () => {
    expect(minutesFromDayStart('2026-06-21', dt(6, 21, 5, 0))).toBe(0);
    expect(minutesFromDayStart('2026-06-21', dt(6, 21, 14, 0))).toBe(540);
    // 翌4:00 = 23時間後 = 1380分（軸上の 28:00）
    expect(minutesFromDayStart('2026-06-21', dt(6, 22, 4, 0))).toBe(1380);
  });
});

describe('splitByDayBoundary', () => {
  function block(start: Date, end: Date): TimeBlock {
    return { id: 'x', start, end };
  }

  it('1日に収まる区間は分割しない', () => {
    const segs = splitByDayBoundary(block(dt(6, 21, 9), dt(6, 21, 12)));
    expect(segs).toEqual([
      { key: '2026-06-21', start: dt(6, 21, 9), end: dt(6, 21, 12) },
    ]);
  });

  it('暦日はまたぐが5:00未満で終わる区間は同じlasdo日のまま（分割しない）', () => {
    // 23:00→翌02:00 は 02:00 が 5:00 未満なので前日の続き。1ブロックのまま。
    const segs = splitByDayBoundary(block(dt(6, 21, 23), dt(6, 22, 2)));
    expect(segs).toEqual([
      { key: '2026-06-21', start: dt(6, 21, 23), end: dt(6, 22, 2) },
    ]);
  });

  it('lasdo日境界(5:00)をまたぐ区間は前後2日に割れる', () => {
    // 03:00→07:00 は境界5:00をまたぐので前後日に分割される。
    const segs = splitByDayBoundary(block(dt(6, 22, 3), dt(6, 22, 7)));
    expect(segs).toEqual([
      { key: '2026-06-21', start: dt(6, 22, 3), end: dt(6, 22, 5) },
      { key: '2026-06-22', start: dt(6, 22, 5), end: dt(6, 22, 7) },
    ]);
  });

  it('5:00 ちょうどで終わる区間は次日にゼロ幅を作らない', () => {
    const segs = splitByDayBoundary(block(dt(6, 22, 3), dt(6, 22, 5)));
    expect(segs).toEqual([
      { key: '2026-06-21', start: dt(6, 22, 3), end: dt(6, 22, 5) },
    ]);
  });

  it('複数日をまたぐ区間は各日に割れる', () => {
    const segs = splitByDayBoundary(block(dt(6, 21, 23), dt(6, 23, 6)));
    expect(segs.map((s) => s.key)).toEqual([
      '2026-06-21',
      '2026-06-22',
      '2026-06-23',
    ]);
  });
});

describe('daySegments', () => {
  function block(start: Date, end: Date): TimeBlock {
    return { id: Math.random().toString(36), start, end };
  }

  it('その日の帯を 5:00起点の分 [startMin, endMin) で返す（昇順）', () => {
    const segs = daySegments(
      [
        block(dt(6, 21, 20), dt(6, 21, 22)), // 後の帯
        block(dt(6, 21, 9), dt(6, 21, 12)), // 先の帯
      ],
      '2026-06-21',
    );
    expect(segs).toEqual([
      { startMin: 4 * 60, endMin: 7 * 60 }, // 09:00-12:00
      { startMin: 15 * 60, endMin: 17 * 60 }, // 20:00-22:00
    ]);
  });

  it('5:00をまたぐ区間は当日窓に収まる部分だけ現れる', () => {
    // 03:00→07:00 は 6/21 側に [22h,24h)、6/22 側に [0,2h) として分かれる。
    const bs = [block(dt(6, 22, 3), dt(6, 22, 7))];
    expect(daySegments(bs, '2026-06-21')).toEqual([
      { startMin: 22 * 60, endMin: 24 * 60 },
    ]);
    expect(daySegments(bs, '2026-06-22')).toEqual([
      { startMin: 0, endMin: 2 * 60 },
    ]);
  });

  it('該当日に帯がなければ空配列', () => {
    expect(daySegments([block(dt(6, 21, 9), dt(6, 21, 10))], '2026-06-22')).toEqual(
      [],
    );
  });
});
