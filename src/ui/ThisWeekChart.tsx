import { addDays } from 'date-fns';
import { type PointerEvent, useMemo, useRef, useState } from 'react';
import { dailyActiveMs } from '../domain/aggregation';
import { dayWindow, lasdoDayKey } from '../domain/dayBoundary';
import type { TimeBlock } from '../domain/timeBlock';
import styles from './ThisWeekChart.module.css';

/**
 * 今週の作業時間（日別の縦棒・案②）。活動カレンダーの右に並べる「今この瞬間」のビュー。
 *
 * 今週（日曜起点の lasdo 週）の各日のアクティブ時間を縦棒で示す。今日を強調し、
 * まだ来ていない曜日は空（未来）として薄く置く。長期分析と記録画面の橋渡し。
 * 値は常時表示せず、棒にカーソルを合わせると吹き出しで出す（活動カレンダーと統一）。
 */
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const MS_PER_HOUR = 3_600_000;

/**
 * 棒の描画領域の高さ。ActivityCalendar の草の高さ（セル20px×7行 + 隙間3px×6）に
 * 揃えることで、データの有無で縦幅が変わらず、両者の上端・下端が一致する。
 */
const TRACK_PX = 7 * 20 + 6 * 3; // 158

function toHm(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}分`;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

interface Tooltip {
  left: number;
  top: number;
  text: string;
}

export interface ThisWeekChartProps {
  blocks: TimeBlock[];
  /** 基準時刻（既定 = 現在）。どの週・どの曜日が「今日」かに使う。 */
  now?: Date;
}

export function ThisWeekChart({ blocks, now = new Date() }: ThisWeekChartProps) {
  const nowKey = now.getTime();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

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

  const showTip = (event: PointerEvent<HTMLDivElement>, text: string) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setTooltip({
      left: clamp(event.clientX - rect.left, 24, rect.width - 24),
      top: event.clientY - rect.top - 8,
      text,
    });
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.bars}>
        {days.map((d) => {
          const px = d.isFuture ? 2 : Math.max(2, Math.round((d.hours / max) * TRACK_PX));
          const tone = d.isFuture
            ? styles.future
            : d.hours > 0
              ? d.isToday
                ? styles.today
                : styles.bar
              : styles.zero;
          const tip = d.isFuture
            ? `${d.label}曜 ・ これから`
            : `${d.label}曜${d.isToday ? '（今日）' : ''} ・ ${
                d.hours > 0 ? toHm(d.hours) : '記録なし'
              }`;
          return (
            <div
              key={d.label}
              className={styles.col}
              aria-label={tip}
              onPointerEnter={(event) => showTip(event, tip)}
              onPointerMove={(event) => showTip(event, tip)}
              onPointerLeave={() => setTooltip(null)}
            >
              <div className={styles.track} style={{ height: TRACK_PX }}>
                <span className={`${styles.barBase} ${tone}`} style={{ height: px }} />
              </div>
              <span className={`${styles.label} ${d.isToday ? styles.todayLabel : ''}`}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>

      {tooltip && (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.left, top: tooltip.top }}
          role="tooltip"
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
