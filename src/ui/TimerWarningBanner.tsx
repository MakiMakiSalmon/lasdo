import { formatLongDuration, shouldWarnLongRun } from '../domain/timerGuard';
import { useElapsedMs } from './useElapsedMs';
import styles from './TimerWarningBanner.module.css';

/**
 * 長時間稼働の警告バナー（消し忘れガード・予防）。
 *
 * タイマーが閾値（既定 6 時間）を超えて動いている間だけ記録画面に表示する。
 * 停止中・閾値未満では何も描かない。判定は 1 分粒度で十分。
 */
export function TimerWarningBanner() {
  const elapsedMs = useElapsedMs(60_000);
  if (!shouldWarnLongRun(elapsedMs)) return null;

  return (
    <div className={styles.banner} role="status">
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="9" fill="none" strokeWidth="2" />
        <path d="M12 7.5v5l3 2" fill="none" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className={styles.text}>
        タイマーが {formatLongDuration(elapsedMs)} 動いています。消し忘れていませんか？
      </span>
    </div>
  );
}
