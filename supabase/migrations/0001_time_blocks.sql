-- フェーズ2 ⓪認証: time_blocks テーブル + RLS（行レベル所有分離）。
-- Supabase ダッシュボード > SQL Editor に貼って実行する（docs/supabase-setup.md 参照）。
--
-- 設計の要点:
--   - user_id は default auth.uid() で自動設定 → クライアントは user_id を送らない。
--   - RLS (auth.uid() = user_id) で自分の行だけ read/write。
--   - CHECK (end_ms > start_ms) で不正区間（ゼロ幅・逆転）を DB が拒否。
--   - id はクライアント採番の UUID（オフライン作成行が安定 id を持つ＝同期の前提）。
--   - 日時は epoch ミリ秒（bigint）。タイムゾーン非依存（ローカル IndexedDB と同形）。
--   - 同期用の列（updated_at / deleted）は ②（0002）で追加する。

create table if not exists public.time_blocks (
  id        uuid primary key,
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_ms  bigint not null,
  end_ms    bigint not null,
  constraint time_blocks_end_after_start check (end_ms > start_ms)
);

create index if not exists time_blocks_user_start_idx
  on public.time_blocks (user_id, start_ms);

alter table public.time_blocks enable row level security;

-- 自分の行だけ参照・作成・更新・削除できる。
create policy "time_blocks_select_own"
  on public.time_blocks for select
  using (auth.uid() = user_id);

create policy "time_blocks_insert_own"
  on public.time_blocks for insert
  with check (auth.uid() = user_id);

create policy "time_blocks_update_own"
  on public.time_blocks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "time_blocks_delete_own"
  on public.time_blocks for delete
  using (auth.uid() = user_id);
