import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '../data/supabase/client';

/**
 * 認証状態（フェーズ2 ⓪）。
 *
 * - `disabled`: Supabase 未構成（env なし）。アプリは IndexedDB 単独で動く。
 * - `loading`: 既存セッション確認中。
 * - `signedIn` / `signedOut`: 構成済みでのログイン状態。
 *
 * ログインは**任意機能**（同期の有効化）。ログアウトでも記録・分析は使える
 * （オフライン先行）。ここではセッションだけ扱い、同期は SyncEngine（②）が担う。
 */
export type AuthStatus = 'loading' | 'signedIn' | 'signedOut' | 'disabled';

export interface AuthState {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  /** 起動時に1度呼ぶ。既存セッションを復元し、以降の変化を購読する。 */
  init: () => void;
  /** Google OAuth でログイン（ページ遷移する）。 */
  signInWithGoogle: () => Promise<void>;
  /** ログアウト。 */
  signOut: () => Promise<void>;
}

let initialized = false;

export const useAuthStore = create<AuthState>((set) => ({
  status: supabase ? 'loading' : 'disabled',
  user: null,
  session: null,

  init() {
    if (!supabase || initialized) return;
    initialized = true;

    const apply = (session: Session | null) =>
      set({
        session,
        user: session?.user ?? null,
        status: session ? 'signedIn' : 'signedOut',
      });

    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    supabase.auth.onAuthStateChange((_event, session) => apply(session));
  },

  async signInWithGoogle() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      // リダイレクト復帰先はこのアプリの URL（localhost / 本番とも Supabase の
      // Auth Redirect URLs に登録しておく。docs/supabase-setup.md 参照）。
      options: { redirectTo: window.location.origin },
    });
  },

  async signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  },
}));
