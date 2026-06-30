import type { SupabaseClient } from '@supabase/supabase-js';
import type { PushRow, RemoteRow, RemoteSyncSource } from './types';

/** time_blocks の行（DB カラム名）。user_id は RLS+default で扱うので select/insert しない。 */
interface TimeBlockDbRow {
  id: string;
  start_ms: number;
  end_ms: number;
  deleted: boolean;
  updated_at: string;
}

const TABLE = 'time_blocks';
const COLS = 'id,start_ms,end_ms,deleted,updated_at';

/**
 * RemoteSyncSource の Supabase 実装（フェーズ2 ②）。
 * 認証済みクライアントにスコープされ、RLS が自分の行だけに限定する。
 * user_id はクライアントから送らず・受け取らず、ドメイン型にも出さない。
 */
export class SupabaseRemoteSource implements RemoteSyncSource {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async pull(sinceIso: string | null): Promise<{ rows: RemoteRow[]; cursor: string | null }> {
    let q = this.client
      .from(TABLE)
      .select(COLS)
      .order('updated_at', { ascending: true });
    if (sinceIso) q = q.gt('updated_at', sinceIso);

    const { data, error } = await q;
    if (error) throw error;

    const rows: RemoteRow[] = ((data ?? []) as TimeBlockDbRow[]).map((r) => ({
      id: r.id,
      start: r.start_ms,
      end: r.end_ms,
      deleted: r.deleted,
      updatedAt: r.updated_at,
    }));
    const cursor = rows.length > 0 ? rows[rows.length - 1].updatedAt : sinceIso;
    return { rows, cursor };
  }

  async push(rows: PushRow[]): Promise<void> {
    if (rows.length === 0) return;
    // updated_at はサーバ trigger が刻む。user_id は default auth.uid()。
    const payload = rows.map((r) => ({
      id: r.id,
      start_ms: r.start,
      end_ms: r.end,
      deleted: r.deleted,
    }));
    const { error } = await this.client
      .from(TABLE)
      .upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  }
}
