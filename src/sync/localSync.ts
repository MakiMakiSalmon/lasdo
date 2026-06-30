import { db } from '../data/indexeddb/db';
import { reconcile } from '../data/reconcile';
import { timeBlockRepository } from '../data/repository';
import { mergeBlocks } from '../domain/timeBlock';
import type { DirtyRow, LocalSync, RemoteRow } from './types';

/**
 * LocalSync の Dexie 実装（フェーズ2 ②）。同期メタを持つローカル行を操作する。
 * 既存の Repository / mergeBlocks / reconcile を再利用する（重複ロジックを作らない）。
 */
export class DexieLocalSync implements LocalSync {
  async listDirty(): Promise<DirtyRow[]> {
    const rows = await db.timeBlocks.where('dirty').equals(1).toArray();
    return rows.map((r) => ({
      id: r.id,
      start: r.start,
      end: r.end,
      deleted: r.deleted === 1,
      updatedAt: r.updatedAt,
    }));
  }

  async markClean(refs: Array<{ id: string; updatedAt: number }>): Promise<void> {
    if (refs.length === 0) return;
    await db.transaction('rw', db.timeBlocks, async () => {
      for (const ref of refs) {
        const row = await db.timeBlocks.get(ref.id);
        // push 後に再編集されていたら（updatedAt が進んでいたら）clean にしない。
        if (row && row.updatedAt === ref.updatedAt) {
          await db.timeBlocks.update(ref.id, { dirty: 0 });
        }
      }
    });
  }

  async applyRemote(rows: RemoteRow[]): Promise<void> {
    if (rows.length === 0) return;
    await db.transaction('rw', db.timeBlocks, async () => {
      for (const r of rows) {
        const local = await db.timeBlocks.get(r.id);
        // 未送信のローカル編集(dirty)は守る（push で勝たせる）。
        if (local && local.dirty === 1) continue;
        await db.timeBlocks.put({
          id: r.id,
          start: r.start,
          end: r.end,
          updatedAt: Date.parse(r.updatedAt), // サーバ時刻を ms で保持
          deleted: r.deleted ? 1 : 0,
          dirty: 0,
        });
      }
    });
  }

  async normalize(): Promise<void> {
    // アクティブ集合（tombstone 除外）を mergeBlocks し、重なり統合の差分を反映。
    // reconcile は repo.add/update/delete を呼ぶ＝それぞれ dirty 化・ソフト削除になる。
    const active = await timeBlockRepository.list();
    const merged = mergeBlocks(active);
    await reconcile(timeBlockRepository, active, merged);
  }
}
