import type { EChartsOption } from 'echarts';
import ReactECharts from 'echarts-for-react';
import { useMemo } from 'react';
import { dailyStartEnd } from '../domain/aggregation';
import {
  boxStats,
  type BoxGroupBy,
  type BoxStat,
  type FiveNum,
} from '../domain/boxStats';
import { dayWindow } from '../domain/dayBoundary';
import type { TimeBlock } from '../domain/timeBlock';
import { chartTheme } from './echartsTheme';
import styles from './BoxPlotChart.module.css';

/**
 * 開始/終了時刻の分布（箱ひげ図・detailed-design 6.3 / 実装優先順③）。
 * 曜日別7箱 ⇄ 全体1本のトグルに対応（粒度は groupBy で共通化）。
 * 開始・終了で2つの箱ひげを縦に並べる。
 */
export interface BoxPlotChartProps {
  blocks: TimeBlock[];
  range: { from: Date; to: Date };
  groupBy: BoxGroupBy;
}

/** #rrggbb を薄い rgba に。塗りを淡くして枠線・中央値線を視認できるようにする。 */
function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const n = Number.parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** 5:00起点の分 → 時計表示（例 240 → 9:00、1440 → 5:00）。 */
function minToClock(min: number): string {
  const t = Math.round(min);
  const hour = (5 + Math.floor(t / 60)) % 24;
  return `${hour}:${String(((t % 60) + 60) % 60).padStart(2, '0')}`;
}

function buildOption(
  stats: BoxStat[],
  metric: 'start' | 'end',
  color: string,
  theme: ReturnType<typeof chartTheme>,
): EChartsOption {
  const labels = stats.map((s) => s.label);
  // サンプルなしの群は ECharts の空値 '-' を渡す（boxplot data 型を満たすため cast）。
  const empty = '-' as unknown as FiveNum;
  const data = stats.map((s) => (metric === 'start' ? s.start : s.end) ?? empty);

  return {
    // 時刻を横軸に取り、横幅をフルに使って時間差を読み取りやすくする。
    grid: { top: 16, right: 24, bottom: 32, left: 52 },
    tooltip: {
      trigger: 'item',
      formatter: (p: unknown) => {
        const param = p as { name: string; value: number[] };
        const v = param.value.slice(-5); // [min,Q1,med,Q3,max]
        if (v.length < 5) return `${param.name}: データなし`;
        return [
          `${param.name}`,
          `中央 ${minToClock(v[2])}`,
          `四分位 ${minToClock(v[1])}–${minToClock(v[3])}`,
          `範囲 ${minToClock(v[0])}–${minToClock(v[4])}`,
        ].join('<br/>');
      },
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: theme.text, formatter: (v: number) => minToClock(v) },
      splitLine: { lineStyle: { color: theme.axis, opacity: 0.5 } },
    },
    yAxis: {
      type: 'category',
      data: labels,
      boundaryGap: true,
      axisLine: { lineStyle: { color: theme.axis } },
      axisLabel: { color: theme.text },
    },
    series: [
      {
        type: 'boxplot',
        layout: 'horizontal',
        data,
        // 塗りは淡く・枠線/中央値線は同系色の濃色にして線を視認できるようにする。
        itemStyle: { color: withAlpha(color, 0.22), borderColor: color, borderWidth: 2 },
      },
    ],
  };
}

export function BoxPlotChart({ blocks, range, groupBy }: BoxPlotChartProps) {
  const stats = useMemo(() => {
    const from = range.from.getTime();
    const to = range.to.getTime();
    const rows = dailyStartEnd(blocks).filter((r) => {
      const t = dayWindow(r.key).start.getTime();
      return t >= from && t < to;
    });
    return boxStats(rows, groupBy);
  }, [blocks, range, groupBy]);

  const theme = chartTheme();
  const startOption = useMemo(
    () => buildOption(stats, 'start', theme.accent, theme),
    [stats, theme],
  );
  const endOption = useMemo(
    () => buildOption(stats, 'end', theme.good, theme),
    [stats, theme],
  );

  // 横向きでは曜日が縦に積まれるので、本数に応じて高さを確保する。
  const height = Math.max(140, stats.length * 36 + 64);

  return (
    <div className={styles.charts}>
      <div className={styles.chart}>
        <p className={styles.caption}>開始時刻</p>
        <ReactECharts
          option={startOption}
          style={{ height, width: '100%' }}
          notMerge
          opts={{ renderer: 'svg' }}
        />
      </div>
      <div className={styles.chart}>
        <p className={styles.caption}>終了時刻</p>
        <ReactECharts
          option={endOption}
          style={{ height, width: '100%' }}
          notMerge
          opts={{ renderer: 'svg' }}
        />
      </div>
    </div>
  );
}
