import type { TimeBlockRepository } from './timeBlockRepository';
import type { TimeBlock } from '../domain/timeBlock';

/**
 * 旧状態 `prev` から新状態 `next` への差分だけを Repository に反映する
 * （detailed-design 5.1）。MVP の全置換（replaceAll）を置き換える。
 *
 * 前提: `prev`/`next` はいずれも `mergeBlocks` 済み（id 一意・start 昇順・重なりなし）。
 * id はクライアントが採番して追加〜同期まで安定させるため、id で対応づけられる。
 *
 * 効果:
 * - **書き込み増幅の解消**: 1件 add しても触れた区間だけを書く（全件再書込みしない）。
 * - **lost update の緩和**: 全置換と違い、別タブ/端末の無関係な区間を巻き戻さない。
 *
 * 反映規則:
 * 1. `next` に無い id → delete（マージで吸収された／ユーザー削除）。
 * 2. `prev` に無い id → add（真の新規。id はそのまま使う＝二重採番しない）。
 * 3. 両方にあり start/end が変わった id → update（端の伸縮）。
 */
export async function reconcile(
  repo: TimeBlockRepository,
  prev: TimeBlock[],
  next: TimeBlock[],
): Promise<void> {
  const prevById = new Map(prev.map((b) => [b.id, b]));
  const nextById = new Map(next.map((b) => [b.id, b]));

  // (1) next に無い id は削除
  for (const b of prev) {
    if (!nextById.has(b.id)) await repo.delete(b.id);
  }
  // (2)(3) 追加 or 端の変化を更新
  for (const b of next) {
    const before = prevById.get(b.id);
    if (!before) {
      await repo.add(b);
    } else if (
      before.start.getTime() !== b.start.getTime() ||
      before.end.getTime() !== b.end.getTime()
    ) {
      await repo.update(b);
    }
  }
}
