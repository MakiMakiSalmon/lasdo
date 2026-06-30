import { create } from 'zustand';
import type { NewTimeBlock } from '../domain/timeBlock';
import {
  longRunConfirmMessage,
  needsLongRunConfirm,
} from '../domain/timerGuard';
import { useBlockStore } from './blockStore';

/** 稼働中タイマーの開始時刻を退避する localStorage キー（リロード耐性）。 */
export const TIMER_STORAGE_KEY = 'lasdo:runningSince';

type MinimalStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * 円形タイマーの状態層（detailed-design 5.2）。
 *
 * 稼働中は TimeBlock として永続化しない。停止時に {start, end} を確定して
 * BlockStore.addBlock で1区間追加する。稼働中の開始時刻は localStorage に
 * 退避し、リロード/タブ閉じでも消えない（MVP 要件）。
 */
export interface TimerState {
  /** 稼働中の開始時刻。null = 停止中。 */
  runningSince: Date | null;
  /** 計測開始（既に稼働中なら何もしない）。 */
  start: () => void;
  /** 計測停止 → 区間を確定して BlockStore へ追加。 */
  stop: () => Promise<void>;
}

interface TimerDeps {
  /** 停止時に区間を追加する手段（既定: BlockStore シングルトン）。 */
  addBlock: (block: NewTimeBlock) => Promise<void>;
  /** 退避先（既定: localStorage、無ければ無効化）。 */
  storage?: MinimalStorage;
  /** 現在時刻（テスト用に差し替え可能）。 */
  now?: () => Date;
  /**
   * 長時間稼働（消し忘れ疑い）の保存可否を確認する。true=保存。
   * 既定: window.confirm。window 不在（テスト/SSR）では true（従来どおり保存）。
   */
  confirmLongRun?: (elapsedMs: number) => boolean | Promise<boolean>;
}

function defaultConfirmLongRun(elapsedMs: number): boolean {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
    return true;
  }
  return window.confirm(longRunConfirmMessage(elapsedMs));
}

function restore(storage?: MinimalStorage): Date | null {
  if (!storage) return null;
  const raw = storage.getItem(TIMER_STORAGE_KEY);
  if (!raw) return null;
  const ms = Number(raw);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

export function createTimerStore(deps: TimerDeps) {
  const {
    addBlock,
    storage,
    now = () => new Date(),
    confirmLongRun = defaultConfirmLongRun,
  } = deps;

  return create<TimerState>((set, get) => ({
    // 起動時に退避済みの開始時刻を復元（リロード耐性）。
    runningSince: restore(storage),

    start() {
      if (get().runningSince) return; // 二重開始を防ぐ
      const at = now();
      storage?.setItem(TIMER_STORAGE_KEY, String(at.getTime()));
      set({ runningSince: at });
    },

    async stop() {
      const since = get().runningSince;
      if (!since) return;
      // 停止操作の瞬間を区間の終端とする（確認ダイアログ中に伸びない）。
      const end = now();
      const elapsedMs = end.getTime() - since.getTime();

      // 消し忘れ疑い（極端に長い）は保存前に確認。拒否ならタイマー継続＝
      // 何も書き換えないので、内側の記録が吸収・消失する事故を防げる。
      if (needsLongRunConfirm(elapsedMs) && !(await confirmLongRun(elapsedMs))) {
        return;
      }

      // 停止状態へ（UI 即応＋多重 stop の防止）。
      set({ runningSince: null });
      storage?.removeItem(TIMER_STORAGE_KEY);
      // ゼロ幅・逆転は捨てる（addBlock 側でも弾かれるが明示）。
      if (elapsedMs > 0) {
        await addBlock({ start: since, end });
      }
    },
  }));
}

/** アプリで使うシングルトン。停止時に BlockStore へ確定する。 */
export const useTimerStore = createTimerStore({
  addBlock: (block) => useBlockStore.getState().addBlock(block),
  storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
});
