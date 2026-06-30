import type { TimeBlock } from '../domain/timeBlock';

/**
 * 時間区間の永続化の境界（requirements.md 10章）。
 *
 * UI・集計ロジックはこのインターフェース越しにのみデータへ触る。
 * 最初の実装は IndexedDB（単一端末）。将来スマホ同期/PCエージェントが必要に
 * なったら Supabase 実装へ差し替える想定で、UI 側は無変更で移行できる。
 *
 * これは素の CRUD に徹する。重なりマージ等のドメイン規則
 * （mergeBlocks）は上位（ストア/サービス層）で適用する。
 *
 * id はクライアント（ドメイン/ストア）が採番し、追加から同期まで安定させる。
 * これにより BlockStore は旧→新の差分を id で取り、変更した区間だけを
 * add/update/delete する（reconcile・detailed-design 5.1）。全置換は廃止。
 */
export interface TimeBlockRepository {
  /** 全区間を昇順（start 昇順）で返す。 */
  list(): Promise<TimeBlock[]>;
  /** 採番済みの区間を追加する（id はクライアント生成）。 */
  add(block: TimeBlock): Promise<void>;
  /** 既存区間を id 一致で更新する。 */
  update(block: TimeBlock): Promise<void>;
  /** 区間を削除する。 */
  delete(id: string): Promise<void>;
}
