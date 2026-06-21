import { addDays, format, subHours } from 'date-fns';
import type { TimeBlock } from './timeBlock';

/**
 * 「1日」の起点時刻（時）。lasdo の1日は 5:00〜翌4:59（requirements.md 6.3）。
 * タイムライン軸 5:00〜29:00 と整合する。
 */
export const DAY_START_HOUR = 5;

/** lasdo 日の論理キー（YYYY-MM-DD）。`splitByDayBoundary` 等の結果で使う。 */
export type DayKey = string;

/**
 * 与えた日時が属する「lasdo 日」(5:00起点)の論理日付キー(YYYY-MM-DD)を返す。
 *
 * 時刻が 5:00 未満なら前日に属する（深夜は「前日の続き」とみなす）。
 * 例: 6/21 04:30 → "2026-06-20" / 6/21 05:00 → "2026-06-21"。
 */
export function lasdoDayKey(d: Date): DayKey {
  // 5時間ぶん戻してから暦日を取れば、0:00〜4:59 が自然に前日へ寄る。
  return format(subHours(d, DAY_START_HOUR), 'yyyy-MM-dd');
}

/**
 * lasdo 日キーの表示窓 [5:00, 翌5:00) を返す。
 * `end` は半開区間（その時刻自体は翌日に属する）。
 */
export function dayWindow(key: DayKey): { start: Date; end: Date } {
  const [y, m, d] = key.split('-').map(Number);
  const start = new Date(y, m - 1, d, DAY_START_HOUR, 0, 0, 0);
  return { start, end: addDays(start, 1) };
}

/** lasdo 日キーの起点 5:00 からの経過分に変換する（タイムライン軸 0〜1440 と整合）。 */
export function minutesFromDayStart(key: DayKey, d: Date): number {
  return (d.getTime() - dayWindow(key).start.getTime()) / 60_000;
}

/** タイムライン軸の総分数（5:00〜29:00 = 24時間）。 */
export const TIMELINE_TOTAL_MINUTES = 24 * 60;

/**
 * 指定 lasdo 日に属するアクティブ帯を、5:00起点の経過分 [startMin, endMin) の
 * リストで返す（1日タイムライン描画用）。startMin 昇順。
 *
 * 深夜またぎ区間はその日の窓に収まる部分だけが現れる（前後日に分かれる）。
 */
export function daySegments(
  blocks: TimeBlock[],
  key: DayKey,
): Array<{ startMin: number; endMin: number }> {
  const result: Array<{ startMin: number; endMin: number }> = [];
  for (const b of blocks) {
    for (const seg of splitByDayBoundary(b)) {
      if (seg.key !== key) continue;
      result.push({
        startMin: minutesFromDayStart(key, seg.start),
        endMin: minutesFromDayStart(key, seg.end),
      });
    }
  }
  return result.sort((a, b) => a.startMin - b.startMin);
}

/**
 * 区間を lasdo 日の境界(5:00)で切り、各日に属する部分区間へ分割する。
 *
 * - 表示・集計専用。保存データには手を入れない（requirements.md 4.4）。
 * - 深夜またぎ（例 23:00〜翌2:00）は前後2日の窓に分かれる。データは1件のまま。
 * - 各セグメントは半開区間 [start, end)。ちょうど境界(5:00)で終わる区間は次日に
 *   ゼロ幅セグメントを作らない。
 */
export function splitByDayBoundary(
  block: TimeBlock,
): Array<{ key: DayKey; start: Date; end: Date }> {
  const result: Array<{ key: DayKey; start: Date; end: Date }> = [];
  let segStart = block.start;
  while (segStart.getTime() < block.end.getTime()) {
    const key = lasdoDayKey(segStart);
    const { end: winEnd } = dayWindow(key);
    const segEnd =
      block.end.getTime() < winEnd.getTime() ? block.end : winEnd;
    result.push({ key, start: segStart, end: segEnd });
    segStart = segEnd;
  }
  return result;
}
