import { addDays } from 'date-fns';
import {
  dayWindow,
  lasdoDayKey,
  minutesFromDayStart,
  splitByDayBoundary,
  type DayKey,
} from './dayBoundary';
import type { TimeBlock } from './timeBlock';

/**
 * 開始/終了判定で無視する極短区間のしきい値（分）。
 * 朝/深夜の極短区間が「最初の開始/最後の終了」をズラす穴を吸収する（requirements.md 6.4）。
 * duration 合計には影響しない。MVP 既定 = 5 分。
 */
export const MIN_BLOCK_MINUTES = 5;

const MS_PER_MIN = 60_000;

function durationMin(b: TimeBlock): number {
  return (b.end.getTime() - b.start.getTime()) / MS_PER_MIN;
}

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

/** lasdo 日ごとの「最初の開始」「最後の終了」（5:00起点の経過分）。 */
export interface DailyStartEnd {
  key: DayKey;
  /** その日の最初の区間の開始（5:00起点の分、0〜1440）。 */
  startMin: number;
  /** その日の最後の区間の終了（5:00起点の分、0〜1440）。 */
  endMin: number;
}

/**
 * 各 lasdo 日の「最初の区間の開始」「最後の区間の終了」を集める（箱ひげ図の素）。
 *
 * - `minBlockMinutes` 未満の区間は開始/終了の判定から無視する（極短区間補正・6.4）。
 * - 出力は key 昇順。`startMin`/`endMin` は 5:00 起点の経過分（タイムライン軸と整合）。
 */
export function dailyStartEnd(
  blocks: TimeBlock[],
  minBlockMinutes = MIN_BLOCK_MINUTES,
): DailyStartEnd[] {
  const byDay = new Map<DayKey, { startMin: number; endMin: number }>();

  for (const b of blocks) {
    if (durationMin(b) < minBlockMinutes) continue;
    for (const seg of splitByDayBoundary(b)) {
      const s = minutesFromDayStart(seg.key, seg.start);
      const e = minutesFromDayStart(seg.key, seg.end);
      const cur = byDay.get(seg.key);
      if (!cur) {
        byDay.set(seg.key, { startMin: s, endMin: e });
      } else {
        cur.startMin = Math.min(cur.startMin, s);
        cur.endMin = Math.max(cur.endMin, e);
      }
    }
  }

  return [...byDay.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
