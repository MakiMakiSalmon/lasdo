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
/**
 * 各区間を lasdo 日に割り当て(またぎは分割)、曜日(0=日..6=土)ごとの
 * 平均アクティブ時間/日（ミリ秒）を返す。
 * 合計を「対象期間に含まれるその曜日の日数」で割る（期間可変でも公平に比較できる）。
 */
function avgDurationByWeekday(
  blocks: TimeBlock[],
  range: { from: Date; to: Date },
): Record<number, number>;
```

- `splitByDayBoundary` で日ごとに切ってから曜日へ合算し、`range` 内のその曜日の日数で割る。
- 合計でなく**平均/日**にする理由: 集計窓（直近12週）に含まれる日数が曜日ごとに違っても、曜日間の比較が日数に左右されないため（requirements.md 4.5 / 6.4）。活動カレンダー欄外の曜日平均に使う。

### 3.3 時間帯ヒートマップの素

```ts
/**
 * 曜日×時間帯の「平均アクティブ分/日」を返す（既定 1時間枠・5:00〜29:00 = 24枠）。
 * またぎは分割し、枠境界でさらに割って枠ごとに合算 → その曜日の日数で割る。
 */
function avgMinutesByWeekdayHour(
  blocks: TimeBlock[],
  range: { from: Date; to: Date },
  bucketMinutes = 60,
): WeekdayHourHeatmap;
```

- 分母は `avgDurationByWeekday` と揃え「最初に記録した日以降のその曜日の日数」。使い始めで件数が少ないとき平均が薄まるのを避ける。

### 3.4 活動カレンダー（草）／今週の素

```ts
/** lasdo 日キーごとのアクティブ時間合計（ミリ秒）。記録のない日はキーを持たない。 */
function dailyActiveMs(
  blocks: TimeBlock[],
  range: { from: Date; to: Date },
): Map<DayKey, number>;
```

- 活動カレンダー（1マス=1日）と今週チャート（日別バー）の共通の素。`splitByDayBoundary` で日ごとに切り、`range` でクリップして日キーに合算する。

---

## 4. Repository 層

### 4.1 インターフェース（`src/data/timeBlockRepository.ts`・実装済み）

```ts
interface TimeBlockRepository {
  list(): Promise<TimeBlock[]>;        // start 昇順（tombstone 除外）
  add(block: TimeBlock): Promise<void>;  // id はクライアント採番（安定）
  update(block: TimeBlock): Promise<void>;        // id 一致で更新
  delete(id: string): Promise<void>;              // フェーズ2: ソフト削除
}
```

- **素の CRUD に徹する**。マージ等のドメイン規則は持たない。
- フェーズ2で `replaceAll` を廃止し、差分反映（reconcile）へ移行（§5.1）。id は
  ドメイン/ストアが採番して追加〜同期まで安定させる（オフライン作成行の前提）。

### 4.2 IndexedDB 実装（`indexedDbTimeBlockRepository.ts`・実装済み）

- `toRow`/`toBlock` で `Date ↔ epoch ms` 変換。
- `list`: `orderBy('start')`（フェーズ2 以降は `deleted=0` の tombstone 除外）。
- 実体は `src/data/repository.ts` の `timeBlockRepository` シングルトン。
- フェーズ2 ②: 行に同期メタ（`updatedAt`/`deleted`/`dirty`）を持ち、`delete` は
  ソフト削除。メタは `toBlock` で落とすためドメイン型には出さない（Dexie v2）。

### 4.3 Supabase 同期（フェーズ2 ② 実装済み）

- オフライン先行のため Repository は常にローカル IndexedDB のまま。Supabase は
  **独立した SyncEngine**（`src/sync/`）が IndexedDB ↔ サーバを背景同期する
  （`RemoteSyncSource`/`DexieLocalSync`、LWW・tombstone）。`user_id` は RLS +
  `default auth.uid()` で隠蔽し、境界の型に出さない。詳細は `docs/supabase-setup.md`。

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
  2. 既存 `blocks` + 新/更新区間を `mergeBlocks`。
  3. **旧状態と新状態の差分を Repository に反映**（下記）。
  4. ストアを新状態で更新。

#### 差分永続化（reconcile）— 実装の要

`mergeBlocks` は重なり/隣接を1区間に統合し、**結果の id は先頭区間のものを引き継ぐ**（2.2）。
そのため「マージで吸収されて消えた区間」が DB に残らないよう、旧→新の差分を取って反映する。

```ts
// prev, next はいずれも mergeBlocks 済み（id 一意・start 昇順）
async function reconcile(
  repo: TimeBlockRepository,
  prev: TimeBlock[],
  next: TimeBlock[],
): Promise<void> {
  const prevById = new Map(prev.map(b => [b.id, b]));
  const nextById = new Map(next.map(b => [b.id, b]));

  // (1) next に無い id は削除（マージで吸収された・ユーザー削除）
  for (const b of prev) {
    if (!nextById.has(b.id)) await repo.delete(b.id);
  }
  // (2) next 側を追加 or 更新
  for (const b of next) {
    const before = prevById.get(b.id);
    if (!before) {
      // 新規 id。NewTimeBlock として add（採番は repo 側）
      // ※ mergeBlocks は既存 id を引き継ぐので「真の新規」は add 前の入力に対応
      await repo.add({ start: b.start, end: b.end });
    } else if (before.start.getTime() !== b.start.getTime()
            || before.end.getTime() !== b.end.getTime()) {
      await repo.update(b);   // 端が伸びた区間
    }
  }
}
```

- 注意点:
  - **新規追加の id 採番**: 新ブロックは `mergeBlocks` に入れる前に一度 `repo.add` で採番してから集合に混ぜる、もしくは上記のように「prev に無い区間は add」で吸収する。どちらか一方の方針に統一する（二重採番を避ける）。実装時は前者（先に add → list 再取得 → set）のほうが単純で安全。
  - **トランザクション境界**: Dexie の `db.transaction('rw', ...)` で (1)(2) を包むと中断時の不整合を防げる。
  - 経緯: MVP は簡易策として全置換（clear + bulkAdd）を既定にしていたが、**フェーズ2で `reconcile`（`src/data/reconcile.ts`）へ移行済み**。書き込み増幅 O(N²) を解消し、別タブ/端末の無関係な区間を巻き戻さない（lost update 緩和）。同期（②）の差分伝播の土台でもある。

### 5.2 タイマーストア

```ts
interface TimerStore {
  runningSince: Date | null;   // 稼働中の開始時刻。null=停止中
  start(): void;               // runningSince = now → localStorage へ退避
  stop(): Promise<void>;       // {start: runningSince, end: now} を BlockStore.addBlock
}
```

- 稼働中は TimeBlock としては永続化しない（停止時に確定して1区間を追加）。
- **リロード耐性をMVPに含める**: `runningSince` を localStorage に退避し、起動時に復元する。タブを閉じる/リロードしても稼働中タイマーが消えない。

### 5.3 画面（ビュー）ストア

3画面の切替は **react-router を入れず Zustand の状態で出し分ける**（MVPの3画面には最軽量。URL同期が必要になったら router へ移行）。

```ts
type View = 'record' | 'analysis' | 'edit';

interface ViewStore {
  view: View;          // 既定 'record'
  go(view: View): void;
}
```

- ルート（`App.tsx`）は `view` を見て対応画面を描画するだけ。URLは変わらない／リロードで `record` に戻る（MVPでは許容）。

---

## 6. UI 仕様

> **プラットフォーム方針（MVP）**: requirements.md 4.8 は「PC/スマホで根本的に作り分け」だが、**MVPは PC 先行**（スマホは後回し）。
> 作業中にPCで記録する動線・分析チャートの見やすさ・開発速度を優先する。データ/ロジック/ストアは共通なので、後からスマホ用 Presentation を `src/ui/` 配下に足すだけで分離できる（土台は無駄にならない）。

### 6.1 円形タイマー（自前 SVG）requirements.md 4.7

- 中心 = 開始/停止トグル兼経過時間表示。
- 内側の太いリング = 現在の単位時間の進捗（1周で単位達成）。
- **単位時間 = 25分**（`UNIT_MINUTES = 25` 定数。後から変更可）。単位達成ごとに外側へ細い同心円リングを1本追加。**超過＝良いこと**（緑系）。
- **集約しきい値**: 外周3本まで描画し、4本目以降は `×N` 表記に集約して外周を1本に戻す（`RING_COLLAPSE_AT = 3` 定数。25分単位なら約100分で集約）。
- 補足: 25分は「リングが1周する基準」であり休憩を強制しない（lasdo は休憩を記録しない）。

### 6.2 1日タイムライン（自前 SVG）

- 軸は **5:00〜29:00 固定**（日ごと比較のためズームしない。requirements.md 6.3）。
- `splitByDayBoundary` で当日窓に切ったアクティブ帯を濃色で描画。記録なし=空白。
- 深夜またぎは前後日の窓にまたいで描かれる（データは1件のまま）。

### 6.3 分析（自前描画）

- 期間プリセットは廃止。集計は**固定窓（直近12週 = `recentRange`）**で、各チャートが内部で同じ窓を共有する（画面上部の期間トグルは置かない）。
- すべて**自前描画**（SVG／CSS グリッド）。ECharts は使っていない。
- 活動カレンダー: `dailyActiveMs(blocks, range)` を GitHub の草風に1マス=1日の活動量として並べ、欄外に `avgDurationByWeekday(blocks, range)`（**平均/日**）を曜日ごとに添える。
- 今週: `dailyActiveMs` を今週（日曜起点）の日別アクティブ時間として横棒で表示。
- 時間帯ヒートマップ: `avgMinutesByWeekdayHour(blocks, range)` を曜日×時間帯（1時間枠・5:00〜29:00）の濃淡で描く（「いつ動く人か＝リズムの型」）。
- 箱ひげ図（開始/終了時刻の分布）は**保留**（9章 残課題）。曜日別棒グラフは活動カレンダーの欄外平均に統合して廃止した。

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
| `splitByDayBoundary` | 5:00 前後 / 深夜またぎ / ちょうど境界 / DST非前進で打ち切り |
| `activeDurationMs` | 部分重なり / 完全内包 / 範囲外 |
| `avgDurationByWeekday` | またぎ分割の曜日割当 / 平均=合計÷日数 |
| `avgMinutesByWeekdayHour` | 枠境界での分割 / 曜日×時間帯の平均 |
| `dailyActiveMs` | 日ごと合算 / range クリップ / 記録なし日 |

- 既存 `src/domain/timeBlock.test.ts` を踏襲し、各ドメイン関数に `*.test.ts` を併設。
- State 層は Repository をモックして差分永続化の整合を検証。

---

## 8. 命名・配置規約

- ドメイン純粋関数は `src/domain/<topic>.ts` + `<topic>.test.ts` を併設。
- 副作用（DB/IO）は Repository 層のみ。Domain は副作用ゼロを厳守。
- UI はプラットフォーム別に出し分け（`src/ui/`）。データ・ロジックは共通。

---

## 9. 確定事項と残課題

requirements.md 9章と対応。

### 確定（2026-06-21）
- タイマー単位時間 = **25分**、`×N` 集約 = **外周3本/4本目以降集約**（6.1）。
- 分析: 期間プリセットは廃止し**固定窓（直近12週）**。構成 = 活動カレンダー（草＋曜日平均/日）＋今週＋時間帯ヒートマップ。曜日別棒グラフは欄外平均へ統合して廃止、箱ひげは保留（3.2〜3.4 / 6.3）。
- フェーズ1画面 = **記録／分析／編集の3つ**。設定値は定数で保持。
- タイマー稼働中の**リロード耐性をMVPに含める**（localStorage退避／5.2）。
- 名前の由来 = **"last do"**（過去にやったこと＝実績の逆引き）。
- 画面遷移 = **Zustand の `view` 状態で出し分け**（react-router 不使用／5.3）。
- プラットフォーム = **MVPは PC 先行**（スマホは後回し。store/domain/data は共通／6章冒頭）。

### 確定（2026-06-30・フェーズ2）
- ブロック永続化 = **差分反映（reconcile）**へ移行（全置換を廃止／5.1）。
- **日境界を壁時計基準に統一**し DST 無限ループを根絶（`splitByDayBoundary`／2.3）。
- **認証 = Supabase Auth + Google OAuth**。`user_id` は RLS + `default auth.uid()` で隠蔽（4.3）。
- **同期 = オフライン先行**（IndexedDB 正本 + 背景双方向同期・LWW・tombstone／4.3）。
  重なり除去はクライアント権威（`mergeBlocks`）、サーバは `CHECK(end_ms>start_ms)` のみ。

### 残課題（任意・将来）
- 箱ひげ図（開始/終了時刻の分布）の実装 — 保留中。作るなら極短区間補正（`MIN_BLOCK_MINUTES` 既定5分・開始/終了判定のみ／duration不影響）と「一定以上の空白で区切る」補正もそこで詰める。
- 分析の期間プリセット復活・任意レンジ指定 — 必要になれば（現状は固定窓 直近12週）。
- スマホ版 UI の追加（`ui/` を platform 別に分離）。
- 同期の Realtime ライブ更新（現状は push-on-change + pull-on-focus/interval。`0002` の publication で有効化可）。
- 同期 tombstone の GC（現状は保持。件数が増えたら同期確認後に物理削除）。
</content>
