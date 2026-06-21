import { describe, expect, it } from 'vitest';
import { useViewStore } from './viewStore';

describe('viewStore', () => {
  it('既定は record 画面', () => {
    expect(useViewStore.getState().view).toBe('record');
  });

  it('go で画面を切り替える', () => {
    useViewStore.getState().go('analysis');
    expect(useViewStore.getState().view).toBe('analysis');
    useViewStore.getState().go('edit');
    expect(useViewStore.getState().view).toBe('edit');
    // 後続テストへの影響を避けて既定へ戻す。
    useViewStore.getState().go('record');
  });
});
