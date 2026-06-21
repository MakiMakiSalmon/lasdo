import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewTimeBlock } from '../domain/timeBlock';
import { createTimerStore, TIMER_STORAGE_KEY } from './timerStore';

/** Map ベースの localStorage フェイク（node 環境でも依存なく検証する）。 */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  };
}

describe('timerStore', () => {
  let storage: ReturnType<typeof fakeStorage>;
  let added: NewTimeBlock[];
  const addBlock = vi.fn(async (b: NewTimeBlock) => void added.push(b));

  beforeEach(() => {
    storage = fakeStorage();
    added = [];
    addBlock.mockClear();
  });

  it('start で runningSince を立て、localStorage に退避する', () => {
    const t0 = new Date(2026, 5, 21, 9, 0, 0);
    const store = createTimerStore({ addBlock, storage, now: () => t0 });
    store.getState().start();
    expect(store.getState().runningSince).toEqual(t0);
    expect(storage.getItem(TIMER_STORAGE_KEY)).toBe(String(t0.getTime()));
  });

  it('start は二重開始しない（稼働中は無視）', () => {
    let n = 9;
    const store = createTimerStore({
      addBlock,
      storage,
      now: () => new Date(2026, 5, 21, n++, 0, 0),
    });
    store.getState().start();
    const first = store.getState().runningSince;
    store.getState().start();
    expect(store.getState().runningSince).toBe(first);
  });

  it('stop で区間を確定して addBlock し、退避を消す', async () => {
    const t0 = new Date(2026, 5, 21, 9, 0, 0);
    const t1 = new Date(2026, 5, 21, 9, 25, 0);
    let cur = t0;
    const store = createTimerStore({ addBlock, storage, now: () => cur });
    store.getState().start();
    cur = t1;
    await store.getState().stop();
    expect(store.getState().runningSince).toBeNull();
    expect(storage.getItem(TIMER_STORAGE_KEY)).toBeNull();
    expect(added).toEqual([{ start: t0, end: t1 }]);
  });

  it('稼働ゼロ幅（同時刻 stop）は区間を作らない', async () => {
    const t0 = new Date(2026, 5, 21, 9, 0, 0);
    const store = createTimerStore({ addBlock, storage, now: () => t0 });
    store.getState().start();
    await store.getState().stop();
    expect(addBlock).not.toHaveBeenCalled();
    expect(store.getState().runningSince).toBeNull();
  });

  it('停止中の stop は何もしない', async () => {
    const store = createTimerStore({ addBlock, storage });
    await store.getState().stop();
    expect(addBlock).not.toHaveBeenCalled();
  });

  it('退避済みの開始時刻を起動時に復元する（リロード耐性）', () => {
    const since = new Date(2026, 5, 21, 8, 30, 0);
    storage.setItem(TIMER_STORAGE_KEY, String(since.getTime()));
    const store = createTimerStore({ addBlock, storage });
    expect(store.getState().runningSince).toEqual(since);
  });
});
