import { describe, expect, it } from 'vitest';
import { isValidBlock, mergeBlocks, type TimeBlock } from './timeBlock';

/** "HH:MM" を 2026-06-21 のその時刻の Date に変換するテスト用ヘルパー。 */
function at(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2026, 5, 21, h, m, 0, 0);
}

function block(id: string, start: string, end: string): TimeBlock {
  return { id, start: at(start), end: at(end) };
}

function asText(blocks: TimeBlock[]): string[] {
  const pad = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return blocks.map((b) => `${pad(b.start)}-${pad(b.end)}`);
}

describe('isValidBlock', () => {
  it('end > start なら有効', () => {
    expect(isValidBlock(block('a', '09:00', '10:00'))).toBe(true);
  });
  it('ゼロ幅・逆転は無効', () => {
    expect(isValidBlock(block('a', '09:00', '09:00'))).toBe(false);
    expect(isValidBlock(block('a', '10:00', '09:00'))).toBe(false);
  });
});

describe('mergeBlocks', () => {
  it('重なる区間を1つに統合する（requirements.md 6.2 の例）', () => {
    const result = mergeBlocks([
      block('a', '09:00', '11:00'),
      block('b', '10:30', '12:00'),
    ]);
    expect(asText(result)).toEqual(['09:00-12:00']);
  });

  it('隣接する区間も統合する', () => {
    const result = mergeBlocks([
      block('a', '10:00', '11:00'),
      block('b', '11:00', '12:00'),
    ]);
    expect(asText(result)).toEqual(['10:00-12:00']);
  });

  it('離れた区間は別々のまま昇順で返す', () => {
    const result = mergeBlocks([
      block('b', '13:00', '14:00'),
      block('a', '09:00', '10:00'),
    ]);
    expect(asText(result)).toEqual(['09:00-10:00', '13:00-14:00']);
  });

  it('完全に内包される区間は外側に吸収される', () => {
    const result = mergeBlocks([
      block('a', '09:00', '12:00'),
      block('b', '10:00', '11:00'),
    ]);
    expect(asText(result)).toEqual(['09:00-12:00']);
  });

  it('無効な区間（ゼロ幅・逆転）は無視する', () => {
    const result = mergeBlocks([
      block('a', '09:00', '10:00'),
      block('bad', '11:00', '11:00'),
    ]);
    expect(asText(result)).toEqual(['09:00-10:00']);
  });
});
