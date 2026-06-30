# Supabase 構築手順（フェーズ2 ⓪認証 / ②同期）

> lasdo の多端末同期は Supabase（Auth + Postgres）を使う。コードは実装済みだが、
> **実プロジェクトの作成・OAuth 設定はダッシュボード操作が必要**なので、本書の手順で構築する。
> 構築前でもアプリは IndexedDB 単独で動く（ログイン・同期が無効になるだけ）。

## 1. プロジェクト作成

1. <https://supabase.com> でプロジェクトを作成（リージョンは近い所＝Tokyo 推奨）。
2. **Project Settings > API** から次を控える。
   - `Project URL` → `.env.local` の `VITE_SUPABASE_URL`
   - `Project API keys > anon public` → `VITE_SUPABASE_ANON_KEY`

## 2. 環境変数

リポジトリ直下で `.env.example` を `.env.local` にコピーし、上の2値を設定する
（`.env.local` は gitignore 済み）。

```sh
cp .env.example .env.local
# エディタで VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を記入
```

設定後 `npm run dev` を再起動すると、ヘッダーに「Googleでログイン」が出る。

## 3. Google OAuth

### 3-1. Google Cloud 側
1. <https://console.cloud.google.com> で OAuth 同意画面を構成（External / テストユーザーに自分を追加）。
2. **APIとサービス > 認証情報 > OAuth クライアント ID** を作成（種類: ウェブアプリケーション）。
3. **承認済みのリダイレクト URI** に Supabase のコールバックを登録:
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
   （`<project-ref>` は Project URL のサブドメイン）。
4. 発行された **Client ID / Client Secret** を控える。

### 3-2. Supabase 側
1. **Authentication > Providers > Google** を有効化し、上の Client ID / Secret を貼る。
2. **Authentication > URL Configuration > Redirect URLs** に開発・本番の URL を追加:
   ```
   http://localhost:5173
   <本番URL>
   ```
   （アプリは `redirectTo: window.location.origin` で戻るため、使う origin を登録する。）

## 4. データベース（マイグレーション）

**SQL Editor** で次を順に実行する。

1. `supabase/migrations/0001_time_blocks.sql` … テーブル + RLS（⓪）。
2. `supabase/migrations/0002_sync_columns.sql` … 同期用の列・トリガー（②。②マージ後に実行）。

> 0001 の要点: `user_id` は `default auth.uid()` で自動設定、RLS (`auth.uid() = user_id`) で
> 行レベル分離、`CHECK (end_ms > start_ms)` で不正区間を拒否。クライアントは user_id を送らない。

## 5. 動作確認

- env 設定 → `npm run dev` → 「Googleでログイン」→ Google 認証 → 戻ってメール表示・「ログアウト」が出れば ⓪ 成功。
- ②（同期）の多端末確認手順は ②マージ後に本書へ追記する。
