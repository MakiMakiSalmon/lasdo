import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { dayWindow, lasdoDayKey, type DayKey } from '../domain/dayBoundary';
import { isValidBlock, type TimeBlock } from '../domain/timeBlock';
import { useBlockStore } from '../store/blockStore';
import { fromLocalInput, toLocalInput } from './datetimeInput';
import styles from './EditScreen.module.css';

/**
 * 編集画面（detailed-design 6.4）。記録画面とは別画面。
 * 区間の追加・時刻変更・削除を行う。検証(end>start)は isValidBlock に委譲し、
 * 保存は BlockStore（重なりは自動マージ）。
 *
 * 一覧は lasdo 日(5:00起点)ごとに束ねて見出しを付ける。見出しの合計は
 * 各区間を開始日に丸ごと割り当てた概算（編集の見当付け用。厳密な集計は分析画面）。
 */
const MAX_ROWS = 30;

/** 分 → "X時間Y分"（0時間は省略、0分も省略）。ThisWeekChart の toHm と同調。 */
function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}分`;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

interface DayGroup {
  key: DayKey;
  /** 見出し用の日付。lasdo 日の起点(5:00)。生のブロック start を使うと、深夜
   *  またぎ(例 24日25:30=暦25日01:30)で見出しが翌日にズレて重複するため使わない。 */
  date: Date;
  totalMs: number;
  blocks: TimeBlock[];
}

/** 区間を開始日(lasdo 日)ごとに束ね、新しい日が上に来るよう降順で返す。 */
function groupByDay(blocks: TimeBlock[]): DayGroup[] {
  const map = new Map<DayKey, DayGroup>();
  for (const b of blocks) {
    const key = lasdoDayKey(b.start);
    let group = map.get(key);
    if (!group) {
      group = { key, date: dayWindow(key).start, totalMs: 0, blocks: [] };
      map.set(key, group);
    }
    group.totalMs += b.end.getTime() - b.start.getTime();
    group.blocks.push(b);
  }
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}

export function EditScreen() {
  const blocks = useBlockStore((s) => s.blocks);
  const addBlock = useBlockStore((s) => s.addBlock);
  const updateBlock = useBlockStore((s) => s.updateBlock);
  const deleteBlock = useBlockStore((s) => s.deleteBlock);

  const groups = useMemo(() => {
    const recent = [...blocks]
      .sort((a, b) => b.start.getTime() - a.start.getTime())
      .slice(0, MAX_ROWS);
    return groupByDay(recent);
  }, [blocks]);

  return (
    <div className={styles.screen}>
      <AddForm onAdd={addBlock} />

      <section className={styles.section}>
        <h2 className={styles.title}>最近の記録</h2>
        {groups.length === 0 ? (
          <p className={styles.empty}>まだ記録がありません。</p>
        ) : (
          <div className={styles.groups}>
            {groups.map((group) => (
              <DayGroupView
                key={group.key}
                group={group}
                onSave={updateBlock}
                onDelete={deleteBlock}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** 曜日色: 日曜=赤, 土曜=青, 平日=見出し色。日本のカレンダー慣習に合わせる。 */
function weekdayClass(d: Date): string {
  const day = d.getDay();
  if (day === 0) return styles.sun;
  if (day === 6) return styles.sat;
  return '';
}

function DayGroupView({
  group,
  onSave,
  onDelete,
}: {
  group: DayGroup;
  onSave: (b: TimeBlock) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <section className={styles.group}>
      <header className={styles.dayHeader}>
        <span className={`${styles.dayDate} ${weekdayClass(group.date)}`}>
          {format(group.date, 'M月d日(E)', { locale: ja })}
        </span>
        <span className={styles.dayTotal}>{formatDuration(group.totalMs)}</span>
      </header>
      <div className={styles.colHead} aria-hidden="true">
        <span>開始</span>
        <span />
        <span>終了</span>
        <span />
        <span className={styles.colHeadRight}>長さ</span>
        <span />
      </div>
      <ul className={styles.list}>
        {group.blocks.map((b) => (
          <BlockRow
            key={b.id}
            block={b}
            onSave={onSave}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </section>
  );
}

function AddForm({
  onAdd,
}: {
  onAdd: (b: { start: Date; end: Date }) => Promise<void>;
}) {
  const now = new Date();
  const ago = new Date(now.getTime() - 25 * 60_000);
  const [start, setStart] = useState(() => toLocalInput(ago));
  const [end, setEnd] = useState(() => toLocalInput(now));
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const s = fromLocalInput(start);
    const e = fromLocalInput(end);
    if (!s || !e) return setError('日時が正しくありません。');
    if (!isValidBlock({ start: s, end: e })) {
      return setError('終了は開始より後にしてください。');
    }
    setError(null);
    await onAdd({ start: s, end: e });
  };

  return (
    <section className={`${styles.section} ${styles.addPanel}`}>
      <h2 className={styles.title}>記録を追加</h2>
      <div className={styles.row}>
        <label className={styles.field}>
          <span>開始</span>
          <input
            type="datetime-local"
            value={start}
            onChange={(ev) => setStart(ev.target.value)}
          />
        </label>
        <span className={styles.tilde} aria-hidden="true">
          〜
        </span>
        <label className={styles.field}>
          <span>終了</span>
          <input
            type="datetime-local"
            value={end}
            onChange={(ev) => setEnd(ev.target.value)}
          />
        </label>
        <button type="button" className={styles.primary} onClick={submit}>
          追加
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}

function BlockRow({
  block,
  onSave,
  onDelete,
}: {
  block: TimeBlock;
  onSave: (b: TimeBlock) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [start, setStart] = useState(() => toLocalInput(block.start));
  const [end, setEnd] = useState(() => toLocalInput(block.end));
  const [error, setError] = useState<string | null>(null);

  const dirty =
    start !== toLocalInput(block.start) || end !== toLocalInput(block.end);

  // 編集中の入力からその場で長さを出す（不正なら null）。
  const durationMs = useMemo(() => {
    const s = fromLocalInput(start);
    const e = fromLocalInput(end);
    if (!s || !e || !isValidBlock({ start: s, end: e })) return null;
    return e.getTime() - s.getTime();
  }, [start, end]);

  const save = async () => {
    const s = fromLocalInput(start);
    const e = fromLocalInput(end);
    if (!s || !e) return setError('日時が正しくありません。');
    if (!isValidBlock({ start: s, end: e })) {
      return setError('終了は開始より後にしてください。');
    }
    setError(null);
    await onSave({ id: block.id, start: s, end: e });
  };

  return (
    <li className={styles.item}>
      <div className={styles.blockRow}>
        <input
          type="datetime-local"
          aria-label="開始"
          value={start}
          onChange={(ev) => setStart(ev.target.value)}
        />
        <span className={styles.tilde} aria-hidden="true">
          〜
        </span>
        <input
          type="datetime-local"
          aria-label="終了"
          value={end}
          onChange={(ev) => setEnd(ev.target.value)}
        />
        <span className={styles.duration}>
          {durationMs === null ? '—' : formatDuration(durationMs)}
        </span>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={save}
            disabled={!dirty}
          >
            保存
          </button>
          <button
            type="button"
            className={styles.danger}
            onClick={() => onDelete(block.id)}
            aria-label="削除"
          >
            削除
          </button>
        </div>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </li>
  );
}
