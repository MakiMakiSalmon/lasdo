import type { TimeBlock } from '../domain/timeBlock';
import { ActivityCalendar } from './ActivityCalendar';
import { ThisWeekChart } from './ThisWeekChart';
import styles from './AnalysisScreen.module.css';

/**
 * 分析画面（たまに見る・detailed-design 6.3）。
 *
 * いまは活動カレンダー（草＋欄外の曜日平均）の1要素のみ。期間プリセットは廃止し、
 * 集計は固定窓（直近12週）。開始/終了の箱ひげは残すか再検討中のため、ひとまず外している。
 */
export interface AnalysisScreenProps {
  blocks: TimeBlock[];
  /** 集計基準の現在時刻（既定 = 現在）。 */
  now?: Date;
}

export function AnalysisScreen({ blocks, now }: AnalysisScreenProps) {
  return (
    <div className={styles.screen}>
      <section className={styles.section}>
        <div className={styles.headerRow}>
          <div className={styles.calTitleBlock}>
            <h2 className={styles.sectionTitle}>活動カレンダー</h2>
            <p className={styles.sectionNote}>
              1マス＝1日の活動量（直近12週）。右は曜日ごとの平均/日。
            </p>
          </div>
          <h2 className={`${styles.sectionTitle} ${styles.weekTitle}`}>今週の作業時間</h2>
        </div>
        <div className={styles.calendarRow}>
          <ActivityCalendar blocks={blocks} now={now} />
          <ThisWeekChart blocks={blocks} now={now} />
        </div>
      </section>
    </div>
  );
}
