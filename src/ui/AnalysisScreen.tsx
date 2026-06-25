import type { TimeBlock } from '../domain/timeBlock';
import { ActivityCalendar } from './ActivityCalendar';
import { ThisWeekChart } from './ThisWeekChart';
import { TimeOfDayHeatmap } from './TimeOfDayHeatmap';
import styles from './AnalysisScreen.module.css';

/**
 * 分析画面（たまに見る・detailed-design 6.3）。
 *
 * 上段＝活動カレンダー（草＋欄外の曜日平均）＋今週の作業時間。
 * 下段＝時間帯ヒートマップ（曜日×時間帯のアクティブ量＝リズムの型）。
 * 期間プリセットは廃止し、集計は固定窓（直近12週）。
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

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>時間帯ヒートマップ</h2>
        <p className={styles.sectionNote}>
          いつ動く人か（曜日×時間帯）。色＝平均アクティブ分/日（直近12週・5:00起点）。
        </p>
        <TimeOfDayHeatmap blocks={blocks} now={now} />
      </section>
    </div>
  );
}
