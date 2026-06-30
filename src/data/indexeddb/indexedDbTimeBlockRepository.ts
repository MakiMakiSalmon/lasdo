import type { TimeBlock } from '../../domain/timeBlock';
import type { TimeBlockRepository } from '../timeBlockRepository';
import { db, type TimeBlockRow } from './db';

function toBlock(row: TimeBlockRow): TimeBlock {
  return { id: row.id, start: new Date(row.start), end: new Date(row.end) };
}

/** ローカル書込行を作る。書込のたび dirty=1・updatedAt=now（同期メタ）。 */
function toDirtyRow(block: TimeBlock, deleted: 0 | 1): TimeBlockRow {
  return {
    id: block.id,
    start: block.start.getTime(),
    end: block.end.getTime(),
    updatedAt: Date.now(),
    deleted,
    dirty: 1,
  };
}

/**
 * TimeBlockRepository の IndexedDB（Dexie）実装。
 *
 * ドメインの CRUD 越しに同期メタ（updatedAt/deleted/dirty）を内部管理する。
 * - add/update: dirty=1・updatedAt=now で書く。
 * - delete: 物理削除せず**ソフト削除**（deleted=1・dirty=1）。tombstone を同期で伝播。
 * - list: tombstone を除外して返す。
 * メタは toBlock で落とすため、ドメイン（TimeBlock）には一切出さない。
 */
export class IndexedDbTimeBlockRepository implements TimeBlockRepository {
  async list(): Promise<TimeBlock[]> {
    const rows = await db.timeBlocks.orderBy('start').toArray();
    return rows.filter((r) => r.deleted === 0).map(toBlock);
  }

  async add(block: TimeBlock): Promise<void> {
    await db.timeBlocks.add(toDirtyRow(block, 0));
  }

  async update(block: TimeBlock): Promise<void> {
    await db.timeBlocks.put(toDirtyRow(block, 0));
  }

  async delete(id: string): Promise<void> {
    // ソフト削除（行は残し tombstone 化）。存在しない id は no-op。
    await db.timeBlocks.update(id, {
      deleted: 1,
      dirty: 1,
      updatedAt: Date.now(),
    });
  }
}
