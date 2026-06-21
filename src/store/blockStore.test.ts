import { beforeEach, describe, expect, it } from 'vitest';
import type { TimeBlockRepository } from '../data/timeBlockRepository';
import type { NewTimeBlock, TimeBlock } from '../domain/timeBlock';
import { createBlockStore } from './blockStore';

/** in-memory な Repository フェイク（replaceAll 中心の全置換方式を検証）。 */
class FakeRepo implements TimeBlockRepository {
  rows: TimeBlock[] = [];
  private seq = 0;

  async list(): Promise<TimeBlock[]> {
    return [...this.rows].sort((a, b) => a.start.getTime() - b.start.getTime());
  }
  async add(block: NewTimeBlock): Promise<TimeBlock> {
    const created: TimeBlock = { id: `r${++this.seq}`, ...block };
    this.rows.push(created);
    return created;
  }
  async update(block: TimeBlock): Promise<void> {
    this.rows = this.rows.map((b) => (b.id === block.id ? block : b));
  }
  async delete(id: string): Promise<void> {
    this.rows = this.rows.filter((b) => b.id !== id);
  }
  async replaceAll(blocks: TimeBlock[]): Promise<void> {
    this.rows = blocks.map((b) => ({ ...b }));
  }
}

function dt(h: number, m = 0): Date {
  return new Date(2026, 5, 21, h, m, 0, 0);
}
function spans(blocks: TimeBlock[]): string[] {
  const p = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return blocks.map((b) => `${p(b.start)}-${p(b.end)}`);
}

describe('blockStore', () => {
  let repo: FakeRepo;
  let store: ReturnType<typeof createBlockStore>;

  beforeEach(() => {
    repo = new FakeRepo();
    store = createBlockStore(repo);
  });

  it('load は repo の内容をマージして取り込む', async () => {
    await repo.replaceAll([
      { id: 'a', start: dt(9), end: dt(11) },
      { id: 'b', start: dt(10), end: dt(12) }, // a と重なる
    ]);
    await store.getState().load();
    expect(spans(store.getState().blocks)).toEqual(['09:00-12:00']);
  });

  it('addBlock は検証→マージ→永続化し state と repo を一致させる', async () => {
    await store.getState().addBlock({ start: dt(9), end: dt(10) });
    await store.getState().addBlock({ start: dt(10), end: dt(11) }); // 隣接→統合
    expect(spans(store.getState().blocks)).toEqual(['09:00-11:00']);
    expect(spans(await repo.list())).toEqual(['09:00-11:00']);
    // マージで吸収された区間が repo に残っていない（全置換の要点）。
    expect(repo.rows).toHaveLength(1);
  });

  it('addBlock は不正区間（ゼロ幅・逆転）を無視する', async () => {
    await store.getState().addBlock({ start: dt(9), end: dt(9) });
    await store.getState().addBlock({ start: dt(11), end: dt(10) });
    expect(store.getState().blocks).toHaveLength(0);
    expect(repo.rows).toHaveLength(0);
  });

  it('updateBlock は端の伸長で隣接区間を統合する', async () => {
    await store.getState().addBlock({ start: dt(9), end: dt(10) });
    await store.getState().addBlock({ start: dt(12), end: dt(13) });
    const [first] = store.getState().blocks;
    // 9-10 を 9-12 へ伸ばす → 12-13 と隣接して統合
    await store.getState().updateBlock({ ...first, end: dt(12) });
    expect(spans(store.getState().blocks)).toEqual(['09:00-13:00']);
    expect(repo.rows).toHaveLength(1);
  });

  it('deleteBlock は該当区間を state と repo から消す', async () => {
    await store.getState().addBlock({ start: dt(9), end: dt(10) });
    await store.getState().addBlock({ start: dt(12), end: dt(13) });
    const target = store.getState().blocks[0];
    await store.getState().deleteBlock(target.id);
    expect(spans(store.getState().blocks)).toEqual(['12:00-13:00']);
    expect(repo.rows).toHaveLength(1);
  });
});
