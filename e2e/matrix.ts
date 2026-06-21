import type { DatasetKey, VolumePreset } from './seed';

/**
 * 撮影マトリクス（このブランチ専用・main 非マージ）。
 *
 * 「時間が経過したときの動作・デザイン」を3軸で固定して撮る:
 *   A) データ量軸 … now を固定し、蓄積量(1週〜3年)を振る。分析画面は 4週/全期間 両方。
 *   B) 現在時刻軸 … データ量を固定(3ヶ月)し、now の瞬間を振る（5:00境界/週明け等）。
 *   C) 極端ケース … 活動リズムが歪な日（徹夜/疎データ/ほぼ終日）の見え方。
 *
 * spec とコンタクトシート生成はこの SCENARIOS を唯一の真実として共有する。
 */

export interface NowMoment {
  id: string;
  label: string;
  /** ローカル時刻で指定（マシンの TZ をそのまま使う＝アプリの日境界計算と一致）。 */
  at: Date;
}

// 2026-06 を基準に代表的な瞬間を固定（曜日も意味づけ）。
export const NOW_MOMENTS = {
  // 2026-06-17 は水曜。活動が一日ぶん溜まった平日夜。
  weekdayEvening: {
    id: 'weekday-evening',
    label: '平日夜・水 21:30',
    at: new Date(2026, 5, 17, 21, 30),
  },
  // 2026-06-18 03:00（木の未明）= lasdo 日では 06-17。5:00 境界の手前。
  pastMidnight: {
    id: 'past-midnight',
    label: '深夜・木 03:00（5:00境界の手前）',
    at: new Date(2026, 5, 18, 3, 0),
  },
  // 2026-06-15 は月曜の朝。週明け直後。
  mondayMorning: {
    id: 'monday-morning',
    label: '週明け・月 06:00',
    at: new Date(2026, 5, 15, 6, 0),
  },
  // 2026-06-18 01:00（木の未明）= lasdo 日では 06-17。終日活動の上限を見る用。
  lateNight: {
    id: 'late-night',
    label: '深夜・木 01:00',
    at: new Date(2026, 5, 18, 1, 0),
  },
} satisfies Record<string, NowMoment>;

export type AnalysisPeriod = 'recent4w' | 'recent12w' | 'all';

/** 分析画面の期間プリセットボタンのラベル（UI と一致させる）。 */
export const PERIOD_LABEL: Record<AnalysisPeriod, string> = {
  recent4w: '直近4週',
  recent12w: '直近12週',
  all: '全期間',
};

export type ScreenSpec =
  | { kind: 'record' }
  | { kind: 'analysis'; period: AnalysisPeriod };

export interface Scenario {
  /** コンタクトシートのグルーピング見出し。 */
  group: string;
  /** ファイル名兼テスト名（衝突しない一意キー）。 */
  name: string;
  /** コンタクトシート用の人間可読ラベル。 */
  caption: string;
  dataset: DatasetKey;
  now: NowMoment;
  screen: ScreenSpec;
}

const DATASET_LABEL: Record<DatasetKey, string> = {
  empty: '記録なし',
  '1week': '1週間',
  '1month': '1ヶ月',
  '3months': '3ヶ月',
  '1year': '1年',
  '3years': '3年',
  allnighter: '徹夜（深夜まで連続）',
  sparse: '疎データ（記録が飛び飛び）',
  marathon: 'ほぼ終日アクティブ',
};

function screenLabel(s: ScreenSpec): string {
  if (s.kind === 'record') return '記録画面';
  return `分析画面（${PERIOD_LABEL[s.period]}）`;
}

function scenario(
  group: string,
  dataset: DatasetKey,
  now: NowMoment,
  screen: ScreenSpec,
): Scenario {
  const screenId =
    screen.kind === 'record' ? 'record' : `analysis-${screen.period}`;
  return {
    group,
    name: `${dataset}__${now.id}__${screenId}`,
    caption: `${DATASET_LABEL[dataset]} / ${now.label} / ${screenLabel(screen)}`,
    dataset,
    now,
    screen,
  };
}

const GROUP_A = 'A. 経過時間（データ量）— now 固定: 平日夜・水 21:30';
const GROUP_B = 'B. 現在時刻の進行 — データ固定: 3ヶ月';
const GROUP_C = 'C. 極端ケース — 活動リズムが歪な日の見え方';

const VOLUME_ORDER: VolumePreset[] = [
  'empty',
  '1week',
  '1month',
  '3months',
  '1year',
  '3years',
];

const A_SCREENS: ScreenSpec[] = [
  { kind: 'record' },
  { kind: 'analysis', period: 'recent4w' },
  { kind: 'analysis', period: 'all' },
];

const B_SCREENS: ScreenSpec[] = [
  { kind: 'record' },
  { kind: 'analysis', period: 'recent4w' },
];

const groupA = VOLUME_ORDER.flatMap((preset) =>
  A_SCREENS.map((screen) =>
    scenario(GROUP_A, preset, NOW_MOMENTS.weekdayEvening, screen),
  ),
);

const groupB = [
  NOW_MOMENTS.weekdayEvening,
  NOW_MOMENTS.pastMidnight,
  NOW_MOMENTS.mondayMorning,
].flatMap((now) =>
  B_SCREENS.map((screen) => scenario(GROUP_B, '3months', now, screen)),
);

const groupC: Scenario[] = [
  // 徹夜: 深夜帯へ伸びる連続バー・5:00境界またぎ（now=深夜03:00 = lasdo 日 06-17）。
  scenario(GROUP_C, 'allnighter', NOW_MOMENTS.pastMidnight, { kind: 'record' }),
  // ほぼ終日: ゲージ上限・タイムラインびっしり（now=深夜01:00 で 6:00〜25:00 ≒19h）。
  scenario(GROUP_C, 'marathon', NOW_MOMENTS.lateNight, { kind: 'record' }),
  // 疎データ: 欠け曜日・少サンプル箱ひげ（分析）と、ほぼ空の今日（記録）。
  scenario(GROUP_C, 'sparse', NOW_MOMENTS.weekdayEvening, {
    kind: 'analysis',
    period: 'recent12w',
  }),
  scenario(GROUP_C, 'sparse', NOW_MOMENTS.weekdayEvening, { kind: 'record' }),
];

export const SCENARIOS: Scenario[] = [...groupA, ...groupB, ...groupC];

/** 出力先（リポジトリ直下）。このブランチでは成果物として commit して残す。 */
export const OUT_DIR = 'screenshots';
