import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase クライアントのシングルトン（フェーズ2 ⓪ 認証 / ② 同期で共有）。
 *
 * URL / anon key は環境変数で与える（`.env` / `.env.local`、`.env.example` 参照）。
 * **未設定なら null を返す**＝認証・同期は無効化され、アプリは IndexedDB 単独で
 * 従来どおり動く（オフライン先行。ログインは同期を有効化する任意機能）。
 *
 * user_id はこのクライアント経由で RLS + `default auth.uid()` が担保するため、
 * 上位（Repository / RemoteSyncSource）のドメイン型には一切出さない。
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // OAuth リダイレクト復帰時、URL の認可コード/ハッシュからセッションを復元する。
          detectSessionInUrl: true,
        },
      })
    : null;

/** Supabase が構成済み（env あり）かどうか。UI が「ログイン」を出すかの判定に使う。 */
export const isSupabaseConfigured = supabase !== null;
