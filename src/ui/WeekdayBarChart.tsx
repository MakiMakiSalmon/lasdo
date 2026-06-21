import type { EChartsOption } from 'echarts';
import ReactECharts from 'echarts-for-react';
import { useMemo } from 'react';
import { avgDurationByWeekday } from '../domain/aggregation';
import type { TimeBlock } from '../domain/timeBlock';
import { chartTheme } from './echartsTheme';

/** 0=日 .. 6=土 の表示ラベル。 */
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const MS_PER_HOUR = 3_600_000;

function toHm(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

/**
 * 曜日別の平均アクティブ時間/日（棒グラフ・detailed-design 6.3 / 実装優先順②）。
 * 合計でなく平均/日なので、期間プリセットが可変でも曜日間で公平に比較できる。
 */
export interface WeekdayBarChartProps {
  blocks: TimeBlock[];
  range: { from: Date; to: Date };
}

export function WeekdayBarChart({ blocks, range }: WeekdayBarChartProps) {
  const option = useMemo<EChartsOption>(() => {
    const avg = avgDurationByWeekday(blocks, range);
    const hours = WEEKDAY_LABELS.map((_, wd) => +(avg[wd] / MS_PER_HOUR).toFixed(2));
    const theme = chartTheme();

    return {
      grid: { top: 24, right: 16, bottom: 28, left: 44 },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (v) => toHm(Number(v)),
      },
      xAxis: {
        type: 'category',
        data: WEEKDAY_LABELS,
        axisLine: { lineStyle: { color: theme.axis } },
        axisLabel: { color: theme.text },
      },
      yAxis: {
        type: 'value',
        name: '時間',
        nameTextStyle: { color: theme.text },
        axisLabel: { color: theme.text, formatter: (v: number) => toHm(v) },
        splitLine: { lineStyle: { color: theme.axis, opacity: 0.5 } },
      },
      series: [
        {
          type: 'bar',
          data: hours,
          itemStyle: { color: theme.accent, borderRadius: [4, 4, 0, 0] },
          barWidth: '55%',
        },
      ],
    };
  }, [blocks, range]);

  return (
    <ReactECharts
      option={option}
      style={{ height: 260, width: '100%' }}
      notMerge
      opts={{ renderer: 'svg' }}
    />
  );
}
