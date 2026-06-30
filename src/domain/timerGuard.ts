/**
 * タイマー消し忘れガード（detailed-design 補遺）。
 *
 * タイマーを止め忘れて長時間放置すると、停止時に巨大な1区間が確定し、
 * マージでその間に編集画面で追加した記録が吸収・消失する恐れがある。
 * これを「自動分類しない」設計原則を破らずに防ぐための、閾値・判定・文言。
 *
 * - 予防（B）: 一定時間を超えて稼働中なら記録画面に警告バナーを出す。
 * - 確認（A）: 停止時に閾値を超えていたら保存前に確認する（ユーザーの意思は尊重）。
 *
 * ここは純粋関数のみ。UI 描画・ダイアログ表示は呼び出し側が担う。
 */

const HOUR_MS = 3_600_000;

/** これ以上稼働し続けたら記録画面に警告バナーを出す（消し忘れの予防）。 */
export const WARN_AFTER_HOURS = 6;
/** 停止時にこの長さを超えていたら保存前に確認する（巨大ブロック防止）。 */
export const CONFIRM_AFTER_HOURS = 24;

export const WARN_AFTER_MS = WARN_AFTER_HOURS * HOUR_MS;
export const CONFIRM_AFTER_MS = CONFIRM_AFTER_HOURS * HOUR_MS;

/** 稼働が長すぎて警告バナーを出すべきか（予防）。 */
export function shouldWarnLongRun(elapsedMs: number): boolean {
  return elapsedMs >= WARN_AFTER_MS;
}

/** 停止時、保存前に確認を要するほど長いか（確認）。 */
export function needsLongRunConfirm(elapsedMs: number): boolean {
  return elapsedMs >= CONFIRM_AFTER_MS;
}

/**
 * 経過を「N日M時間」「M時間S分」など人間向けに整形する。
 * 警告・確認の文言で使う概算なので、表示しない下位の端数は丸めて落とす。
 */
export function formatLongDuration(elapsedMs: number): string {
  const totalMin = Math.floor(Math.max(0, elapsedMs) / 60_000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return hours > 0 ? `${days}日${hours}時間` : `${days}日`;
  if (hours > 0) return mins > 0 ? `${hours}時間${mins}分` : `${hours}時間`;
  return `${mins}分`;
}

/** 長時間稼働を停止したときの保存確認メッセージ。 */
export function longRunConfirmMessage(elapsedMs: number): string {
  return (
    `この記録は ${formatLongDuration(elapsedMs)} と非常に長くなっています。\n` +
    'タイマーの消し忘れではありませんか？\n\n' +
    'このまま1区間として保存すると、その間に編集画面で追加した記録が' +
    '吸収されて消える場合があります。保存しますか？'
  );
}
