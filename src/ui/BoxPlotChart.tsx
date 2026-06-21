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
    grid: { top: 16, right: 16, bottom: 28, left: 52 },
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
      type: 'category',
      data: labels,
      boundaryGap: true,
      axisLine: { lineStyle: { color: theme.axis } },
      axisLabel: { color: theme.text },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: theme.text, formatter: (v: number) => minToClock(v) },
      splitLine: { lineStyle: { color: theme.axis, opacity: 0.5 } },
    },
    series: [
      {
        type: 'boxplot',
        data,
        itemStyle: { color: theme.accent, borderColor: color, borderWidth: 2 },
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

  return (
    <div className={styles.charts}>
      <div className={styles.chart}>
        <p className={styles.caption}>開始時刻</p>
        <ReactECharts
          option={startOption}
          style={{ height: 200, width: '100%' }}
          notMerge
          opts={{ renderer: 'svg' }}
        />
      </div>
      <div className={styles.chart}>
        <p className={styles.caption}>終了時刻</p>
        <ReactECharts
          option={endOption}
          style={{ height: 200, width: '100%' }}
          notMerge
          opts={{ renderer: 'svg' }}
        />
      </div>
    </div>
  );
}
