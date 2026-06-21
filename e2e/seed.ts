import { mergeBlocks, type TimeBlock } from '../src/domain/timeBlock';

/**
 * 経過時間スクショ用の「合成アクティブ区間」生成（このブランチ専用・main 非マージ）。
 *
 * - 乱数はシード固定 → 同じ now / days なら毎回同一データ（スクショ比較が成立）。
 * - 現実的な活動リズム（毎日数区間・休憩の隙間・たまに深夜またぎ・たまに丸ごと記録なし）
 *   にして、曜日別棒グラフ／箱ひげ図が意味を成すようにする。
 * - 重なり/隣接は mergeBlocks で正規化（アプリと同じドメイン規則を再利用）。
 * - 投入は spec 側で実 Repository(replaceAll) 経由。ここは純粋なデータ生成のみ。
 */

/** データ量プリセット名 → さかのぼる日数。 */
export const VOLUME_PRESETS = {
  empty: 0,
  '1week': 7,
  '1month': 30,
  '3months': 90,
  '1year': 365,
  '3years': 1095,
} as const;

export type VolumePreset = keyof typeof VOLUME_PRESETS;

/** epoch ms 表現（page.evaluate へ渡す際の直列化用。Date は JSON 不可）。 */
export interface SerializedBlock {
  id: string;
  start: number;
  end: number;
}

/** 決定的 PRNG（mulberry32）。 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 固定シード。値に意味はない（"lasdo" 風の語呂）。 */
const SEED = 0x1a5d0;

const MS_PER_MIN = 60_000;

/** その日のローカル 0:00 から startMin/endMin 分の区間を作る（>1440 は翌日へ繰り上がる）。 */
function makeBlock(day: Date, startMin: number, endMin: number, id: string): TimeBlock {
  const base = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    0,
    0,
    0,
    0,
  ).getTime();
  return {
    id,
    start: new Date(base + startMin * MS_PER_MIN),
    end: new Date(base + endMin * MS_PER_MIN),
  };
}

/**
 * now から過去 days 日ぶんの合成アクティブ区間を生成する（決定的）。
 * now より後ろに伸びる区間は now で切り、極短になったものは捨てる。
 */
export function generateSeedBlocks(now: Date, days: number): TimeBlock[] {
  if (days <= 0) return [];

  const rand = mulberry32(SEED);
  const raw: TimeBlock[] = [];
  let uid = 0;
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let d = days; d >= 0; d -= 1) {
    const day = new Date(nowDay);
    day.setDate(day.getDate() - d);

    // たまに丸ごと記録なしの日（疎なデータの描画確認）。
    if (rand() < 0.08) continue;

    // 起床(最初の開始) 7:00〜9:30 / 就寝(最後の終了) 21:30〜24:30。
    let cursorMin = 7 * 60 + Math.floor(rand() * 150);
    const endOfDayMin = 21 * 60 + 30 + Math.floor(rand() * 180);
    const blockCount = 4 + Math.floor(rand() * 5); // 4〜8 区間

    for (let i = 0; i < blockCount && cursorMin < endOfDayMin; i += 1) {
      const gap = 15 + Math.floor(rand() * 90); // 休憩 15〜105 分（=記録の不在）
      const len = 45 + Math.floor(rand() * 150); // 区間長 45〜195 分
      const startMin = cursorMin + gap;
      const endMin = Math.min(startMin + len, endOfDayMin);
      if (endMin - startMin < 10) break;
      raw.push(makeBlock(day, startMin, endMin, `b${uid++}`));
      cursorMin = endMin;
    }

    // 約10日に1回、深夜またぎ区間（日付境界 split / タイムライン 5:00 起点の確認）。
    if (rand() < 0.1) {
      const startMin = 23 * 60 + Math.floor(rand() * 60); // 23:00〜24:00
      const endMin = startMin + 60 + Math.floor(rand() * 120); // +1〜3h（翌日へ）
      raw.push(makeBlock(day, startMin, endMin, `n${uid++}`));
    }
  }

  // 未来側は now で打ち切り、極短になった区間は捨ててから正規化。
  const cutoff = now.getTime();
  const clipped = raw
    .filter((b) => b.start.getTime() < cutoff)
    .map((b) =>
      b.end.getTime() > cutoff ? { ...b, end: new Date(cutoff) } : b,
    )
    .filter((b) => b.end.getTime() - b.start.getTime() >= 10 * MS_PER_MIN);

  return mergeBlocks(clipped);
}

// --- 極端ケース（活動リズムが歪な日）の専用ジェネレータ -------------------

/** now の lasdo 日に対応する暦日（深夜<5:00 は前日）を返す。 */
function lasdoCalendarDay(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() < 5) d.setDate(d.getDate() - 1);
  return d;
}

/**
 * 徹夜。昼の通常活動 + 21:00 から now まで続く連続区間。
 * 5:00起点タイムライン(5:00〜29:00)の深夜帯へバーが伸びる様子を見る。
 * 「夜だから睡眠」と自動分類しない設計（CLAUDE.md）の見え方確認。
 */
export function generateAllNighter(now: Date): TimeBlock[] {
  const d = lasdoCalendarDay(now);
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const blocks: TimeBlock[] = [
    makeBlock(d, 9 * 60, 11 * 60 + 30, 'an-am'),
    makeBlock(d, 13 * 60, 15 * 60, 'an-pm1'),
    makeBlock(d, 16 * 60, 18 * 60 + 30, 'an-pm2'),
    // 21:00 → now（深夜まで連続）。
    { id: 'an-night', start: new Date(base + 21 * 60 * MS_PER_MIN), end: new Date(now) },
  ];
  return mergeBlocks(blocks.filter((b) => b.end.getTime() > b.start.getTime()));
}

/**
 * ほぼ終日アクティブ。6:00 から now まで ~110分活動/8分休憩でほぼ連続。
 * がんばりゲージの上限付近・タイムラインがびっしり埋まる見え方を見る。
 */
export function generateMarathon(now: Date): TimeBlock[] {
  const d = lasdoCalendarDay(now);
  const base = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const endMin = (now.getTime() - base) / MS_PER_MIN;
  const blocks: TimeBlock[] = [];
  let t = 6 * 60;
  let i = 0;
  while (t < endMin) {
    const segEnd = Math.min(t + 110, endMin);
    if (segEnd - t >= 10) {
      blocks.push({
        id: `mar${i++}`,
        start: new Date(base + t * MS_PER_MIN),
        end: new Date(base + segEnd * MS_PER_MIN),
      });
    }
    t = segEnd + 8;
  }
  return mergeBlocks(blocks);
}

/**
 * 疎データ。約7割の日は記録なし、記録日も1〜2区間だけ。
 * 欠け曜日（データなし）・少サンプルの箱ひげ・凸凹な棒の見え方を見る。
 */
export function generateSparse(now: Date, days: number): TimeBlock[] {
  const rand = mulberry32(SEED ^ 0x5a);
  const raw: TimeBlock[] = [];
  let uid = 0;
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let dd = days; dd >= 0; dd -= 1) {
    const day = new Date(nowDay);
    day.setDate(day.getDate() - dd);
    if (rand() < 0.7) continue; // 7割は記録なし
    const count = 1 + Math.floor(rand() * 2); // 1〜2 区間
    let cursor = 9 * 60 + Math.floor(rand() * 240); // 9:00〜13:00 開始
    for (let i = 0; i < count; i += 1) {
      const len = 40 + Math.floor(rand() * 120);
      raw.push(makeBlock(day, cursor, cursor + len, `sp${uid++}`));
      cursor += len + 60 + Math.floor(rand() * 180);
    }
  }

  const cutoff = now.getTime();
  return mergeBlocks(
    raw
      .filter((b) => b.start.getTime() < cutoff)
      .map((b) => (b.end.getTime() > cutoff ? { ...b, end: new Date(cutoff) } : b))
      .filter((b) => b.end.getTime() - b.start.getTime() >= 10 * MS_PER_MIN),
  );
}

/** データソースのキー。通常のデータ量プリセット + 極端ケース。 */
export type DatasetKey = VolumePreset | 'allnighter' | 'sparse' | 'marathon';

/** キーと now から実際の区間集合を構築する（spec が唯一呼ぶ入口）。 */
export function buildDataset(key: DatasetKey, now: Date): TimeBlock[] {
  switch (key) {
    case 'allnighter':
      return generateAllNighter(now);
    case 'marathon':
      return generateMarathon(now);
    case 'sparse':
      return generateSparse(now, 84); // 12週ぶんを疎に
    default:
      return generateSeedBlocks(now, VOLUME_PRESETS[key]);
  }
}

/** page.evaluate へ渡すための直列化（Date → epoch ms）。 */
export function serialize(blocks: TimeBlock[]): SerializedBlock[] {
  return blocks.map((b) => ({
    id: b.id,
    start: b.start.getTime(),
    end: b.end.getTime(),
  }));
}
