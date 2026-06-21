import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { TimeBlock } from '../domain/timeBlock';
import { WeekdayBarChart } from './WeekdayBarChart';

vi.mock('echarts-for-react', () => ({
  default: ({ option }: { option: { tooltip: { valueFormatter: (v: number) => string }; yAxis: { name: string }; series: Array<{ data: number[] }> } }) => (
    <div>
      <span>{option.yAxis.name}</span>
      <span>{option.tooltip.valueFormatter(1.25)}</span>
      <span>{option.series[0].data.join(',')}</span>
    </div>
  ),
}));

function dt(day: number, hour: number): Date {
  return new Date(2026, 5, day, hour, 0, 0, 0);
}

function block(id: string, start: Date, end: Date): TimeBlock {
  return { id, start, end };
}

describe('WeekdayBarChart', () => {
  it('曜日別データは合計ではなく時間/日の平均で、ツールチップも時間/日表示にする', () => {
    const html = renderToStaticMarkup(
      <WeekdayBarChart
        blocks={[
          block('a', dt(22, 9), dt(22, 11)),
          block('b', dt(29, 9), dt(29, 13)),
        ]}
        range={{ from: dt(21, 5), to: dt(30, 5) }}
      />,
    );

    expect(html).toContain('時間/日');
    expect(html).toContain('1.3 時間/日');
    expect(html).toContain('0,3,0,0,0,0,0');
  });
});
