import { useMemo, useState } from 'react';
import {
  DEFAULT_PERIOD,
  PERIOD_PRESETS,
  presetRange,
  type PeriodPreset,
} from '../domain/period';
import type { TimeBlock } from '../domain/timeBlock';
import { WeekdayBarChart } from './WeekdayBarChart';
import styles from './AnalysisScreen.module.css';

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
    </div>
  );
}
