# 詳細設計 (Detailed Design)

> lasdo MVP（フェーズ1）の詳細設計。**どう実装するか**（型・関数シグネチャ・アルゴリズム・集計式）。
> 上位は [basic-design.md](basic-design.md)、正典は [requirements.md](../requirements.md)。
> 作成: 2026-06-21 / 対象: フェーズ1（Webコア）

本書は既存実装（`src/domain/`, `src/data/`）の確定仕様と、これから追加する `store/` `ui/` の設計仕様を記す。

---

## 1. データモデル

### 1.1 ドメイン型（`src/domain/timeBlock.ts`・実装済み）

```ts
interface TimeBlock {
  id: string;
  start: Date;   // end より前
  end: Date;     // start より後
}
type NewTimeBlock = Omit<TimeBlock, 'id'>;  // 新規追加入力（id 未採番）
```

- 種別カラムなし（非アクティブは「記録の不在」で表す。requirements.md 4.2）。
- 1区間 = 1つの連続したアクティブ時間。深夜またぎも分割せず1件。

### 1.2 永続化行（`src/data/indexeddb/db.ts`・実装済み）

```ts
interface TimeBlockRow {
  id: string;
  start: number;   // epoch ミリ秒
  end: number;     // epoch ミリ秒
}
```

- 日時は **epoch ミリ秒**で保存（タイムゾーン非依存）。ドメイン変換で `Date` 化。
- Dexie スキーマ: `timeBlocks: 'id, start'`（`start` にインデックス、昇順取得を効率化）。

---

## 2. ドメイン関数

### 2.1 検証 `isValidBlock`（実装済み）

```ts
function isValidBlock(block: Pick<TimeBlock, 'start' | 'end'>): boolean;
```

- `end.getTime() > start.getTime()` を返す。ゼロ幅・逆転を弾く（requirements.md 6.2）。

### 2.2 マージ `mergeBlocks`（実装済み）

```ts
function mergeBlocks(blocks: TimeBlock[]): TimeBlock[];
```

アルゴリズム:
1. `isValidBlock` で不正区間を除外。
2. `start` 昇順ソート。
3. 直前の確定区間 `last` と比較し、`block.start <= last.end` なら**重なり/隣接**としてマージ（`last.end` を伸ばす）。それ以外は新区間として push。

- **隣接もマージ**（`<=` 判定）。例: 10:00–11:00 と 11:00–12:00 → 10:00–12:00。
- マージ結果の `id` は**先頭区間のものを引き継ぐ**。永続化時の id 整合は呼び出し側（State 層）の責務。
- 不変条件: 出力は重なりなし・`start` 昇順 → 「アクティブ合計 = 各区間長の総和」が二重計上なく成立。

> **配置原則**: `mergeBlocks` は Domain（純粋関数）。Repository には置かない。State 層が add/update の前に適用する。

### 2.3 日付境界（5:00起点）— ★これから実装

requirements.md 6.3。「1日」= 5:00〜翌4:59。表示・集計時のみ使う。

```ts
/** 与えた日時が属する「lasdo 日」(5:00起点)の論理日付キー(YYYY-MM-DD)を返す。 */
function lasdoDayKey(d: Date): string;

/** lasdo 日 key の表示窓 [5:00, 翌5:00) を返す。 */
function dayWindow(key: string): { start: Date; end: Date };

/** 区間を lasdo 日の境界で切り、各日に属する部分区間へ分割する。 */
function splitByDayBoundary(block: TimeBlock): Array<{ key: string; start: Date; end: Date }>;
```

- 実装方針: `d` の時刻が 5:00 未満なら「前日」に属する。`date-fns` の `subHours(d, 5)` 後に日付を取る等で算出。
- `splitByDayBoundary` は**表示・集計専用**。保存データは無加工（requirements.md 4.4）。

---

## 3. 集計（`src/domain/aggregation.ts`）— ★これから実装

requirements.md 6.4。すべて `TimeBlock[]` を入力とする純粋関数。

### 3.1 アクティブ合計

```ts
/** 期間 [from, to) に重なる区間長の合計（ミリ秒）。 */
function activeDurationMs(blocks: TimeBlock[], from: Date, to: Date): number;
```

- 各区間と `[from, to)` の重なり長を加算。マージ済み前提なら二重計上なし。

### 3.2 曜日別合計

```ts
/** 各区間を lasdo 日に割り当て(またぎは分割)、曜日(0=日..6=土)ごとに合算(ミリ秒)。 */
function durationByWeekday(blocks: TimeBlock[]): Record<number, number>;
```

- `splitByDayBoundary` で日ごとに切ってから曜日へ集約。

### 3.3 開始/終了時刻の分布（箱ひげ図の素）

```ts
/** 各 lasdo 日の「最初の区間の開始」「最後の区間の終了」を集める。 */
function dailyStartEnd(blocks: TimeBlock[]): Array<{ key: string; startMin: number; endMin: number }>;
```

- `startMin`/`endMin` は 5:00 起点の経過分（0〜1440）。タイムライン軸 5:00〜29:00 と整合。
- **既知の穴**（requirements.md 6.4）: 朝/深夜の極短区間で開始/終了が実態とズレる。当面は素直な定義のまま。困れば「短区間無視」等を後付け（9章）。

---

## 4. Repository 層

### 4.1 インターフェース（`src/data/timeBlockRepository.ts`・実装済み）

```ts
interface TimeBlockRepository {
  list(): Promise<TimeBlock[]>;        // start 昇順
  add(block: NewTimeBlock): Promise<TimeBlock>;  // 採番して返す
  update(block: TimeBlock): Promise<void>;        // id 一致で更新
  delete(id: string): Promise<void>;
}
```

- **素の CRUD に徹する**。マージ等のドメイン規則は持たない。

### 4.2 IndexedDB 実装（`indexedDbTimeBlockRepository.ts`・実装済み）

- `toRow`/`toBlock` で `Date ↔ epoch ms` 変換。
- `add`: `crypto.randomUUID()` で採番。
- `list`: `orderBy('start')`。
- 実体は `src/data/repository.ts` の `timeBlockRepository` シングルトン。**差し替えはここ1行**。

### 4.3 将来の Supabase 実装

- 同インターフェースを実装する別クラスを作り、`repository.ts` の代入を差し替えるだけ。UI/集計は無変更。

---

## 5. State 層（Zustand）— ★これから実装

`src/store/` に配置。Domain 規則を適用して Repository を呼ぶ。

### 5.1 ブロックストア

```ts
interface BlockStore {
  blocks: TimeBlock[];                 // マージ済み・start 昇順
  load(): Promise<void>;               // repo.list → set
  addBlock(b: NewTimeBlock): Promise<void>;   // mergeBlocks 適用後に永続化
  updateBlock(b: TimeBlock): Promise<void>;
  deleteBlock(id: string): Promise<void>;
}
```

- `addBlock`/`updateBlock` の手順:
  1. `isValidBlock` で検証（不正なら拒否）。
  2. 既存 `blocks` + 新区間を `mergeBlocks`。
  3. **差分を Repository に反映**（マージで消えた区間は delete、変化した区間は update、新規は add）。
  4. ストアを更新。
- マージで id が統合される点（2.2）に注意し、差分計算で永続化の整合を取る。

### 5.2 タイマーストア

```ts
interface TimerStore {
  runningSince: Date | null;   // 稼働中の開始時刻。null=停止中
  start(): void;               // runningSince = now
  stop(): Promise<void>;       // {start: runningSince, end: now} を BlockStore.addBlock
}
```

- 稼働中は永続化しない（停止時に確定して1区間を追加）。
- リロード耐性が要れば `runningSince` を localStorage に退避（MVPでは任意）。

---

## 6. UI 仕様

### 6.1 円形タイマー（自前 SVG）requirements.md 4.7

- 中心 = 開始/停止トグル兼経過時間表示。
- 内側の太いリング = 現在の単位時間の進捗（1周で単位達成）。
- 単位達成ごとに外側へ細い同心円リングを1本追加。**超過＝良いこと**（緑系）。
- 外周が増えすぎる前に `×N` 集約（外周は1本に戻す）。
- **未確定**: 単位時間の具体値（1h?）、集約しきい値（外周何本で `×N`）→ requirements.md 9章。

### 6.2 1日タイムライン（自前 SVG）

- 軸は **5:00〜29:00 固定**（日ごと比較のためズームしない。requirements.md 6.3）。
- `splitByDayBoundary` で当日窓に切ったアクティブ帯を濃色で描画。記録なし=空白。
- 深夜またぎは前後日の窓にまたいで描かれる（データは1件のまま）。

### 6.3 分析（ECharts）

- 曜日別棒: `durationByWeekday` を棒グラフへ。
- 箱ひげ: `dailyStartEnd` の `startMin`/`endMin` 分布を box plot へ。
- **未確定**: 期間切替（週/月/全期間）、箱ひげを全体1本 vs 曜日別 → 9章。

### 6.4 編集フォーム

- 開始/終了の日時入力 → `isValidBlock` 検証 → BlockStore へ。
- 追加・時刻変更・削除に対応。記録画面からの別画面（basic-design 4.1）。

---

## 7. テスト方針（Vitest）

純粋関数（Domain）を主戦場にする。

| 対象 | 観点 |
|------|------|
| `isValidBlock` | 正常 / ゼロ幅 / 逆転 |
| `mergeBlocks` | 重なり統合 / 隣接統合 / 非重複維持 / 不正除外 / id 引き継ぎ |
| `splitByDayBoundary` | 5:00 前後 / 深夜またぎ / ちょうど境界 |
| `activeDurationMs` | 部分重なり / 完全内包 / 範囲外 |
| `durationByWeekday` | またぎ分割の曜日割当 |
| `dailyStartEnd` | 複数区間日 / 単一区間日 / 5:00起点の分換算 |

- 既存 `src/domain/timeBlock.test.ts` を踏襲し、各ドメイン関数に `*.test.ts` を併設。
- State 層は Repository をモックして差分永続化の整合を検証。

---

## 8. 命名・配置規約

- ドメイン純粋関数は `src/domain/<topic>.ts` + `<topic>.test.ts` を併設。
- 副作用（DB/IO）は Repository 層のみ。Domain は副作用ゼロを厳守。
- UI はプラットフォーム別に出し分け（`src/ui/`）。データ・ロジックは共通。

---

## 9. 未確定事項（実装時に確定）

requirements.md 9章と対応。確定したら本書と requirements を更新する。

- タイマー単位時間の値・`×N` 集約しきい値（6.1）。
- 分析画面の期間切替／箱ひげの粒度（6.3）。
- 箱ひげの開始/終了定義の補正（3.3 の既知の穴）。
- 編集・履歴画面の詳細 UI（6.4）。
- タイマー稼働中状態のリロード耐性（5.2）。
</content>
