import { describe, expect, it } from 'vitest';
import { fromLocalInput, toLocalInput } from './datetimeInput';

describe('datetimeInput', () => {
  it('toLocalInput はローカル各成分を YYYY-MM-DDTHH:mm に整形', () => {
    expect(toLocalInput(new Date(2026, 5, 21, 9, 5))).toBe('2026-06-21T09:05');
    expect(toLocalInput(new Date(2026, 11, 1, 0, 0))).toBe('2026-12-01T00:00');
  });

  it('fromLocalInput は文字列をローカル Date へ', () => {
    expect(fromLocalInput('2026-06-21T09:05')).toEqual(new Date(2026, 5, 21, 9, 5));
  });

  it('往復で一致する', () => {
    const d = new Date(2026, 2, 9, 23, 45);
    expect(fromLocalInput(toLocalInput(d))).toEqual(d);
  });

  it('不正な文字列は null', () => {
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('2026-06-21')).toBeNull();
    expect(fromLocalInput('not-a-date')).toBeNull();
  });
});
