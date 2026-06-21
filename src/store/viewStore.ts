import { create } from 'zustand';

/** フェーズ1の3画面（detailed-design 5.3）。 */
export type View = 'record' | 'analysis' | 'edit';

/**
 * 画面切替の状態層。react-router は入れず view 状態だけで出し分ける
 * （MVP の3画面には最軽量。URL 同期が必要になったら router へ移行）。
 */
export interface ViewState {
  /** 現在の画面。既定 'record'。 */
  view: View;
  /** 画面遷移。 */
  go: (view: View) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  view: 'record',
  go: (view) => set({ view }),
}));
