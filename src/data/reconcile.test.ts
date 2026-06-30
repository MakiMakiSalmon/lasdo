import { describe, expect, it } from 'vitest';
import type { TimeBlock } from '../domain/timeBlock';
import type { TimeBlockRepository } from './timeBlockRepository';
import { reconcile } from './reconcile';

/** 呼び出しを記録する spy repo（書き込み増幅の解消＝最小差分を検証する）。 */
class SpyRepo implements TimeBlockRepository {
  added: string[] = [];
  updated: string[] = [];
  deleted: string[] = [];

  async list(): Promise<TimeBlock[]> {
    return [];
  }
  async add(block: TimeBlock): Promise<void> {
    this.added.push(block.id);
  }
  async update(block: TimeBlock): Promise<void> {
    this.updated.push(block.id);
  }
  async delete(id: string): Promise<void> {
    this.deleted.push(id);
  }
}

function blk(id: string, h1: number, h2: number): TimeBlock {
  return {
    id,
    start: new Date(2026, 5, 21, h1, 0, 0, 0),
    end: new Date(2026, 5, 21, h2, 0, 0, 0),
  };
}

describe('reconcile', () => {
  it('1件追加では add 1 回だけ（既存は触らない＝書き込み増幅なし）', async () => {
    const repo = new SpyRepo();
    const prev = [blk('a', 9, 10), blk('b', 12, 13)];
    const next = [...prev, blk('c', 15, 16)];
    await reconcile(repo, prev, next);
    expect(repo.added).toEqual(['c']);
    expect(repo.updated).toEqual([]);
    expect(repo.deleted).toEqual([]);
  });

  it('変化なしなら何も書かない', async () => {
    const repo = new SpyRepo();
    const prev = [blk('a', 9, 10), blk('b', 12, 13)];
    const next = [blk('a', 9, 10), blk('b', 12, 13)];
    await reconcile(repo, prev, next);
    expect(repo.added).toEqual([]);
    expect(repo.updated).toEqual([]);
    expect(repo.deleted).toEqual([]);
  });

  it('マージで吸収された区間は delete、端が伸びた区間は update', async () => {
    const repo = new SpyRepo();
    // a(9-10) と b(10-11) が a(9-11) に統合され、b が消えたケース。
    const prev = [blk('a', 9, 10), blk('b', 10, 11)];
    const next = [blk('a', 9, 11)];
    await reconcile(repo, prev, next);
    expect(repo.deleted).toEqual(['b']);
    expect(repo.updated).toEqual(['a']); // end が 10→11 に変化
    expect(repo.added).toEqual([]);
  });

  it('ユーザー削除は delete のみ', async () => {
    const repo = new SpyRepo();
    const prev = [blk('a', 9, 10), blk('b', 12, 13)];
    const next = [blk('a', 9, 10)];
    await reconcile(repo, prev, next);
    expect(repo.deleted).toEqual(['b']);
    expect(repo.added).toEqual([]);
    expect(repo.updated).toEqual([]);
  });
});
