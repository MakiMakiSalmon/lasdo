import fs from 'node:fs';
import path from 'node:path';
import { OUT_DIR, SCENARIOS, type Scenario } from './matrix';

/**
 * 撮影後に、SCENARIOS を唯一の真実としてコンタクトシートを生成する
 * （global teardown から呼ばれる・このブランチ専用）。
 *
 * 「経過時間 → 画面」を一覧で対応づけるのが本体の成果物。
 * 実在する PNG だけを並べる（失敗で欠けても落ちない）。
 */

function byGroup(scenarios: Scenario[]): Map<string, Scenario[]> {
  const m = new Map<string, Scenario[]>();
  for (const sc of scenarios) {
    const list = m.get(sc.group) ?? [];
    list.push(sc);
    m.set(sc.group, list);
  }
  return m;
}

function exists(sc: Scenario): boolean {
  return fs.existsSync(path.join(OUT_DIR, `${sc.name}.png`));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHtml(groups: Map<string, Scenario[]>): string {
  const generatedAt = new Date().toISOString();
  const sections = [...groups.entries()]
    .map(([group, list]) => {
      const cards = list
        .filter(exists)
        .map(
          (sc) => `
      <figure class="card">
        <a href="${sc.name}.png" target="_blank" rel="noopener">
          <img src="${sc.name}.png" alt="${escapeHtml(sc.caption)}" loading="lazy" />
        </a>
        <figcaption>${escapeHtml(sc.caption)}</figcaption>
      </figure>`,
        )
        .join('');
      return `
    <section>
      <h2>${escapeHtml(group)}</h2>
      <div class="grid">${cards}</div>
    </section>`;
    })
    .join('');

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>lasdo 経過時間スクショ</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 24px; line-height: 1.5; }
  h1 { font-size: 1.4rem; }
  .meta { color: #888; font-size: .85rem; margin-bottom: 1.5rem; }
  section { margin: 2rem 0; }
  h2 { font-size: 1.05rem; border-bottom: 1px solid #8884; padding-bottom: .3rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .card { margin: 0; border: 1px solid #8884; border-radius: 10px; overflow: hidden; background: #8881; }
  .card img { width: 100%; display: block; background: #fff; }
  figcaption { font-size: .8rem; padding: 8px 10px; }
</style>
</head>
<body>
  <h1>lasdo 経過時間スクショ</h1>
  <p class="meta">generated ${generatedAt} ・ 時計固定 + 決定的シードで再現可能</p>
  ${sections}
</body>
</html>
`;
}

function renderMarkdown(groups: Map<string, Scenario[]>): string {
  const lines: string[] = ['# lasdo 経過時間スクショ', ''];
  for (const [group, list] of groups) {
    lines.push(`## ${group}`, '');
    for (const sc of list.filter(exists)) {
      lines.push(`### ${sc.caption}`, '', `![${sc.caption}](${sc.name}.png)`, '');
    }
  }
  return lines.join('\n');
}

export function writeContactSheet(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const groups = byGroup(SCENARIOS);
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), renderHtml(groups));
  fs.writeFileSync(path.join(OUT_DIR, 'index.md'), renderMarkdown(groups));

  const total = SCENARIOS.filter(exists).length;
  // eslint-disable-next-line no-console
  console.log(`\n[contact-sheet] ${total}/${SCENARIOS.length} 枚 → ${OUT_DIR}/index.html`);
}
