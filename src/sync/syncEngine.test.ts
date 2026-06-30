import { beforeEach, describe, expect, it } from 'vitest';
import { mergeBlocks } from '../domain/timeBlock';
import { createSyncEngine } from './syncEngine';
import type {
  DirtyRow,
  LocalSync,
  PushRow,
  RemoteRow,
  RemoteSyncSource,
} from './types';

/** サーバ役。push で updated_at をサーバ時計として刻む（ISO・単調増加）。 */
class FakeRemote implements RemoteSyncSource {
  rows = new Map<string, RemoteRow>();
  pushedBatches: PushRow[][] = [];
  private clock = 2000;

  async pull(since: string | null) {
    const all = [...this.rows.values()].sort((a, b) =>
      a.updatedAt.localeCompare(b.updatedAt),
    );
    const filtered = since ? all.filter((r) => r.updatedAt > since) : all;
    const cursor =
      filtered.length > 0 ? filtered[filtered.length - 1].updatedAt : since;
    return { rows: filtered.map((r) => ({ ...r })), cursor };
  }

  async push(rows: PushRow[]) {
    this.pushedBatches.push(rows);
    for (const r of rows) {
      const updatedAt = new Date(this.clock++).toISOString();
      this.rows.set(r.id, { ...r, updatedAt });
    }
  }
}

interface LocalRow {
  id: string;
  start: number;
  end: number;
  deleted: boolean;
  dirty: boolean;
  updatedAt: number;
}

/** ローカル役。DexieLocalSync の契約を忠実に再現（dirty 行は applyRemote で守る）。 */
class FakeLocal implements LocalSync {
  rows = new Map<string, LocalRow>();
  private clock = 1;

  seed(row: Partial<LocalRow> & Pick<LocalRow, 'id' | 'start' | 'end'>) {
    this.rows.set(row.id, {
      deleted: false,
      dirty: false,
      updatedAt: this.clock++,
      ...row,
    });
  }

  async listDirty(): Promise<DirtyRow[]> {
    return [...this.rows.values()]
      .filter((r) => r.dirty)
      .map((r) => ({
        id: r.id,
        start: r.start,
        end: r.end,
        deleted: r.deleted,
        updatedAt: r.updatedAt,
      }));
  }

  async markClean(refs: Array<{ id: string; updatedAt: number }>) {
    for (const ref of refs) {
      const row = this.rows.get(ref.id);
      if (row && row.updatedAt === ref.updatedAt) row.dirty = false;
    }
  }

  async applyRemote(remoteRows: RemoteRow[]) {
    for (const r of remoteRows) {
      const local = this.rows.get(r.id);
      if (local && local.dirty) continue; // 未送信編集は守る
      this.rows.set(r.id, {
        id: r.id,
        start: r.start,
        end: r.end,
        deleted: r.deleted,
        dirty: false,
        updatedAt: Date.parse(r.updatedAt),
      });
    }
  }

  async normalize() {
    const active = [...this.rows.values()]
      .filter((r) => !r.deleted)
      .map((r) => ({
        id: r.id,
        start: new Date(r.start),
        end: new Date(r.end),
      }));
    const merged = mergeBlocks(active);
    const mergedById = new Map(merged.map((b) => [b.id, b]));
    for (const a of active) {
      if (!mergedById.has(a.id)) {
        const row = this.rows.get(a.id)!;
        row.deleted = true;
        row.dirty = true;
        row.updatedAt = this.clock++;
      }
    }
    for (const b of merged) {
      const row = this.rows.get(b.id)!;
      if (row.start !== b.start.getTime() || row.end !== b.end.getTime()) {
        row.start = b.start.getTime();
        row.end = b.end.getTime();
        row.dirty = true;
        row.updatedAt = this.clock++;
      }
    }
  }
}

function makeEngine(local: FakeLocal, remote: FakeRemote) {
  let cursor: string | null = null;
  const engine = createSyncEngine({
    local,
    remote,
    getCursor: () => cursor,
    setCursor: (c) => {
      cursor = c;
    },
  });
  return { engine, getCursor: () => cursor };
}

describe('syncEngine', () => {
  let local: FakeLocal;
  let remote: FakeRemote;

  beforeEach(() => {
    local = new FakeLocal();
    remote = new FakeRemote();
  });

  it('dirty 行を push し、push 後に clean 化する', async () => {
    local.seed({ id: 'a', start: 100, end: 200, dirty: true });
    const { engine } = makeEngine(local, remote);

    await engine.syncNow();

    expect(remote.rows.get('a')).toMatchObject({
      start: 100,
      end: 200,
      deleted: false,
    });
    expect(local.rows.get('a')!.dirty).toBe(false);
  });

  it('pull したリモート行を（clean な）ローカルへ反映する', async () => {
    remote.rows.set('b', {
      id: 'b',
      start: 300,
      end: 400,
      deleted: false,
      updatedAt: new Date(2500).toISOString(),
    });
    const { engine, getCursor } = makeEngine(local, remote);

    await engine.syncNow();

    expect(local.rows.get('b')).toMatchObject({
      start: 300,
      end: 400,
      deleted: false,
      dirty: false,
    });
    expect(getCursor()).toBe(new Date(2500).toISOString()); // カーソル前進
  });

  it('tombstone を伝播する（remote 削除→local 削除）', async () => {
    local.seed({ id: 'c', start: 100, end: 200 }); // clean
    remote.rows.set('c', {
      id: 'c',
      start: 100,
      end: 200,
      deleted: true,
      updatedAt: new Date(2500).toISOString(),
    });
    const { engine } = makeEngine(local, remote);

    await engine.syncNow();

    expect(local.rows.get('c')!.deleted).toBe(true);
  });

  it('pull 後マージで他端末由来の重なりを統合し、結果を push する', async () => {
    // ローカル x[100,200]（clean）に、リモートから重なる y[150,300] が来る。
    local.seed({ id: 'x', start: 100, end: 200 });
    remote.rows.set('y', {
      id: 'y',
      start: 150,
      end: 300,
      deleted: false,
      updatedAt: new Date(2500).toISOString(),
    });
    const { engine } = makeEngine(local, remote);

    await engine.syncNow();

    // x が [100,300] に伸び、y は吸収されて tombstone。
    expect(local.rows.get('x')).toMatchObject({ start: 100, end: 300 });
    expect(local.rows.get('y')!.deleted).toBe(true);
    // 統合結果がサーバへ伝播している。
    expect(remote.rows.get('x')).toMatchObject({
      start: 100,
      end: 300,
      deleted: false,
    });
    expect(remote.rows.get('y')!.deleted).toBe(true);
  });

  it('dirty なローカル行は pull 中のリモート別行反映と干渉しない', async () => {
    // d は未送信編集（dirty）。e はリモートのみ。両者が共存して同期できる。
    local.seed({ id: 'd', start: 100, end: 200, dirty: true });
    remote.rows.set('e', {
      id: 'e',
      start: 500,
      end: 600,
      deleted: false,
      updatedAt: new Date(2500).toISOString(),
    });
    const { engine } = makeEngine(local, remote);

    await engine.syncNow();

    expect(remote.rows.get('d')).toMatchObject({ start: 100, end: 200 }); // d は push 済み
    expect(local.rows.get('e')).toMatchObject({ start: 500, end: 600 }); // e は反映済み
    expect(local.rows.get('d')!.dirty).toBe(false);
  });
});
