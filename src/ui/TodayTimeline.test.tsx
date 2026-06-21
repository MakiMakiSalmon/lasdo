import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TimeBlock } from '../domain/timeBlock';
import { TodayTimeline } from './TodayTimeline';

function dt(day: number, hour: number, min = 0): Date {
  return new Date(2026, 5, day, hour, min, 0, 0);
}

function block(id: string, start: Date, end: Date): TimeBlock {
  return { id, start, end };
}

describe('TodayTimeline', () => {
  it('記録ゼロでも固定軸・nowマーカー・空状態を描画する', () => {
    const html = renderToStaticMarkup(
      <TodayTimeline blocks={[]} now={dt(21, 12)} />,
    );

    for (const label of ['5', '8', '11', '14', '17', '20', '23', '2']) {
      expect(html).toContain(`>${label}</text>`);
    }
    expect(html).toContain('まだ記録がありません');
    expect(html).toContain('stroke="var(--accent-border)"');
  });

  it('深夜またぎ区間をその日の窓に入る部分だけ帯として描画する', () => {
    const blocks = [block('a', dt(22, 3), dt(22, 7))];

    const previousDay = renderToStaticMarkup(
      <TodayTimeline blocks={blocks} now={dt(21, 12)} />,
    );
    expect(previousDay).toContain('x="1328"');
    expect(previousDay).toContain('width="120"');

    const currentDay = renderToStaticMarkup(
      <TodayTimeline blocks={blocks} now={dt(22, 12)} />,
    );
    expect(currentDay).toContain('x="8"');
    expect(currentDay).toContain('width="120"');
    expect(currentDay).not.toContain('まだ記録がありません');
  });
});
