import { useEffect, useState } from 'react';
import { useTimerStore } from '../store/timerStore';

/**
 * 稼働中タイマーの経過ミリ秒をライブ更新で返す（停止中は 0）。
 *
 * 円形タイマーと警告バナーで共有する。時刻は state に持ち、レンダー中に
 * Date.now() を読まない（純粋性）。更新粒度は用途に応じて指定する
 * （表示は 1 秒、長時間ガードの判定なら 1 分で十分）。
 */
export function useElapsedMs(intervalMs = 1000): number {
  const runningSince = useTimerStore((s) => s.runningSince);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!runningSince) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [runningSince, intervalMs]);

  return runningSince ? Math.max(0, now - runningSince.getTime()) : 0;
}
