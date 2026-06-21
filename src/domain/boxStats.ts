import type { DailyStartEnd } from './aggregation';
import { dayWindow } from './dayBoundary';

/**
 * 箱ひげ図の素（detailed-design 6.3）。
 * dailyStartEnd の各日 start/end を「曜日別7群」または「全体1群」に束ね、
 * 開始/終了それぞれの五数要約を返す。粒度は groupBy 引数で共通化。
 */
export type BoxGroupBy = 'weekday' | 'all';

/** [min, Q1, median, Q3, max]（ECharts boxplot のデータ並び）。 */
export type FiveNum = [number, number, number, number, number];

export interface BoxStat {
  /** 群ラベル（曜日 '日'..'土' / '全体'）。 */
  label: string;
  /** 開始時刻分布（5:00起点の分）。サンプル0なら null。 */
  start: FiveNum | null;
  /** 終了時刻分布（5:00起点の分）。サンプル0なら null。 */
  end: FiveNum | null;
  /** サンプル数（日数）。 */
  count: number;
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

/** 昇順ソート済み配列の分位点（線形補間・numpy 既定と同等）。 */
function quantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

function fiveNum(values: number[]): FiveNum | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return [
    s[0],
    quantileSorted(s, 0.25),
    quantileSorted(s, 0.5),
    quantileSorted(s, 0.75),
    s[s.length - 1],
  ];
}

function statOf(label: string, rows: DailyStartEnd[]): BoxStat {
  return {
    label,
    start: fiveNum(rows.map((r) => r.startMin)),
    end: fiveNum(rows.map((r) => r.endMin)),
    count: rows.length,
  };
}

/** 行（lasdo日）の曜日（0=日..6=土）。キーの 5:00 起点日付から求める。 */
function weekdayOf(row: DailyStartEnd): number {
  return dayWindow(row.key).start.getDay();
}

export function boxStats(rows: DailyStartEnd[], groupBy: BoxGroupBy): BoxStat[] {
  if (groupBy === 'all') {
    return [statOf('全体', rows)];
  }
  return WEEKDAY_LABELS.map((label, wd) =>
    statOf(label, rows.filter((r) => weekdayOf(r) === wd)),
  );
}
