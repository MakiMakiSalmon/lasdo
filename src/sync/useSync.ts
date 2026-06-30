import { useEffect } from 'react';
import { supabase } from '../data/supabase/client';
import { useAuthStore } from '../store/authStore';
import { useBlockStore } from '../store/blockStore';
import { makeCursorStore } from './cursor';
import { DexieLocalSync } from './localSync';
import { SupabaseRemoteSource } from './supabaseRemoteSource';
import { createSyncEngine } from './syncEngine';

const PULL_INTERVAL_MS = 30_000;
const PUSH_DEBOUNCE_MS = 800;

/**
 * 認証時に SyncEngine を起動・停止する配線（フェーズ2 ②）。
 *
 * トリガ: 起動直後 / ローカル編集（デバウンス）/ フォーカス・オンライン復帰 / 一定間隔。
 * ローカル編集の検知は blockStore 購読で行うが、onChanged の load() による更新は
 * `applying` ガードで無視し、同期→load→同期 の無限ループを防ぐ。
 */
export function useSync(): void {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  useEffect(() => {
    if (status !== 'signedIn' || !userId || !supabase) return;

    const cursor = makeCursorStore(userId);
    let applying = false;

    const engine = createSyncEngine({
      local: new DexieLocalSync(),
      remote: new SupabaseRemoteSource(supabase),
      getCursor: cursor.get,
      setCursor: cursor.set,
      onChanged: async () => {
        applying = true;
        try {
          await useBlockStore.getState().load();
        } finally {
          applying = false;
        }
      },
    });

    const sync = () => void engine.syncNow();

    let debounceId: ReturnType<typeof setTimeout> | undefined;
    const debouncedSync = () => {
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(sync, PUSH_DEBOUNCE_MS);
    };

    sync(); // 起動直後に1回
    const intervalId = setInterval(sync, PULL_INTERVAL_MS);
    window.addEventListener('focus', sync);
    window.addEventListener('online', sync);

    // ローカル編集で push を促す（onChanged 由来の更新は applying で除外）。
    const unsub = useBlockStore.subscribe((s, prev) => {
      if (s.blocks !== prev.blocks && !applying) debouncedSync();
    });

    return () => {
      if (debounceId) clearTimeout(debounceId);
      clearInterval(intervalId);
      window.removeEventListener('focus', sync);
      window.removeEventListener('online', sync);
      unsub();
    };
  }, [status, userId]);
}
