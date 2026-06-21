import { useState } from 'react';
import { isValidBlock, type TimeBlock } from '../domain/timeBlock';
import { useBlockStore } from '../store/blockStore';
import { fromLocalInput, toLocalInput } from './datetimeInput';
import styles from './EditScreen.module.css';

/**
 * 編集画面（detailed-design 6.4）。記録画面とは別画面。
 * 区間の追加・時刻変更・削除を行う。検証(end>start)は isValidBlock に委譲し、
 * 保存は BlockStore（重なりは自動マージ）。
 */
const MAX_ROWS = 30;

export function EditScreen() {
  const blocks = useBlockStore((s) => s.blocks);
  const addBlock = useBlockStore((s) => s.addBlock);
  const updateBlock = useBlockStore((s) => s.updateBlock);
  const deleteBlock = useBlockStore((s) => s.deleteBlock);

  const recent = [...blocks]
    .sort((a, b) => b.start.getTime() - a.start.getTime())
    .slice(0, MAX_ROWS);

  return (
    <div className={styles.screen}>
      <AddForm onAdd={addBlock} />

      <section className={styles.section}>
        <h2 className={styles.title}>最近の記録</h2>
        {recent.length === 0 ? (
          <p className={styles.empty}>まだ記録がありません。</p>
        ) : (
          <ul className={styles.list}>
            {recent.map((b) => (
              <BlockRow
                key={b.id}
                block={b}
                onSave={updateBlock}
                onDelete={deleteBlock}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
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
    <section className={styles.section}>
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
      <div className={styles.row}>
        <label className={styles.field}>
          <span>開始</span>
          <input
            type="datetime-local"
            value={start}
            onChange={(ev) => setStart(ev.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>終了</span>
          <input
            type="datetime-local"
            value={end}
            onChange={(ev) => setEnd(ev.target.value)}
          />
        </label>
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
        >
          削除
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </li>
  );
}
