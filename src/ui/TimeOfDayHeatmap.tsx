import { type PointerEvent, useMemo, useRef, useState } from 'react';
import { avgMinutesByWeekdayHour } from '../domain/aggregation';
import { recentRange } from '../domain/period';
import type { TimeBlock } from '../domain/timeBlock';
import styles from './TimeOfDayHeatmap.module.css';

/**
 * 時間帯ヒートマップ（曜日＝棒・紫1色濃淡）。自前描画。
 *
 * 曜日ごとに1本の横棒を、時間帯（5:00〜29:00）に沿って時間枠で区切り、
 * 各枠の「平均アクティブ分/日」を色の濃淡で示す。活動カレンダー（草）が
 * 「どの日にどれだけ」なら、こちらは「いつ（何時に）動く人か＝リズムの型」を見せる。
 *
 * 色は草と同じ --accent（紫）の color-mix 濃淡でアプリ全体と統一する。
 */
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

/** 平均分/枠 → 濃淡レベル（2時間枠 = 最大120分を想定）。草と同じ5段階。 */
function levelClass(min: number): string {
  if (min <= 0) return styles.lv0;
  if (min < 15) return styles.lv1;
  if (min < 35) return styles.lv2;
  if (min < 60) return styles.lv3;
  return styles.lv4;
}

function toHm(min: number): string {
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
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

export interface TimeOfDayHeatmapProps {
  blocks: TimeBlock[];
  /** 基準時刻（既定 = 現在）。どの直近窓を集計するかに使う。 */
  now?: Date;
}

export function TimeOfDayHeatmap({ blocks, now = new Date() }: TimeOfDayHeatmapProps) {
  const nowKey = now.getTime();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const { avgMinutes, bucketCount, bucketHours } = useMemo(() => {
    const heatmap = avgMinutesByWeekdayHour(blocks, recentRange(new Date(nowKey)));
    return {
      avgMinutes: heatmap.avgMinutes,
      bucketCount: heatmap.bucketCount,
      bucketHours: heatmap.bucketMinutes / 60,
    };
  }, [blocks, nowKey]);

  // 枠境界の時計時刻（5:00起点・24超は翌日へ折り返す）。例: 枠0開始 = 5、枠12 = 29 → 5。
  const clock = (boundary: number) => (5 + boundary * bucketHours) % 24;
  const boundaries = Array.from({ length: bucketCount + 1 }, (_, i) => i);

  const showTip = (event: PointerEvent<HTMLSpanElement>, text: string) => {
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
      <div
        className={styles.rows}
        role="img"
        aria-label="曜日ごとの時間帯別アクティブ量ヒートマップ"
      >
        {WEEKDAY_LABELS.map((label, wd) => (
          <div key={label} className={styles.row}>
            <span className={styles.day}>{label}</span>
            <div className={styles.bar}>
              {avgMinutes[wd].map((min, bi) => {
                const tip = `${label} ${clock(bi)}:00〜${clock(bi + 1)}:00 ・ ${
                  min > 0 ? `平均${toHm(min)}/日` : '記録なし'
                }`;
                return (
                  <span
                    key={bi}
                    className={`${styles.cell} ${levelClass(min)} ${
                      bi > 0 ? styles.divider : ''
                    }`}
                    aria-label={tip}
                    onPointerEnter={(event) => showTip(event, tip)}
                    onPointerMove={(event) => showTip(event, tip)}
                    onPointerLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
          </div>
        ))}
        <div className={styles.axis} aria-hidden="true">
          {boundaries.map((b) => (
            <span key={b}>{clock(b)}</span>
          ))}
        </div>
      </div>

      <div className={styles.legend}>
        <span>少ない</span>
        <span className={`${styles.swatch} ${styles.lv0}`} />
        <span className={`${styles.swatch} ${styles.lv1}`} />
        <span className={`${styles.swatch} ${styles.lv2}`} />
        <span className={`${styles.swatch} ${styles.lv3}`} />
        <span className={`${styles.swatch} ${styles.lv4}`} />
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
