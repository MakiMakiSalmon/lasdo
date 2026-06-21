# Git 運用方針

> lasdo の開発フロー。個人プロジェクトだが、変更履歴とレビューの記録を残すため **PR ベース** で運用する。

## 基本方針

- **`main` は常にデプロイ可能な状態を保つ**（壊れたものを直接入れない）。
- **`main` への直接 push はしない**。すべて feature ブランチ → Pull Request → マージ。
- 1人開発でも PR を通すことで、後から「なぜこの変更をしたか」を辿れるようにする。

## ブランチ

| 種別 | 命名例 | 用途 |
|------|--------|------|
| `main` | — | 安定版。保護対象。 |
| feature | `feat/circular-timer` | 機能追加 |
| fix | `fix/overlap-merge` | バグ修正 |
| chore | `chore/setup-vite` | 雑務・設定・依存更新 |
| docs | `docs/update-requirements` | ドキュメントのみ |

```sh
git switch -c feat/circular-timer    # main から派生
# ...作業・コミット...
git push -u origin feat/circular-timer
gh pr create --fill                  # PR を作成
```

## コミットメッセージ（Conventional Commits・緩め）

`<type>: <要約>` の形式。type は最低限で運用する。

```
feat:  新機能
fix:   バグ修正
chore: 設定・依存・雑務
docs:  ドキュメント
refactor: 挙動を変えないコード整理
```

例:
```
feat: 円形タイマーの開始/停止トグルを実装
fix: 深夜またぎブロックが日付境界で二重計上される問題を修正
docs: 要件定義 v1.0 を確定
```

- 要約は日本語で簡潔に（命令形でなくてよい）。
- 1コミット = 1つの意味のまとまり。

## PR

- タイトルはコミットと同じ規約（`feat: ...`）。
- 本文に「何を・なぜ」を1〜2行。要件のどの章に対応するかを書けると後で追いやすい。
- 1人なのでセルフマージでよい。CI を入れたら green を待ってからマージ。
- マージ後は feature ブランチを削除する。

## 1日の区切り的なルール

- WIP のまま長く main を離れない（PR を小さく保つ）。
- 要件定義（`requirements.md`）を変えたら `docs:` コミットで履歴に残す。
