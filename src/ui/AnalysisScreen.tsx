import { useMemo, useState } from 'react';
import type { BoxGroupBy } from '../domain/boxStats';
import {
  DEFAULT_PERIOD,
  PERIOD_PRESETS,
  presetRange,
  type PeriodPreset,
} from '../domain/period';
import type { TimeBlock } from '../domain/timeBlock';
import { BoxPlotChart } from './BoxPlotChart';
import { WeekdayBarChart } from './WeekdayBarChart';
import styles from './AnalysisScreen.module.css';

const BOX_GROUPS: ReadonlyArray<{ value: BoxGroupBy; label: string }> = [
  { value: 'weekday', label: '曜日別' },
  { value: 'all', label: '全体' },
];

/**
 * 分析画面（たまに見る・detailed-design 6.3）。
 * 上部に期間プリセット（直近4週/12週/全期間）。選んだレンジで各チャートを再集計。
 * MVP は曜日別棒グラフ。箱ひげ図は後続 PR で追加する。
 */
export interface AnalysisScreenProps {
  blocks: TimeBlock[];
  /** 集計基準の現在時刻（既定 = 現在）。 */
  now?: Date;
}

export function AnalysisScreen({ blocks, now = new Date() }: AnalysisScreenProps) {
  const [preset, setPreset] = useState<PeriodPreset>(DEFAULT_PERIOD);
  const [boxGroupBy, setBoxGroupBy] = useState<BoxGroupBy>('weekday');

  // now は描画ごとに新規生成されるが、その日内では同じレンジに落ちる。
  const nowKey = now.getTime();
  const range = useMemo(
    () => presetRange(preset, new Date(nowKey), blocks),
    [preset, nowKey, blocks],
  );

  return (
    <div className={styles.screen}>
      <div className={styles.periods}>
        {PERIOD_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            className={`${styles.period} ${preset === p.value ? styles.active : ''}`}
            onClick={() => setPreset(p.value)}
            aria-pressed={preset === p.value}
          >
            {p.label}
          </button>
        ))}
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>曜日別の活動時間</h2>
        <p className={styles.sectionNote}>1日あたりの平均アクティブ時間</p>
        <WeekdayBarChart blocks={blocks} range={range} />
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div>
            <h2 className={styles.sectionTitle}>開始・終了の時間帯</h2>
            <p className={styles.sectionNote}>その日の最初の開始と最後の終了の分布</p>
          </div>
          <div className={styles.periods}>
            {BOX_GROUPS.map((g) => (
              <button
                key={g.value}
                type="button"
                className={`${styles.period} ${boxGroupBy === g.value ? styles.active : ''}`}
                onClick={() => setBoxGroupBy(g.value)}
                aria-pressed={boxGroupBy === g.value}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <BoxPlotChart blocks={blocks} range={range} groupBy={boxGroupBy} />
      </section>
    </div>
  );
}
