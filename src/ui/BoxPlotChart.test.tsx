import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { TimeBlock } from '../domain/timeBlock';
import { BoxPlotChart } from './BoxPlotChart';

vi.mock('echarts-for-react', () => ({
  default: () => <div data-testid="chart" />,
}));

function dt(day: number, hour: number): Date {
  return new Date(2026, 5, day, hour, 0, 0, 0);
}

function block(id: string, start: Date, end: Date): TimeBlock {
  return { id, start, end };
}

describe('BoxPlotChart', () => {
  const range = { from: dt(21, 5), to: dt(28, 5) };

  it('空の曜日をデータなしとして表示する', () => {
    const html = renderToStaticMarkup(
      <BoxPlotChart blocks={[]} range={range} groupBy="weekday" />,
    );

    expect(html).toContain('データなし: 日、月、火、水、木、金、土');
  });

  it('5分未満だけの日は開始/終了判定から外れ、データなしになる', () => {
    const html = renderToStaticMarkup(
      <BoxPlotChart
        blocks={[block('short', dt(21, 9), new Date(2026, 5, 21, 9, 3))]}
        range={range}
        groupBy="all"
      />,
    );

    expect(html).toContain('データなし: 全体');
  });
});
