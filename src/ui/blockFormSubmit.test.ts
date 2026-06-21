import { describe, expect, it, vi } from 'vitest';
import {
  INVALID_DATETIME_ERROR,
  INVALID_RANGE_ERROR,
  submitBlockForm,
  validateBlockForm,
} from './blockFormSubmit';

describe('blockFormSubmit', () => {
  it('終了が開始以前ならエラーを返し、保存しない', async () => {
    const onValid = vi.fn();

    const error = await submitBlockForm(
      { start: '2026-06-21T12:00', end: '2026-06-21T11:00' },
      onValid,
    );

    expect(error).toBe(INVALID_RANGE_ERROR);
    expect(onValid).not.toHaveBeenCalled();
  });

  it('ゼロ幅もエラーを返し、保存しない', async () => {
    const onValid = vi.fn();

    const error = await submitBlockForm(
      { start: '2026-06-21T12:00', end: '2026-06-21T12:00' },
      onValid,
    );

    expect(error).toBe(INVALID_RANGE_ERROR);
    expect(onValid).not.toHaveBeenCalled();
  });

  it('日時として読めない値は日時エラーを返す', () => {
    expect(validateBlockForm({ start: '', end: '2026-06-21T12:00' })).toEqual({
      ok: false,
      error: INVALID_DATETIME_ERROR,
    });
  });

  it('正しい範囲ならDateへ変換して保存する', async () => {
    const onValid = vi.fn(async () => undefined);

    const error = await submitBlockForm(
      { start: '2026-06-21T11:35', end: '2026-06-21T12:00' },
      onValid,
    );

    expect(error).toBeNull();
    expect(onValid).toHaveBeenCalledWith({
      start: new Date(2026, 5, 21, 11, 35),
      end: new Date(2026, 5, 21, 12, 0),
    });
  });
});
