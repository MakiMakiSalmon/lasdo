import type { NewTimeBlock, TimeBlock } from '../../domain/timeBlock';
import type { TimeBlockRepository } from '../timeBlockRepository';
import { db, type TimeBlockRow } from './db';

function toBlock(row: TimeBlockRow): TimeBlock {
  return { id: row.id, start: new Date(row.start), end: new Date(row.end) };
}

function toRow(block: TimeBlock): TimeBlockRow {
  return { id: block.id, start: block.start.getTime(), end: block.end.getTime() };
}

/** TimeBlockRepository の IndexedDB（Dexie）実装。 */
export class IndexedDbTimeBlockRepository implements TimeBlockRepository {
  async list(): Promise<TimeBlock[]> {
    const rows = await db.timeBlocks.orderBy('start').toArray();
    return rows.map(toBlock);
  }

  async add(block: NewTimeBlock): Promise<TimeBlock> {
    const created: TimeBlock = { id: crypto.randomUUID(), ...block };
    await db.timeBlocks.add(toRow(created));
    return created;
  }

  async update(block: TimeBlock): Promise<void> {
    await db.timeBlocks.put(toRow(block));
  }

  async delete(id: string): Promise<void> {
    await db.timeBlocks.delete(id);
  }
}
