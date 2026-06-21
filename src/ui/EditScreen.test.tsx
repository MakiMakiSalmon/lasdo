import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeBlock } from '../domain/timeBlock';
import { EditScreen } from './EditScreen';

const blockStoreMock = vi.hoisted(() => ({
  state: { blocks: [] as TimeBlock[] },
  addBlock: vi.fn(),
  updateBlock: vi.fn(),
  deleteBlock: vi.fn(),
}));

vi.mock('../store/blockStore', () => ({
  useBlockStore: (selector: (state: unknown) => unknown) =>
    selector({
      blocks: blockStoreMock.state.blocks,
      addBlock: blockStoreMock.addBlock,
      updateBlock: blockStoreMock.updateBlock,
      deleteBlock: blockStoreMock.deleteBlock,
    }),
}));

function block(id: string, start: Date, end: Date): TimeBlock {
  return { id, start, end };
}

describe('EditScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 21, 12, 0, 0));
    blockStoreMock.state.blocks = [];
  });

  afterEach(() => {
    blockStoreMock.state.blocks = [];
    vi.useRealTimers();
  });

  it('追加フォームの初期値は25分前から現在で、変更なしの保存は無効', () => {
    blockStoreMock.state.blocks = [
      block(
        'a',
        new Date(2026, 5, 21, 9, 0, 0),
        new Date(2026, 5, 21, 10, 0, 0),
      ),
    ];

    const html = renderToStaticMarkup(<EditScreen />);

    expect(html).toContain('value="2026-06-21T11:35"');
    expect(html).toContain('value="2026-06-21T12:00"');
    expect(html).toContain('value="2026-06-21T09:00"');
    expect(html).toContain('value="2026-06-21T10:00"');
    expect(html).toContain('disabled="">保存');
  });

  it('最近の記録は開始が新しい順に最大30件だけ表示する', () => {
    const blocks = Array.from({ length: 35 }, (_, i) =>
      block(
        `b${i}`,
        new Date(2026, 5, 1 + i, 9, 0, 0),
        new Date(2026, 5, 1 + i, 10, 0, 0),
      ),
    );
    blockStoreMock.state.blocks = blocks;

    const html = renderToStaticMarkup(<EditScreen />);

    expect(html.match(/<li/g)?.length).toBe(30);
    expect(html.indexOf('value="2026-07-05T09:00"')).toBeLessThan(
      html.indexOf('value="2026-07-04T09:00"'),
    );
    expect(html).not.toContain('value="2026-06-01T09:00"');
  });
});
