# 経過時間スクショ（時間が経過したときの動作・デザイン確認）

一週間・数ヶ月・数年とデータが溜まった／時刻が進んだときに、画面がどう見えるか・
重くならないかを **時計を固定 + 決定的シード** で再現し、スクショに残すための一式。

## ⚠️ このブランチの運用方針（重要）

このブランチ `test/elapsed-time-screenshots` は **`main` にマージしない・削除しない**。

- 目的は「検証ツールを資産として残す」こと。ただし dev 用コードが `main` に混ざって
  消し忘れる事故を避けるため、**`src/` を一切変更せず**この `e2e/` 一式だけで完結させている。
- シード投入はアプリの `?seed=` フック等を足さず、Playwright から
  **実 Repository(`timeBlockRepository.replaceAll`) を動的 import** して行う（境界を破らない）。
- `src/` 非変更なので、UI が進んだら `git merge main`（ほぼ無衝突）で追従して撮り直せる。

`main` に持っていくのは `package.json` の devDeps 1 行（`@playwright/test`）だけだが、
それも含めてこのブランチに閉じている。

## 使い方

```bash
npm install                      # @playwright/test を入れる
npx playwright install chromium  # 初回のみブラウザ取得
npm run screenshots              # 撮影 → screenshots/ に PNG とコンタクトシート
```

撮り終わると `screenshots/index.html`（一覧・グループ別）が生成される。ブラウザで開いて
「経過時間 → 画面」の対応を眺めるのが本体。`screenshots/index.md` も同時生成。

## 構成

| ファイル | 役割 |
| --- | --- |
| `seed.ts` | 決定的 PRNG で合成アクティブ区間を生成（`mergeBlocks` で正規化） |
| `matrix.ts` | 撮影マトリクス（データ量軸 / 現在時刻軸）。唯一の真実 |
| `screenshots.spec.ts` | 時計固定 → シード投入 → 画面遷移 → 要素スクショ |
| `contact-sheet.ts` / `global-teardown.ts` | `index.html` / `index.md` を生成 |
| `../playwright.config.ts` | dev サーバ自動起動・出力設定 |

## 撮影軸

- **A. データ量**: now を「平日夜・水 21:30」に固定し、`1週間〜3年`（＋記録なし）を振る。
  分析画面は「直近4週」と「全期間」の両方を撮る（長期の見え方/密度/描画速度の確認）。
- **B. 現在時刻**: データを「3ヶ月」に固定し、now を `平日夜 / 深夜(5:00境界の手前) / 週明け朝`
  で振る（"今日"の描画・5:00 起点・週境界の挙動）。
- **C. 極端ケース**: 活動リズムが歪な日の見え方。`徹夜`（深夜帯へ伸びる連続バー・5:00境界またぎ）/
  `ほぼ終日アクティブ`（ゲージ上限・タイムラインびっしり）/ `疎データ`（欠け曜日・少サンプル箱ひげ）。

マトリクスを変えたいときは `matrix.ts` を編集する。データ量を増やすなら `seed.ts` の
`VOLUME_PRESETS` に日数を足す。新しい歪なリズムを足すなら `seed.ts` に専用ジェネレータを
追加して `DatasetKey` / `buildDataset` に繋ぐ。
