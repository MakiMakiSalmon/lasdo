import type { VolumePreset } from './seed';

/**
 * 撮影マトリクス（このブランチ専用・main 非マージ）。
 *
 * 「時間が経過したときの動作・デザイン」を2軸で固定して撮る:
 *   A) データ量軸 … now を固定し、蓄積量(1週〜3年)を振る。分析画面は 4週/全期間 両方。
 *   B) 現在時刻軸 … データ量を固定(3ヶ月)し、now の瞬間を振る（5:00境界/週明け等）。
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
  preset: VolumePreset;
  now: NowMoment;
  screen: ScreenSpec;
}

const VOLUME_LABEL: Record<VolumePreset, string> = {
  empty: '記録なし',
  '1week': '1週間',
  '1month': '1ヶ月',
  '3months': '3ヶ月',
  '1year': '1年',
  '3years': '3年',
};

function screenLabel(s: ScreenSpec): string {
  if (s.kind === 'record') return '記録画面';
  return `分析画面（${PERIOD_LABEL[s.period]}）`;
}

function scenario(
  group: string,
  preset: VolumePreset,
  now: NowMoment,
  screen: ScreenSpec,
): Scenario {
  const screenId =
    screen.kind === 'record' ? 'record' : `analysis-${screen.period}`;
  return {
    group,
    name: `${preset}__${now.id}__${screenId}`,
    caption: `${VOLUME_LABEL[preset]} / ${now.label} / ${screenLabel(screen)}`,
    preset,
    now,
    screen,
  };
}

const GROUP_A = 'A. 経過時間（データ量）— now 固定: 平日夜・水 21:30';
const GROUP_B = 'B. 現在時刻の進行 — データ固定: 3ヶ月';

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

export const SCENARIOS: Scenario[] = [...groupA, ...groupB];

/** 出力先（リポジトリ直下）。このブランチでは成果物として commit して残す。 */
export const OUT_DIR = 'screenshots';
