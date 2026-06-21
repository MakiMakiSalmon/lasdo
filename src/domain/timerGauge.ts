/**
 * 円形タイマー（ゼルダBotWのがんばりゲージ風）のゲージ計算（detailed-design 6.1）。
 *
 * 純粋関数。経過ミリ秒から「現在の単位内の進捗」「完了した単位数」「外周リング本数」
 * を求める。描画（SVG）は ui 側、ここは数値のみ。
 */

/** 1単位（内側リングが1周する基準）= 25分。休憩は強制しない。 */
export const UNIT_MINUTES = 25;

/** 外周リングは最大この本数まで描画し、超えたら ×N 集約して1本に戻す。 */
export const RING_COLLAPSE_AT = 3;

export interface GaugeState {
  /** 完了した単位数（floor）。超過＝良いこと。 */
  completedUnits: number;
  /** 現在の単位内の進捗 0..1（内側の太いリングの充填率）。 */
  progressInUnit: number;
  /** 外周リングを ×N に集約表示するか（completedUnits > collapseAt）。 */
  collapsed: boolean;
  /** 実際に描く外周リング本数（collapsed 時は 1）。 */
  outerRings: number;
}

export function gaugeState(
  elapsedMs: number,
  unitMinutes: number = UNIT_MINUTES,
  collapseAt: number = RING_COLLAPSE_AT,
): GaugeState {
  const unitMs = unitMinutes * 60_000;
  const safe = Math.max(0, elapsedMs);
  const completedUnits = Math.floor(safe / unitMs);
  const progressInUnit = (safe % unitMs) / unitMs;
  const collapsed = completedUnits > collapseAt;
  const outerRings = collapsed ? 1 : completedUnits;
  return { completedUnits, progressInUnit, collapsed, outerRings };
}

/**
 * 経過ミリ秒を時計表示へ整形する。
 * 1時間未満は "M:SS"、1時間以上は "H:MM:SS"。
 */
export function formatElapsed(elapsedMs: number): string {
  const totalSec = Math.floor(Math.max(0, elapsedMs) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}
