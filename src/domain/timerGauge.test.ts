import { describe, expect, it } from 'vitest';
import { formatElapsed, gaugeState } from './timerGauge';

const MIN = 60_000;

describe('gaugeState', () => {
  it('0 は単位0・進捗0', () => {
    expect(gaugeState(0)).toMatchObject({
      completedUnits: 0,
      progressInUnit: 0,
      collapsed: false,
      outerRings: 0,
    });
  });

  it('単位の途中は進捗が比率になる（25分単位）', () => {
    const g = gaugeState(12.5 * MIN);
    expect(g.completedUnits).toBe(0);
    expect(g.progressInUnit).toBeCloseTo(0.5, 5);
  });

  it('1単位ちょうどで完了1・進捗0に戻る', () => {
    expect(gaugeState(25 * MIN)).toMatchObject({
      completedUnits: 1,
      progressInUnit: 0,
      outerRings: 1,
    });
  });

  it('3単位までは外周をその本数ぶん描く（集約しない）', () => {
    const g = gaugeState(75 * MIN);
    expect(g).toMatchObject({ completedUnits: 3, collapsed: false, outerRings: 3 });
  });

  it('4単位以降は ×N に集約して外周1本に戻す', () => {
    const g = gaugeState(100 * MIN);
    expect(g).toMatchObject({ completedUnits: 4, collapsed: true, outerRings: 1 });
  });

  it('負値は0として扱う', () => {
    expect(gaugeState(-5 * MIN)).toMatchObject({
      completedUnits: 0,
      progressInUnit: 0,
    });
  });
});

describe('formatElapsed', () => {
  it('1時間未満は M:SS', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(65 * 1000)).toBe('1:05');
    expect(formatElapsed(25 * MIN)).toBe('25:00');
  });
  it('1時間以上は H:MM:SS', () => {
    expect(formatElapsed(3600 * 1000)).toBe('1:00:00');
    expect(formatElapsed(3600 * 1000 + 5 * MIN + 9 * 1000)).toBe('1:05:09');
  });
});
