/**
 * `<input type="datetime-local">` の値（"YYYY-MM-DDTHH:mm"・ローカル時刻）と
 * Date の相互変換。タイムゾーンずれを避けるためローカル各成分で組み立てる。
 */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toLocalInput(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** 不正な文字列は null を返す。 */
export function fromLocalInput(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const date = new Date(y, mo - 1, d, h, mi, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}
