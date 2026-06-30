import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import styles from './AuthControl.module.css';

/**
 * 最小の認証コントロール（フェーズ2 ⓪）。
 *
 * - Supabase 未構成（disabled）/確認中（loading）は何も出さない（ミニマル方針）。
 * - 未ログイン: 「Googleでログイン」。ログイン中: メール＋「ログアウト」。
 *
 * ログインは同期を有効化する任意機能。出さなくても記録・分析は使える。
 */
export function AuthControl() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const init = useAuthStore((s) => s.init);
  const signIn = useAuthStore((s) => s.signInWithGoogle);
  const signOut = useAuthStore((s) => s.signOut);

  useEffect(() => {
    init();
  }, [init]);

  if (status === 'disabled' || status === 'loading') return null;

  return (
    <div className={styles.auth}>
      {status === 'signedIn' ? (
        <>
          <span className={styles.email} title={user?.email ?? ''}>
            {user?.email}
          </span>
          <button type="button" className={styles.btn} onClick={() => void signOut()}>
            ログアウト
          </button>
        </>
      ) : (
        <button type="button" className={styles.btn} onClick={() => void signIn()}>
          Googleでログイン
        </button>
      )}
    </div>
  );
}
