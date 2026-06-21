import { create } from 'zustand';
import { timeBlockRepository } from '../data/repository';
import type { TimeBlockRepository } from '../data/timeBlockRepository';
import {
  isValidBlock,
  mergeBlocks,
  type NewTimeBlock,
  type TimeBlock,
} from '../domain/timeBlock';

/**
 * アクティブ区間の状態層（detailed-design 5.1）。
 *
 * Domain 規則（isValidBlock / mergeBlocks）を適用してから Repository を呼ぶ。
 * UI・集計はこのストア越しにのみデータへ触る（Repository を直接叩かない）。
 * 永続化は MVP の全置換方式（repo.replaceAll）。
 */
export interface BlockState {
  /** マージ済み・start 昇順の区間。 */
  blocks: TimeBlock[];
  /** Repository から読み込み、マージして state に反映。 */
  load: () => Promise<void>;
  /** 新規区間を追加（検証→マージ→全置換永続化）。不正区間は無視。 */
  addBlock: (block: NewTimeBlock) => Promise<void>;
  /** 既存区間を id 一致で更新（端の伸縮で隣接マージが起きうる）。不正区間は無視。 */
  updateBlock: (block: TimeBlock) => Promise<void>;
  /** 区間を削除。 */
  deleteBlock: (id: string) => Promise<void>;
}

export function createBlockStore(repo: TimeBlockRepository) {
  return create<BlockState>((set, get) => ({
    blocks: [],

    async load() {
      // 念のためマージしてから持つ（不正・重なりを正規化）。
      set({ blocks: mergeBlocks(await repo.list()) });
    },

    async addBlock(input) {
      if (!isValidBlock(input)) return;
      const candidate: TimeBlock = { id: crypto.randomUUID(), ...input };
      const next = mergeBlocks([...get().blocks, candidate]);
      await repo.replaceAll(next);
      set({ blocks: next });
    },

    async updateBlock(updated) {
      if (!isValidBlock(updated)) return;
      const rest = get().blocks.filter((b) => b.id !== updated.id);
      const next = mergeBlocks([...rest, updated]);
      await repo.replaceAll(next);
      set({ blocks: next });
    },

    async deleteBlock(id) {
      const next = get().blocks.filter((b) => b.id !== id);
      await repo.replaceAll(next);
      set({ blocks: next });
    },
  }));
}

/** アプリで使うシングルトン（IndexedDB に接続）。 */
export const useBlockStore = createBlockStore(timeBlockRepository);
