import type { NewTimeBlock, TimeBlock } from '../domain/timeBlock';

/**
 * 時間区間の永続化の境界（requirements.md 10章）。
 *
 * UI・集計ロジックはこのインターフェース越しにのみデータへ触る。
 * 最初の実装は IndexedDB（単一端末）。将来スマホ同期/PCエージェントが必要に
 * なったら Supabase 実装へ差し替える想定で、UI 側は無変更で移行できる。
 *
 * これは素の CRUD に徹する。重なりマージ等のドメイン規則
 * （mergeBlocks）は上位（ストア/サービス層）で適用する。
 */
export interface TimeBlockRepository {
  /** 全区間を昇順（start 昇順）で返す。 */
  list(): Promise<TimeBlock[]>;
  /** 新規区間を追加し、採番済みの TimeBlock を返す。 */
  add(block: NewTimeBlock): Promise<TimeBlock>;
  /** 既存区間を id 一致で更新する。 */
  update(block: TimeBlock): Promise<void>;
  /** 区間を削除する。 */
  delete(id: string): Promise<void>;
  /**
   * 全区間を与えた集合で原子的に置き換える（MVP の全置換永続化）。
   * mergeBlocks で吸収・消滅した区間を残さない最も単純な反映手段。
   * 件数が増えたら差分反映（reconcile）へ切り替える想定（detailed-design 5.1）。
   */
  replaceAll(blocks: TimeBlock[]): Promise<void>;
}
