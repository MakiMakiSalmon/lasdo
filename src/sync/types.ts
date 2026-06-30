/**
 * 同期で扱う行（フェーズ2 ②）。ドメインの TimeBlock とは別物で、同期メタを持つ。
 * 日時は epoch ミリ秒（ローカル IndexedDB / サーバの bigint と同形）。
 */

/** サーバ（Supabase）が返す行。updatedAt はサーバ時計の timestamptz(ISO)。 */
export interface RemoteRow {
  id: string;
  start: number;
  end: number;
  deleted: boolean;
  updatedAt: string;
}

/** サーバへ送る行。updated_at はサーバ trigger が刻むので送らない。user_id も送らない（RLS+default）。 */
export type PushRow = Pick<RemoteRow, 'id' | 'start' | 'end' | 'deleted'>;

/** ローカルの未 push 行。updatedAt はローカル時計(epoch ms)で、markClean の照合に使う。 */
export interface DirtyRow extends PushRow {
  updatedAt: number;
}

/** サーバ側データソースの境界（Supabase 実装は supabaseRemoteSource）。user_id は出さない。 */
export interface RemoteSyncSource {
  /** since(ISO) より後の更新行と、次回用カーソル(最大 updated_at)を返す。 */
  pull(sinceIso: string | null): Promise<{ rows: RemoteRow[]; cursor: string | null }>;
  /** 行を upsert する（tombstone 含む）。 */
  push(rows: PushRow[]): Promise<void>;
}

/** ローカル(IndexedDB)側の同期操作の境界。SyncEngine をテスト可能にするため抽象化する。 */
export interface LocalSync {
  /** 未 push（dirty=1）の行を返す。 */
  listDirty(): Promise<DirtyRow[]>;
  /** push 済みの行を clean 化する。updatedAt が push 時から変わっていれば（再編集）clean にしない。 */
  markClean(refs: Array<{ id: string; updatedAt: number }>): Promise<void>;
  /** リモート行をローカルへ反映する。**dirty なローカル行は上書きしない**（未送信編集を勝たせる）。 */
  applyRemote(rows: RemoteRow[]): Promise<void>;
  /** アクティブ集合に mergeBlocks を適用し、重なりを統合した差分をローカルへ反映（dirty 化）。 */
  normalize(): Promise<void>;
}
