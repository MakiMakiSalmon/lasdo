import { addDays } from 'date-fns';
import {
  dayWindow,
  lasdoDayKey,
  splitByDayBoundary,
  TIMELINE_TOTAL_MINUTES,
  type DayKey,
} from './dayBoundary';
import type { TimeBlock } from './timeBlock';

const MS_PER_MIN = 60_000;

/**
 * 期間 [from, to) に重なる区間長の合計（ミリ秒）。
 * blocks がマージ済み（重なりなし）なら二重計上は起きない。
 */
export function activeDurationMs(
  blocks: TimeBlock[],
  from: Date,
  to: Date,
): number {
  const lo = from.getTime();
  const hi = to.getTime();
  let total = 0;
  for (const b of blocks) {
    const start = Math.max(b.start.getTime(), lo);
    const end = Math.min(b.end.getTime(), hi);
    if (end > start) total += end - start;
  }
  return total;
}

/** [from, to) に起点(5:00)が含まれる lasdo 日を曜日(0=日..6=土)ごとに数える。 */
function countDaysByWeekday(from: Date, to: Date): Record<number, number> {
  const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  let cur = dayWindow(lasdoDayKey(from)).start;
  while (cur.getTime() < to.getTime()) {
    if (cur.getTime() >= from.getTime()) counts[cur.getDay()] += 1;
    cur = addDays(cur, 1);
  }
  return counts;
}

/**
 * 各区間を lasdo 日に割り当て（またぎは分割）、曜日(0=日..6=土)ごとの
 * 平均アクティブ時間/日（ミリ秒）を返す。
 *
 * 合計を「対象期間に含まれるその曜日の日数」で割るため、期間プリセット
 * （4週/12週/全期間）が可変でも曜日間で公平に比較できる（requirements.md 4.5 / 6.4）。
 * 該当日数 0 の曜日は 0 を返す。
 */
export function avgDurationByWeekday(
  blocks: TimeBlock[],
  range: { from: Date; to: Date },
): Record<number, number> {
  const sum: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const lo = range.from.getTime();
  const hi = range.to.getTime();
  let earliestDay = Number.POSITIVE_INFINITY;

  for (const b of blocks) {
    for (const seg of splitByDayBoundary(b)) {
      // 期間 [from, to) でクリップしてから曜日へ合算する。
      const start = Math.max(seg.start.getTime(), lo);
      const end = Math.min(seg.end.getTime(), hi);
      if (end <= start) continue;
      const dayStart = dayWindow(seg.key).start;
      sum[dayStart.getDay()] += end - start;
      earliestDay = Math.min(earliestDay, dayStart.getTime());
    }
  }

  // 分母は「最初に記録した日」以降だけを数える。記録開始前の空白日まで母数に
  // 含めると、使い始めで件数が少ないとき平均が不当に薄まるため（下限は range.from）。
  const from =
    earliestDay === Number.POSITIVE_INFINITY
      ? range.to
      : new Date(Math.max(lo, earliestDay));
  const counts = countDaysByWeekday(from, range.to);
  const avg: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (let wd = 0; wd < 7; wd += 1) {
    avg[wd] = counts[wd] > 0 ? sum[wd] / counts[wd] : 0;
  }
  return avg;
}

/**
 * 時間帯ヒートマップの時間枠サイズ（分）。1時間 = 24枠で 5:00〜29:00 を覆う。
 */
export const HEATMAP_BUCKET_MINUTES = 60;

/** 時間帯ヒートマップ（曜日×時間帯の平均アクティブ分/日）。 */
export interface WeekdayHourHeatmap {
  /** 1枠あたりの分数。 */
  bucketMinutes: number;
  /** 1日を覆う枠数（= TIMELINE_TOTAL_MINUTES / bucketMinutes）。 */
  bucketCount: number;
  /** [曜日 0=日..6=土][枠 0..bucketCount-1（0 = 5:00枠）] = 平均アクティブ分/日。 */
  avgMinutes: number[][];
}

/**
 * 曜日×時間帯の「平均アクティブ分/日」を返す（時間帯ヒートマップの素）。
 *
 * 各区間を lasdo 日へ割り当て（またぎは分割）、さらに時間枠の境界で割って
 * 枠ごとに分を合算する。合計を「対象期間に含まれるその曜日の日数」で割るため、
 * 直近◯週が可変でも曜日間で公平に比較できる（avgDurationByWeekday と同じ考え方）。
 *
 * 分母は avgDurationByWeekday と揃え、最初に記録した日以降だけを数える
 * （使い始めで件数が少ないとき平均が不当に薄まるのを避ける）。
 */
export function avgMinutesByWeekdayHour(
  blocks: TimeBlock[],
  range: { from: Date; to: Date },
  bucketMinutes = HEATMAP_BUCKET_MINUTES,
): WeekdayHourHeatmap {
  const bucketCount = Math.round(TIMELINE_TOTAL_MINUTES / bucketMinutes);
  const sum: number[][] = Array.from({ length: 7 }, () =>
    new Array<number>(bucketCount).fill(0),
  );
  const lo = range.from.getTime();
  const hi = range.to.getTime();
  let earliestDay = Number.POSITIVE_INFINITY;

  for (const b of blocks) {
    for (const seg of splitByDayBoundary(b)) {
      // 期間 [from, to) でクリップしてから枠へ割り当てる。
      const start = Math.max(seg.start.getTime(), lo);
      const end = Math.min(seg.end.getTime(), hi);
      if (end <= start) continue;
      const dayStart = dayWindow(seg.key).start;
      const wd = dayStart.getDay();
      earliestDay = Math.min(earliestDay, dayStart.getTime());

      // セグメントを枠境界でさらに割り、重なった分を各枠へ加算する。
      const base = dayStart.getTime();
      const sMin = (start - base) / MS_PER_MIN;
      const eMin = (end - base) / MS_PER_MIN;
      for (let bi = Math.floor(sMin / bucketMinutes); bi < bucketCount; bi += 1) {
        const bStart = bi * bucketMinutes;
        const bEnd = bStart + bucketMinutes;
        const overlap = Math.min(eMin, bEnd) - Math.max(sMin, bStart);
        if (overlap > 0) sum[wd][bi] += overlap;
        if (eMin <= bEnd) break;
      }
    }
  }

  const from =
    earliestDay === Number.POSITIVE_INFINITY
      ? range.to
      : new Date(Math.max(lo, earliestDay));
  const counts = countDaysByWeekday(from, range.to);
  const avgMinutes = sum.map((row, wd) =>
    row.map((v) => (counts[wd] > 0 ? v / counts[wd] : 0)),
  );
  return { bucketMinutes, bucketCount, avgMinutes };
}

/**
 * lasdo 日キーごとのアクティブ時間合計（ミリ秒）。活動カレンダー（草）の素。
 *
 * 各区間を lasdo 日へ割り当て（またぎは分割）、[from, to) でクリップして日ごとに合算。
 * 記録のない日はキーを持たない（呼び出し側で 0 とみなす）。
 */
export function dailyActiveMs(
  blocks: TimeBlock[],
  range: { from: Date; to: Date },
): Map<DayKey, number> {
  const lo = range.from.getTime();
  const hi = range.to.getTime();
  const byDay = new Map<DayKey, number>();

  for (const b of blocks) {
    for (const seg of splitByDayBoundary(b)) {
      const start = Math.max(seg.start.getTime(), lo);
      const end = Math.min(seg.end.getTime(), hi);
      if (end <= start) continue;
      byDay.set(seg.key, (byDay.get(seg.key) ?? 0) + (end - start));
    }
  }
  return byDay;
}
