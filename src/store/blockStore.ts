import { create } from 'zustand';
import { reconcile } from '../data/reconcile';
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
 * 永続化は旧→新の差分反映（reconcile）。触れた区間だけを add/update/delete し、
 * 書き込み増幅を避け、別タブ/端末の無関係な区間を巻き戻さない。
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
      const prev = get().blocks;
      const next = mergeBlocks([...prev, candidate]);
      await reconcile(repo, prev, next);
      set({ blocks: next });
    },

    async updateBlock(updated) {
      if (!isValidBlock(updated)) return;
      const prev = get().blocks;
      const rest = prev.filter((b) => b.id !== updated.id);
      const next = mergeBlocks([...rest, updated]);
      await reconcile(repo, prev, next);
      set({ blocks: next });
    },

    async deleteBlock(id) {
      const prev = get().blocks;
      const next = prev.filter((b) => b.id !== id);
      await reconcile(repo, prev, next);
      set({ blocks: next });
    },
  }));
}

/** アプリで使うシングルトン（IndexedDB に接続）。 */
export const useBlockStore = createBlockStore(timeBlockRepository);
