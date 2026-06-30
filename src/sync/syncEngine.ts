import type { DirtyRow, LocalSync, PushRow, RemoteSyncSource } from './types';

/**
 * 双方向同期エンジン（フェーズ2 ②・オフライン先行）。
 *
 * 1回の同期 = push → pull → normalize → push：
 *   1. ローカルの未送信編集(dirty)を push。
 *   2. カーソル以降のリモート変更を pull し、**clean な行だけ**上書き（dirty=未送信は守る）。
 *   3. normalize: 他端末由来の重なりを mergeBlocks で統合（クライアント権威・dirty 化）。
 *   4. 統合結果を push。
 *   5. onChanged で UI 反映。
 *
 * LWW は「dirty 行は pull で上書きしない／競合時は最後の push が勝つ」で実現し、
 * ローカル時計とサーバ時計を直接比較しない（クロック跨ぎを避ける）。
 * 多重起動は実行中フラグで直列化（実行中の要求は末尾で1回だけ再実行）。
 */
export interface SyncEngineDeps {
  local: LocalSync;
  remote: RemoteSyncSource;
  getCursor: () => string | null;
  setCursor: (cursor: string | null) => void;
  /** 同期後に UI を更新する（既定: 何もしない。App では blockStore.load を渡す）。 */
  onChanged?: () => void | Promise<void>;
  /** 同期エラー通知（既定: console.warn）。 */
  onError?: (err: unknown) => void;
}

export interface SyncEngine {
  syncNow(): Promise<void>;
}

function toPushRow(d: DirtyRow): PushRow {
  return { id: d.id, start: d.start, end: d.end, deleted: d.deleted };
}

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const { local, remote, getCursor, setCursor, onChanged, onError } = deps;

  let running = false;
  let queued = false;

  async function flush(): Promise<void> {
    const dirty = await local.listDirty();
    if (dirty.length === 0) return;
    await remote.push(dirty.map(toPushRow));
    await local.markClean(
      dirty.map((d) => ({ id: d.id, updatedAt: d.updatedAt })),
    );
  }

  async function runOnce(): Promise<void> {
    await flush(); // 1) ローカル編集を push
    const { rows, cursor } = await remote.pull(getCursor()); // 2) pull
    if (rows.length > 0) await local.applyRemote(rows);
    if (cursor) setCursor(cursor);
    await local.normalize(); // 3) 重なり統合（dirty 化しうる）
    await flush(); // 4) 統合結果を push
    await onChanged?.();
  }

  async function syncNow(): Promise<void> {
    if (running) {
      queued = true;
      return;
    }
    running = true;
    try {
      do {
        queued = false;
        await runOnce();
      } while (queued);
    } catch (e) {
      if (onError) onError(e);
      else console.warn('[sync] failed', e);
    } finally {
      running = false;
    }
  }

  return { syncNow };
}
