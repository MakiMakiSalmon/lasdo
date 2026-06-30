import type { TimeBlock } from '../domain/timeBlock';
import { CircularTimer } from './CircularTimer';
import { TimerWarningBanner } from './TimerWarningBanner';
import { TodayTimeline } from './TodayTimeline';
import styles from './RecordScreen.module.css';

/**
 * 記録画面（毎日・ミニマル・detailed-design 6）。
 * 円形タイマーを中央に据え、その下に今日のタイムラインだけを置く。
 * ブロック一覧リストは置かない（編集は別画面）。
 */
export interface RecordScreenProps {
  blocks: TimeBlock[];
}

export function RecordScreen({ blocks }: RecordScreenProps) {
  return (
    <div className={styles.screen}>
      <TimerWarningBanner />
      <div className={styles.timer}>
        <CircularTimer />
      </div>
      <div className={styles.timeline}>
        <TodayTimeline blocks={blocks} />
      </div>
    </div>
  );
}
