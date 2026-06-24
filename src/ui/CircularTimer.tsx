import { useEffect, useState } from 'react';
import { formatElapsed, gaugeState } from '../domain/timerGauge';
import { useTimerStore } from '../store/timerStore';
import styles from './CircularTimer.module.css';

/**
 * 円形タイマー（自前 SVG・detailed-design 6.1）。
 *
 * 中心 = 開始/停止トグル兼経過時間表示。内側の太いリング = 現在の単位(25分)の進捗。
 * 単位達成ごとに外周へ細い同心円リングを1本追加（緑＝超過は良いこと）。
 * 外周3本まで描き、4本目以降は ×N に集約。
 */

const SIZE = 220;
const C = SIZE / 2; // 中心
const INNER_R = 66;
const INNER_W = 16;
const OUTER_BASE_R = 82;
const OUTER_GAP = 9;
const OUTER_W = 5;
const INNER_CIRC = 2 * Math.PI * INNER_R;

/**
 * 経過時間テキストのフォントサイズ（px）。桁が増えても内側リング（内縁=半径58）に
 * 当たらないよう、文字数に応じて段階的に下げる。
 * "M:SS"/"MM:SS"=34, "H:MM:SS"=30, "HH:MM:SS" 以上=26。
 */
function timeFontSize(text: string): number {
  if (text.length <= 5) return 34;
  if (text.length <= 7) return 30;
  return 26;
}

export function CircularTimer() {
  const runningSince = useTimerStore((s) => s.runningSince);
  const start = useTimerStore((s) => s.start);
  const stop = useTimerStore((s) => s.stop);

  // 稼働中は1秒ごとに「現在時刻」を更新して経過を進める。
  // 時刻は state に持ち、レンダー中に Date.now() を読まない（純粋性）。
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!runningSince) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [runningSince]);

  const elapsedMs = runningSince
    ? Math.max(0, now - runningSince.getTime())
    : 0;
  const gauge = gaugeState(elapsedMs);
  const running = runningSince !== null;
  const timeStr = formatElapsed(elapsedMs);

  // 進捗アーク（上から時計回り）。
  const dashOffset = INNER_CIRC * (1 - gauge.progressInUnit);

  const toggle = () => {
    if (running) void stop();
    else start();
  };

  return (
    <button
      type="button"
      className={`${styles.button} ${running ? styles.running : ''}`}
      onClick={toggle}
      aria-label={running ? '計測を停止' : '計測を開始'}
      aria-pressed={running}
    >
      <svg className={styles.svg} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* 内側リング: トラック + 進捗アーク */}
        <circle
          className={styles.track}
          cx={C}
          cy={C}
          r={INNER_R}
          strokeWidth={INNER_W}
        />
        <circle
          className={styles.progress}
          cx={C}
          cy={C}
          r={INNER_R}
          strokeWidth={INNER_W}
          strokeDasharray={INNER_CIRC}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${C} ${C})`}
        />

        {/* 外周リング（完了した単位ぶん。集約時は1本） */}
        {Array.from({ length: gauge.outerRings }).map((_, i) => (
          <circle
            key={i}
            className={styles.outer}
            cx={C}
            cy={C}
            r={OUTER_BASE_R + i * OUTER_GAP}
            strokeWidth={OUTER_W}
          />
        ))}

        {/* 集約表示 ×N（4単位以上）。外周リング上端より上に置き、リングと被らせない。 */}
        {gauge.collapsed && (
          <text className={styles.count} x={C} y={C - OUTER_BASE_R - 8}>
            ×{gauge.completedUnits}
          </text>
        )}

        {/* 中央: 経過時間とラベル */}
        <text
          className={styles.time}
          x={C}
          y={C - 6}
          style={{ fontSize: timeFontSize(timeStr) }}
        >
          {timeStr}
        </text>
        <text className={styles.label} x={C} y={C + 28}>
          {running ? 'タップで停止' : 'タップで開始'}
        </text>
      </svg>
    </button>
  );
}
