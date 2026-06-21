import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { OUT_DIR, PERIOD_LABEL, SCENARIOS, type Scenario } from './matrix';
import {
  generateSeedBlocks,
  serialize,
  VOLUME_PRESETS,
  type SerializedBlock,
} from './seed';

/**
 * 経過時間スクショ（このブランチ専用・main 非マージ）。
 *
 * 各シナリオで:
 *   1. ブラウザ時計を install で仮想化（new Date()/Date.now() が固定 now から始まる）。
 *   2. アプリを開いて、実 Repository(replaceAll) 経由で合成データを投入 → reload。
 *   3. 対象画面へ遷移し、clock.runFor で仮想時間を進めて ECharts のアニメを完走させ、
 *      main.app を要素スクショ。
 *
 * なぜ setFixedTime ではなく install か:
 *   zrender(ECharts) のアニメは経過時間を Date.now() の差分で測る。setFixedTime だと
 *   Date.now() が凍結して経過0 → 棒は高さ0・箱ひげは中央線だけで固まる。install + runFor
 *   なら now を固定しつつ仮想時間を任意に進められ、アニメが正しく完了する。
 */

/** zrender アニメ(≈1s)を確実に完走させるための仮想前進量。 */
const ANIM_MS = 1500;

/** ブラウザ文脈で、実 Repository を動的 import して全置換投入する。 */
async function seedViaRepository(page: Page, blocks: SerializedBlock[]): Promise<void> {
  await page.evaluate(async (raw) => {
    // Vite dev サーバが配信するアプリ本体のモジュールをそのまま使う（境界を破らない）。
    const mod = await import('/src/data/repository.ts');
    await mod.timeBlockRepository.replaceAll(
      raw.map((b) => ({
        id: b.id,
        start: new Date(b.start),
        end: new Date(b.end),
      })),
    );
  }, blocks);
}

async function gotoScreen(page: Page, sc: Scenario): Promise<void> {
  if (sc.screen.kind === 'record') {
    await page.getByRole('button', { name: '記録' }).click();
    // 自前 SVG（タイマー/タイムライン）は非アニメ。微小に進めて描画を固める。
    await page.clock.runFor(ANIM_MS);
    return;
  }

  await page.getByRole('button', { name: '分析' }).click();
  if (sc.screen.period !== 'recent4w') {
    await page
      .getByRole('button', { name: PERIOD_LABEL[sc.screen.period], exact: true })
      .click();
  }
  // ECharts は SVG レンダラ（canvas ではない）。コンテナのマウントを待ってから
  // 仮想時間を進めて、棒/箱ひげのアニメを最終状態まで描き切らせる。
  await page
    .locator('.echarts-for-react')
    .first()
    .waitFor({ state: 'visible', timeout: 5000 })
    .catch(() => {
      /* データなし等は無視 */
    });
  // useEffect で ECharts.init とアニメ rAF が積まれるのを実時間で待ってから、
  // 仮想時間を進めて完走させる（順序を誤ると最初のフレームを取りこぼす）。
  await page.waitForTimeout(200);
  await page.clock.runFor(ANIM_MS);
  await page.waitForTimeout(150);
}

// 同一 (preset, now, screen) はグループをまたいで再掲されうる（B が平日夜の基準を
// A と共有する等）。描画は name 単位で1回だけ（同名は同一画像を使い回す）。
const seen = new Set<string>();
const RENDER = SCENARIOS.filter((s) => {
  if (seen.has(s.name)) return false;
  seen.add(s.name);
  return true;
});

test.describe('経過時間スクショ', () => {
  for (const sc of RENDER) {
    test(sc.name, async ({ page }) => {
      await page.clock.install({ time: sc.now.at });

      await page.goto('/');
      await seedViaRepository(page, serialize(generateSeedBlocks(sc.now.at, VOLUME_PRESETS[sc.preset])));
      await page.reload();

      // 初期ロード完了（「読み込み中…」が消える）まで待つ。
      await expect(page.getByText('読み込み中…')).toBeHidden();

      await gotoScreen(page, sc);

      await page
        .locator('main.app')
        .screenshot({ path: path.join(OUT_DIR, `${sc.name}.png`) });
    });
  }
});
