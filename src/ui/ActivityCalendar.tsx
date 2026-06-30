import { type PointerEvent, useMemo, useRef, useState } from 'react';
import { avgDurationByWeekday, dailyActiveMs } from '../domain/aggregation';
import { lasdoDaysInRange } from '../domain/dayBoundary';
import { recentRange } from '../domain/period';
import type { TimeBlock } from '../domain/timeBlock';
import styles from './ActivityCalendar.module.css';

/**
 * 活動カレンダー（GitHubの草風・案C）。自前描画。
 *
 * 左＝1マス1日の活動量を色の濃淡で示すカレンダー（列=週・行=曜日）。
 * 右＝その曜日の平均/日を欄外バーで添える（曜日のクセを定量で残す）。
 * マスにカーソルを合わせると、その日の日付と作業時間を吹き出しで表示する。
 */
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const MS_PER_HOUR = 3_600_000;

/** 草の表示スパン（週）。 */
const GRASS_WEEKS = 12;
/** 欄外の曜日平均のスパン（週）。"最近の自分"を保つ。 */
const AVG_WEEKS = 12;

function levelClass(hours: number): string {
  if (hours <= 0) return styles.lv0;
  if (hours < 2) return styles.lv1;
  if (hours < 4) return styles.lv2;
  if (hours < 6) return styles.lv3;
  return styles.lv4;
}

function toHm(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}分`;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function cellTip(date: Date, hours: number): string {
  return `${formatDate(date)} ・ ${hours > 0 ? toHm(hours) : '記録なし'}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

interface Tooltip {
  left: number;
  top: number;
  text: string;
}

export interface ActivityCalendarProps {
  blocks: TimeBlock[];
  /** 基準時刻（既定 = 現在）。どの直近窓を描くかに使う。 */
  now?: Date;
}

export function ActivityCalendar({ blocks, now = new Date() }: ActivityCalendarProps) {
  const nowKey = now.getTime();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const { days, lead, avg, maxAvg } = useMemo(() => {
    const base = new Date(nowKey);
    const grassRange = recentRange(base, GRASS_WEEKS);
    const perDay = dailyActiveMs(blocks, grassRange);
    const list = lasdoDaysInRange(grassRange).map((d) => ({
      key: d.key,
      date: d.start,
      weekday: d.start.getDay(),
      hours: (perDay.get(d.key) ?? 0) / MS_PER_HOUR,
    }));
    // 先頭列を曜日に合わせる空詰め（最初の日の曜日ぶん上を空ける）。
    const lead = list.length > 0 ? list[0].weekday : 0;

    const avgRec = avgDurationByWeekday(blocks, recentRange(base, AVG_WEEKS));
    const avgHours = WEEKDAY_LABELS.map((_, wd) => avgRec[wd] / MS_PER_HOUR);
    const maxAvg = Math.max(1, ...avgHours);

    return { days: list, lead, avg: avgHours, maxAvg };
  }, [blocks, nowKey]);

  const showTip = (event: PointerEvent<HTMLElement>, text: string) => {
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
      <div className={styles.row}>
        <div className={styles.weekdays} aria-hidden="true">
          {WEEKDAY_LABELS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>

        <div className={styles.grass} role="img" aria-label="日ごとの活動量カレンダー">
          {Array.from({ length: lead }).map((_, i) => (
            <span key={`pad${i}`} className={styles.pad} aria-hidden="true" />
          ))}
          {days.map((d) => (
            <span
              key={d.key}
              className={`${styles.cell} ${levelClass(d.hours)}`}
              aria-label={`${formatDate(d.date)} ${d.hours > 0 ? toHm(d.hours) : '記録なし'}`}
              onPointerEnter={(event) => showTip(event, cellTip(d.date, d.hours))}
              onPointerMove={(event) => showTip(event, cellTip(d.date, d.hours))}
              onPointerLeave={() => setTooltip(null)}
            />
          ))}
        </div>

        <div className={styles.marginal}>
          {WEEKDAY_LABELS.map((w, wd) => {
            const tip = `${w}曜 ・ 平均 ${avg[wd] > 0 ? toHm(avg[wd]) : '記録なし'}/日`;
            return (
              <div
                key={w}
                className={styles.mrow}
                aria-label={tip}
                onPointerEnter={(event) => showTip(event, tip)}
                onPointerMove={(event) => showTip(event, tip)}
                onPointerLeave={() => setTooltip(null)}
              >
                <span
                  className={styles.mbar}
                  style={{ width: `${Math.round((avg[wd] / maxAvg) * 100)}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.legend}>
        <span>少ない</span>
        <span className={`${styles.cell} ${styles.lv0}`} />
        <span className={`${styles.cell} ${styles.lv1}`} />
        <span className={`${styles.cell} ${styles.lv2}`} />
        <span className={`${styles.cell} ${styles.lv3}`} />
        <span className={`${styles.cell} ${styles.lv4}`} />
        <span>多い</span>
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
