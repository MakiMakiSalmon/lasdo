import { addDays } from 'date-fns';
import { dayWindow, lasdoDayKey } from './dayBoundary';

/**
 * 分析チャートの集計期間（週）。プリセット選択は廃止し、直近◯週に固定する。
 * 12週 = 時間帯ヒートマップで各曜日≒12点を確保できる下限（requirements.md 6.3）。
 */
export const ANALYSIS_WEEKS = 12;

/**
 * 直近 `weeks` 週の集計レンジ [from, to) を返す。lasdo 日境界(5:00)に揃える。
 *
 * - `to` = 今日の lasdo 日の終わり（翌5:00）。今日ぶんも含める。
 * - `from` = `to` から `weeks * 7` 日さかのぼった 5:00。
 */
export function recentRange(
  now: Date,
  weeks: number = ANALYSIS_WEEKS,
): { from: Date; to: Date } {
  const to = dayWindow(lasdoDayKey(now)).end;
  return { from: addDays(to, -weeks * 7), to };
}
