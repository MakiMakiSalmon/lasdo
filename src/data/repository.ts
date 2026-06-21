import { IndexedDbTimeBlockRepository } from './indexeddb/indexedDbTimeBlockRepository';
import type { TimeBlockRepository } from './timeBlockRepository';

/**
 * アプリが使う TimeBlockRepository の実体。
 * 保存先を切り替えるときはこの 1 行を差し替える（例: 将来 Supabase 実装へ）。
 */
export const timeBlockRepository: TimeBlockRepository = new IndexedDbTimeBlockRepository();
