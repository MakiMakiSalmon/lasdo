import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { splitByDayBoundary } from './dayBoundary';
import type { TimeBlock } from './timeBlock';

/**
 * DST の回帰テスト（根本対応後）。
 *
 * `lasdoDayKey` を実時間(subHours)から壁時計(getHours/subDays)に変え、`dayWindow`
 * （壁時計）と整合させた。これにより DST 当日（spring-forward=23h / fall-back=25h）でも
 * セグメントが必ず前進し、5:00 境界をまたぐ区間が**正しく**前後日に分割される
 * （旧実装は spring-forward 当日に前進不能＝無限ループ→安全弁で 05:00 以降を欠落）。
 *
 * JST では DST が無いため、DST のある TZ(America/New_York) に切り替えて検証する。
 */
describe('splitByDayBoundary (DST)', () => {
  const origTZ = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'America/New_York';
  });
  afterAll(() => {
    if (origTZ === undefined) delete process.env.TZ;
    else process.env.TZ = origTZ;
  });

  /** セグメントが block を隙間なく覆い、各セグメントが正の幅であることを検証する。 */
  function expectTiles(
    segs: Array<{ start: Date; end: Date }>,
    block: TimeBlock,
  ) {
    expect(segs.length).toBeGreaterThan(0);
    expect(segs[0].start).toEqual(block.start);
    expect(segs[segs.length - 1].end).toEqual(block.end);
    let sum = 0;
    for (let i = 0; i < segs.length; i++) {
      expect(segs[i].end.getTime()).toBeGreaterThan(segs[i].start.getTime());
      if (i > 0) {
        // 隣接セグメントは連続（隙間も重なりも無い）。
        expect(segs[i].start.getTime()).toBe(segs[i - 1].end.getTime());
      }
      sum += segs[i].end.getTime() - segs[i].start.getTime();
    }
    // 実時間の総和が block の長さに一致（DST 当日でも欠落・重複が無い）。
    expect(sum).toBe(block.end.getTime() - block.start.getTime());
  }

  it('spring-forward 当日(23h)の 5:00 またぎを正しく前後日に分割する', () => {
    // 前提確認: TZ 切替が効いていること。spring-forward 前後でオフセットが 300→240。
    expect(new Date(2026, 2, 8, 1, 0).getTimezoneOffset()).toBe(300); // EST
    expect(new Date(2026, 2, 8, 5, 0).getTimezoneOffset()).toBe(240); // EDT

    // 2026-03-08 は 02:00→03:00 が抜ける日。04:30→06:00 は lasdo 日境界(5:00)をまたぐ。
    const block: TimeBlock = {
      id: 'sf',
      start: new Date(2026, 2, 8, 4, 30, 0, 0),
      end: new Date(2026, 2, 8, 6, 0, 0, 0),
    };
    const segs = splitByDayBoundary(block);

    expect(segs.map((s) => s.key)).toEqual(['2026-03-07', '2026-03-08']);
    expectTiles(segs, block);
  });

  it('fall-back 当日(25h)の 5:00 またぎを正しく前後日に分割する', () => {
    // 2026-11-01 は 02:00→01:00 に戻る日（offset 240→300）。
    expect(new Date(2026, 10, 1, 0, 30).getTimezoneOffset()).toBe(240); // EDT
    expect(new Date(2026, 10, 1, 5, 0).getTimezoneOffset()).toBe(300); // EST

    const block: TimeBlock = {
      id: 'fb',
      start: new Date(2026, 10, 1, 4, 0, 0, 0),
      end: new Date(2026, 10, 1, 6, 0, 0, 0),
    };
    const segs = splitByDayBoundary(block);

    expect(segs.map((s) => s.key)).toEqual(['2026-10-31', '2026-11-01']);
    expectTiles(segs, block);
  });

  it('spring-forward 当日に丸1日(5:00→翌5:00)を分割しても有限・正しい', () => {
    // 1日=23h の日。5:00 起点ちょうどの区間は当日1セグメントに収まる。
    const block: TimeBlock = {
      id: 'full',
      start: new Date(2026, 2, 8, 5, 0, 0, 0),
      end: new Date(2026, 2, 9, 5, 0, 0, 0),
    };
    const segs = splitByDayBoundary(block);
    expect(segs.map((s) => s.key)).toEqual(['2026-03-08']);
    expectTiles(segs, block);
  });
});
