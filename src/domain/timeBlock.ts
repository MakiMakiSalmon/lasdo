/**
 * lasdo のコアデータ: アクティブだった時間区間。
 * 種別カラムは持たない（非アクティブは「記録の不在」として算出する）。
 * 詳細は requirements.md 4.2 / 6.1。
 */
export interface TimeBlock {
  id: string;
  /** 開始日時（end より前であること） */
  start: Date;
  /** 終了日時（start より後であること） */
  end: Date;
}

/** id を持たない、新規追加用の入力。 */
export type NewTimeBlock = Omit<TimeBlock, 'id'>;

/** end > start（ゼロ幅・逆転は不可。requirements.md 6.2）。 */
export function isValidBlock(block: Pick<TimeBlock, 'start' | 'end'>): boolean {
  return block.end.getTime() > block.start.getTime();
}

/**
 * 区間の集合を、重なり・隣接をマージした「重なりのない昇順リスト」に正規化する。
 *
 * - 重なり（オーバーラップ）は禁止 → 1つの連続区間に統合（requirements.md 6.2）。
 *   例: 9:00–11:00 と 10:30–12:00 → 9:00–12:00。
 * - 隣接（10:00–11:00 と 11:00–12:00）も統合する。
 * - これにより「アクティブ合計 = 各区間長の総和」が二重計上なく成立する。
 *
 * 注: マージ結果の id は先頭区間のものを引き継ぐ（呼び出し側で永続化方針に合わせて扱う）。
 * ゼロ幅・逆転区間（!isValidBlock）は無視する。
 */
export function mergeBlocks(blocks: TimeBlock[]): TimeBlock[] {
  const sorted = blocks
    .filter(isValidBlock)
    .slice()
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: TimeBlock[] = [];
  for (const block of sorted) {
    const last = merged[merged.length - 1];
    // 隣接も含めてマージするため `>=` で判定する。
    if (last && block.start.getTime() <= last.end.getTime()) {
      if (block.end.getTime() > last.end.getTime()) {
        last.end = block.end;
      }
    } else {
      merged.push({ id: block.id, start: block.start, end: block.end });
    }
  }
  return merged;
}
