import { addDays } from 'date-fns';
import { dayWindow, lasdoDayKey } from './dayBoundary';
import type { TimeBlock } from './timeBlock';

/**
 * 分析画面の期間プリセット（detailed-design 6.3）。
 * 既定は直近4週。12週は曜日別箱のサンプル数（各曜日≒12点）確保も兼ねる。
 */
export type PeriodPreset = 'recent4w' | 'recent12w' | 'all';

export const PERIOD_PRESETS: ReadonlyArray<{
  value: PeriodPreset;
  label: string;
}> = [
  { value: 'recent4w', label: '直近4週' },
  { value: 'recent12w', label: '直近12週' },
  { value: 'all', label: '全期間' },
];

export const DEFAULT_PERIOD: PeriodPreset = 'recent4w';

/**
 * プリセットから集計レンジ [from, to) を返す。lasdo 日境界(5:00)に揃える。
 *
 * - `to` = 今日の lasdo 日の終わり（翌5:00）。今日ぶんも含める。
 * - `recent4w`/`recent12w` = `to` から 28日/84日さかのぼる（各曜日が4回/12回ずつ）。
 * - `all` = 最古ブロックが属する lasdo 日の 5:00 から。ブロックなしは空レンジ。
 */
export function presetRange(
  preset: PeriodPreset,
  now: Date,
  blocks: TimeBlock[],
): { from: Date; to: Date } {
  const to = dayWindow(lasdoDayKey(now)).end;

  if (preset === 'all') {
    if (blocks.length === 0) return { from: to, to };
    const earliest = blocks.reduce(
      (min, b) => Math.min(min, b.start.getTime()),
      Number.POSITIVE_INFINITY,
    );
    const from = dayWindow(lasdoDayKey(new Date(earliest))).start;
    return { from, to };
  }

  const weeks = preset === 'recent4w' ? 4 : 12;
  return { from: addDays(to, -weeks * 7), to };
}
