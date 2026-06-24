import { addDays } from 'date-fns';
import { useMemo } from 'react';
import { dailyActiveMs } from '../domain/aggregation';
import { dayWindow, lasdoDayKey } from '../domain/dayBoundary';
import type { TimeBlock } from '../domain/timeBlock';
import styles from './ThisWeekChart.module.css';

/**
 * 今週の作業時間（日別の縦棒・案②）。活動カレンダーの右に並べる「今この瞬間」のビュー。
 *
 * 今週（日曜起点の lasdo 週）の各日のアクティブ時間を縦棒で示す。今日を強調し、
 * まだ来ていない曜日は空（未来）として薄く置く。長期分析と記録画面の橋渡し。
 */
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const MS_PER_HOUR = 3_600_000;

/**
 * 棒の描画領域の高さ。ActivityCalendar の草の高さ（セル20px×7行 + 隙間3px×6）に
 * 揃えることで、データの有無で縦幅が変わらず、両者の上端・下端が一致する。
 */
const TRACK_PX = 7 * 20 + 6 * 3; // 158
/** 棒の上に置く値ラベルの確保高。 */
const VALUE_PX = 14;
/** 満杯の棒の高さ（値ラベルぶんを残してトラックいっぱい）。 */
const MAX_BAR_PX = TRACK_PX - VALUE_PX;

function round1(n: number): string {
  return `${Math.round(n * 10) / 10}h`;
}

export interface ThisWeekChartProps {
  blocks: TimeBlock[];
  /** 基準時刻（既定 = 現在）。どの週・どの曜日が「今日」かに使う。 */
  now?: Date;
}

export function ThisWeekChart({ blocks, now = new Date() }: ThisWeekChartProps) {
  const nowKey = now.getTime();

  const { days, max } = useMemo(() => {
    const base = new Date(nowKey);
    const todayStart = dayWindow(lasdoDayKey(base)).start; // 今日の lasdo 日 5:00
    const sunStart = addDays(todayStart, -todayStart.getDay()); // 直近の日曜 5:00
    const perDay = dailyActiveMs(blocks, {
      from: sunStart,
      to: addDays(sunStart, 7),
    });
    const list = WEEKDAY_LABELS.map((label, i) => {
      const dayStart = addDays(sunStart, i);
      const hours = (perDay.get(lasdoDayKey(dayStart)) ?? 0) / MS_PER_HOUR;
      return {
        label,
        hours,
        isToday: dayStart.getTime() === todayStart.getTime(),
        isFuture: dayStart.getTime() > todayStart.getTime(),
      };
    });
    const max = Math.max(1, ...list.map((d) => d.hours));
    return { days: list, max };
  }, [blocks, nowKey]);

  return (
    <div className={styles.wrap}>
      <div className={styles.bars}>
        {days.map((d) => {
          const px = d.isFuture ? 2 : Math.max(2, Math.round((d.hours / max) * MAX_BAR_PX));
          const tone = d.isFuture
            ? styles.future
            : d.hours > 0
              ? d.isToday
                ? styles.today
                : styles.bar
              : styles.zero;
          return (
            <div key={d.label} className={styles.col}>
              <div className={styles.track} style={{ height: TRACK_PX }}>
                <span className={styles.value}>
                  {!d.isFuture && d.hours > 0 ? round1(d.hours) : ''}
                </span>
                <span className={`${styles.barBase} ${tone}`} style={{ height: px }} />
              </div>
              <span className={`${styles.label} ${d.isToday ? styles.todayLabel : ''}`}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
