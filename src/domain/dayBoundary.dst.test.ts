import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { splitByDayBoundary } from './dayBoundary';
import type { TimeBlock } from './timeBlock';

/**
 * DST spring-forward の回帰テスト。
 *
 * `lasdoDayKey`(実時間) と `dayWindow`(壁時計) のズレで、spring-forward 当日は
 * セグメントが前進しなくなる（winEnd <= segStart）。旧実装はそこでゼロ幅セグメントを
 * 安全弁の上限(1000件)まで積み、05:00以降を落としていた。安全弁を「前進しない
 * セグメントは push せず即 break」に変えたので、有限個・ゼロ幅なしで返ることを確認する。
 *
 * JST では発生しないため、DST のある TZ(America/New_York) に切り替えて検証する。
 */
describe('splitByDayBoundary (DST spring-forward)', () => {
  const origTZ = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'America/New_York';
  });
  afterAll(() => {
    if (origTZ === undefined) delete process.env.TZ;
    else process.env.TZ = origTZ;
  });

  it('spring-forward 当日の 5:00 またぎ区間でも有限個・ゼロ幅なしで返す', () => {
    // 前提確認: TZ 切替が効いていること（効かないと JST で通常分割になり本テストが
    // 無意味化する）。spring-forward 前後で UTC オフセットが 300→240 に変わる。
    expect(new Date(2026, 2, 8, 1, 0).getTimezoneOffset()).toBe(300); // EST
    expect(new Date(2026, 2, 8, 5, 0).getTimezoneOffset()).toBe(240); // EDT

    // 2026-03-08 は 02:00→03:00 が抜ける日。04:30→06:00 は lasdo 日境界(5:00)をまたぐ。
    const block: TimeBlock = {
      id: 'dst',
      start: new Date(2026, 2, 8, 4, 30, 0, 0),
      end: new Date(2026, 2, 8, 6, 0, 0, 0),
    };
    const segs = splitByDayBoundary(block);

    // 旧実装は安全弁の上限まで（約1000件）ゼロ幅セグメントを積んでいた。
    expect(segs.length).toBeLessThanOrEqual(2);
    // ゼロ幅/逆順セグメントを一切作らない。
    for (const s of segs) {
      expect(s.end.getTime()).toBeGreaterThan(s.start.getTime());
    }
    // 先頭は block.start から始まる（前方の時間を落とさない）。
    expect(segs[0].start).toEqual(block.start);
  });
});
