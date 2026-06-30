import {
  daySegments,
  lasdoDayKey,
  minutesFromDayStart,
  TIMELINE_TOTAL_MINUTES,
} from '../domain/dayBoundary';
import { type FocusEvent, type PointerEvent, useRef, useState } from 'react';
import type { TimeBlock } from '../domain/timeBlock';
import styles from './TodayTimeline.module.css';

/**
 * 今日（現在の lasdo 日）のタイムライン（自前 SVG・detailed-design 6.2）。
 *
 * 軸は 5:00〜29:00 固定（日ごと比較のためズームしない）。アクティブ帯を濃色で、
 * 記録なしは空白で示す。深夜またぎは当日窓に収まる部分だけが現れる。
 */
export interface TodayTimelineProps {
  blocks: TimeBlock[];
  /** 基準時刻（既定 = 現在）。どの lasdo 日を描くかと now マーカーに使う。 */
  now?: Date;
}

// viewBox 座標系: 1分 = 1単位。左右に少し余白を取る。
const PAD_X = 8;
const BAR_TOP = 8;
const BAR_H = 56;
const LABEL_Y = BAR_TOP + BAR_H + 18;
const VB_W = TIMELINE_TOTAL_MINUTES + PAD_X * 2;
const VB_H = LABEL_Y + 8;

/** 軸上の時(5..29)。3時間ごとに目盛・ラベルを置く。 */
const LABEL_HOURS = [5, 8, 11, 14, 17, 20, 23, 26, 29];

const minToX = (m: number) => PAD_X + m;

interface TimelineTooltip {
  left: number;
  top: number;
  range: string;
  duration: string;
}

type TimelineSegment = ReturnType<typeof daySegments>[number];

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function minToClock(min: number): string {
  const rounded = Math.round(min);
  const hourFromZero = 5 + Math.floor(rounded / 60);
  const minute = ((rounded % 60) + 60) % 60;
  const dayLabel = hourFromZero >= 24 ? '翌' : '';
  return `${dayLabel}${hourFromZero % 24}:${String(minute).padStart(2, '0')}`;
}

function formatDuration(min: number): string {
  const rounded = Math.round(min);
  return rounded > 0 ? `${rounded}分` : '1分未満';
}

function tooltipText(segment: TimelineSegment): Pick<TimelineTooltip, 'range' | 'duration'> {
  return {
    range: `${minToClock(segment.startMin)}–${minToClock(segment.endMin)}`,
    duration: formatDuration(segment.endMin - segment.startMin),
  };
}

export function TodayTimeline({ blocks, now = new Date() }: TodayTimelineProps) {
  const key = lasdoDayKey(now);
  const segments = daySegments(blocks, key);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TimelineTooltip | null>(null);

  // now マーカー（表示日が今日のときだけ・軸内に収まるときだけ）。
  const nowMin = minutesFromDayStart(key, now);
  const showNow = nowMin >= 0 && nowMin <= TIMELINE_TOTAL_MINUTES;

  const showTooltipAtPointer = (
    event: PointerEvent<SVGRectElement>,
    segment: TimelineSegment,
  ) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const content = tooltipText(segment);
    setTooltip({
      ...content,
      left: clamp(event.clientX - rect.left, 20, rect.width - 20),
      top: event.clientY - rect.top - 10,
    });
  };

  const showTooltipAtSegment = (
    event: FocusEvent<SVGRectElement>,
    segment: TimelineSegment,
  ) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const svg = event.currentTarget.ownerSVGElement;
    const svgRect = svg?.getBoundingClientRect();
    if (!svgRect) return;
    const wrapRect = wrap.getBoundingClientRect();
    const centerMin = segment.startMin + (segment.endMin - segment.startMin) / 2;
    const content = tooltipText(segment);
    setTooltip({
      ...content,
      left: clamp(
        svgRect.left - wrapRect.left + (minToX(centerMin) / VB_W) * svgRect.width,
        20,
        wrapRect.width - 20,
      ),
      top: svgRect.top - wrapRect.top + BAR_TOP - 4,
    });
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <p className={styles.title}>今日のタイムライン（5:00〜翌5:00）</p>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label="今日のアクティブ時間のタイムライン"
        preserveAspectRatio="none"
      >
        {/* 枠 */}
        <rect
          className={styles.frame}
          x={PAD_X}
          y={BAR_TOP}
          width={TIMELINE_TOTAL_MINUTES}
          height={BAR_H}
        />

        {/* 3時間ごとの目盛とラベル */}
        {LABEL_HOURS.map((h) => {
          const x = minToX((h - 5) * 60);
          return (
            <g key={h}>
              <line
                className={styles.tick}
                x1={x}
                y1={BAR_TOP}
                x2={x}
                y2={BAR_TOP + BAR_H}
              />
              <text
                className={styles.label}
                x={x}
                y={LABEL_Y}
                textAnchor="middle"
              >
                {h % 24}
              </text>
            </g>
          );
        })}

        {/* アクティブ帯 */}
        {segments.map((s, i) => {
          const content = tooltipText(s);
          return (
            <rect
              key={i}
              className={styles.band}
              x={minToX(s.startMin)}
              y={BAR_TOP + 4}
              width={Math.max(1, s.endMin - s.startMin)}
              height={BAR_H - 8}
              rx={3}
              tabIndex={0}
              aria-label={`${content.range}、${content.duration}`}
              onPointerEnter={(event) => showTooltipAtPointer(event, s)}
              onPointerMove={(event) => showTooltipAtPointer(event, s)}
              onPointerLeave={() => setTooltip(null)}
              onFocus={(event) => showTooltipAtSegment(event, s)}
              onBlur={() => setTooltip(null)}
            />
          );
        })}

        {/* now マーカー */}
        {showNow && (
          <line
            x1={minToX(nowMin)}
            y1={BAR_TOP - 2}
            x2={minToX(nowMin)}
            y2={BAR_TOP + BAR_H + 2}
            stroke="var(--now)"
            strokeWidth={2}
          />
        )}
      </svg>
      {tooltip && (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.left, top: tooltip.top }}
          role="tooltip"
          aria-label={`${tooltip.range}、${tooltip.duration}`}
        >
          <span className={styles.tooltipRange}>{tooltip.range}</span>
          <span className={styles.tooltipDuration}>{tooltip.duration}</span>
        </div>
      )}
    </div>
  );
}
