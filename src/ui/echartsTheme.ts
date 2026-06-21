/**
 * ECharts 用にアプリのテーマ色（CSS変数）を読み出す。
 * ダーク/ライトは index.css の :root / prefers-color-scheme で切替済みなので、
 * 実行時に getComputedStyle で解決すれば自動で追従する。
 */
export interface ChartTheme {
  text: string;
  textStrong: string;
  axis: string;
  accent: string;
  good: string;
}

function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v.trim() || fallback;
}

export function chartTheme(): ChartTheme {
  return {
    text: cssVar('--text', '#6b6375'),
    textStrong: cssVar('--text-h', '#08060d'),
    axis: cssVar('--border', '#e5e4e7'),
    accent: cssVar('--accent', '#aa3bff'),
    good: cssVar('--good', '#22c55e'),
  };
}
