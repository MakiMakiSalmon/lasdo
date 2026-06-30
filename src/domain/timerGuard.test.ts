import { describe, expect, it } from 'vitest';
import {
  CONFIRM_AFTER_MS,
  formatLongDuration,
  longRunConfirmMessage,
  needsLongRunConfirm,
  shouldWarnLongRun,
  WARN_AFTER_MS,
} from './timerGuard';

const H = 3_600_000;

describe('timerGuard', () => {
  describe('shouldWarnLongRun', () => {
    it('閾値未満では警告しない', () => {
      expect(shouldWarnLongRun(WARN_AFTER_MS - 1)).toBe(false);
      expect(shouldWarnLongRun(0)).toBe(false);
    });
    it('閾値ちょうど以上で警告する', () => {
      expect(shouldWarnLongRun(WARN_AFTER_MS)).toBe(true);
      expect(shouldWarnLongRun(10 * H)).toBe(true);
    });
  });

  describe('needsLongRunConfirm', () => {
    it('閾値未満は確認不要', () => {
      expect(needsLongRunConfirm(CONFIRM_AFTER_MS - 1)).toBe(false);
      expect(needsLongRunConfirm(6 * H)).toBe(false);
    });
    it('閾値ちょうど以上は確認が要る', () => {
      expect(needsLongRunConfirm(CONFIRM_AFTER_MS)).toBe(true);
      expect(needsLongRunConfirm(120 * H)).toBe(true);
    });
  });

  describe('formatLongDuration', () => {
    it('1時間未満は分のみ', () => {
      expect(formatLongDuration(45 * 60_000)).toBe('45分');
    });
    it('時間と分', () => {
      expect(formatLongDuration(2 * H + 5 * 60_000)).toBe('2時間5分');
    });
    it('ちょうどの時間は分を省く', () => {
      expect(formatLongDuration(6 * H)).toBe('6時間');
    });
    it('1日以上は日と時間（分は省く）', () => {
      expect(formatLongDuration(30 * H + 12 * 60_000)).toBe('1日6時間');
    });
    it('ちょうどの日は時間も省く', () => {
      expect(formatLongDuration(48 * H)).toBe('2日');
    });
    it('負値は0分に丸める', () => {
      expect(formatLongDuration(-100)).toBe('0分');
    });
  });

  it('確認メッセージは整形した長さを含む', () => {
    expect(longRunConfirmMessage(30 * H)).toContain('1日6時間');
  });
});
