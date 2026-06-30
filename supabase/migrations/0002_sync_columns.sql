-- フェーズ2 ②同期: time_blocks に同期用の列とトリガーを追加。
-- 0001 を実行済みのプロジェクトで、SQL Editor に貼って実行する。
--
-- 設計:
--   - updated_at: サーバ権威の更新時刻。pull のカーソル（updated_at > since）に使う。
--   - deleted:    tombstone（ソフト削除を多端末へ伝播）。
--   - trigger:    insert/update のたび updated_at = now() を**サーバ側で**刻む
--                 （クライアントは updated_at を送らない＝クロック跨ぎの LWW 比較を避ける）。
--   - 重なり禁止/マージはクライアント権威（mergeBlocks）。サーバは end_ms>start_ms のみ強制。

alter table public.time_blocks
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted    boolean     not null default false;

-- pull の差分取得を効率化（updated_at > cursor の範囲スキャン）。
create index if not exists time_blocks_user_updated_idx
  on public.time_blocks (user_id, updated_at);

-- insert/update のたび updated_at をサーバ時刻で刻む。
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists time_blocks_set_updated_at on public.time_blocks;
create trigger time_blocks_set_updated_at
  before insert or update on public.time_blocks
  for each row execute function public.set_updated_at();

-- （任意）Realtime で多端末ライブ更新したい場合は supabase_realtime publication に追加する:
--   alter publication supabase_realtime add table public.time_blocks;
-- 現状の同期はこれ無しでも push-on-change + pull-on-focus/interval で動く。
