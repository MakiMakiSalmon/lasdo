import Dexie, { type EntityTable } from 'dexie';

/**
 * 永続化用の行表現。日時はタイムゾーン非依存に扱えるよう epoch ミリ秒で保存する
 * （ドメイン層では Date に変換して扱う）。
 *
 * フェーズ2 ② の同期メタ:
 *   - updatedAt: 直近のローカル書込時刻（epoch ms・ローカル時計）。
 *   - deleted:   tombstone（1=削除済み。削除は物理ではなくソフト削除で伝播させる）。
 *   - dirty:     未 push（1=サーバへ送る必要あり）。
 * これらは同期専用で、ドメイン（TimeBlock）には漏らさない。
 */
export interface TimeBlockRow {
  id: string;
  start: number;
  end: number;
  updatedAt: number;
  deleted: 0 | 1;
  dirty: 0 | 1;
}

const db = new Dexie('lasdo') as Dexie & {
  timeBlocks: EntityTable<TimeBlockRow, 'id'>;
};

// v1: start にインデックス（昇順取得）。
db.version(1).stores({
  timeBlocks: 'id, start',
});

// v2: 同期メタを追加。dirty にインデックス（未 push 行の抽出を効率化）。
// 既存行は updatedAt=now / deleted=0 / dirty=1 で移行し、初回同期で push 対象にする。
db.version(2)
  .stores({
    timeBlocks: 'id, start, dirty',
  })
  .upgrade((tx) =>
    tx
      .table<TimeBlockRow>('timeBlocks')
      .toCollection()
      .modify((row) => {
        row.updatedAt = Date.now();
        row.deleted = 0;
        row.dirty = 1;
      }),
  );

export { db };
