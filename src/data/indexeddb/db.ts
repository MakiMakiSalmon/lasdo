import Dexie, { type EntityTable } from 'dexie';

/**
 * 永続化用の行表現。日時はタイムゾーン非依存に扱えるよう epoch ミリ秒で保存する
 * （ドメイン層では Date に変換して扱う）。
 */
export interface TimeBlockRow {
  id: string;
  start: number;
  end: number;
}

const db = new Dexie('lasdo') as Dexie & {
  timeBlocks: EntityTable<TimeBlockRow, 'id'>;
};

// start にインデックスを張り、昇順取得を効率化する。
db.version(1).stores({
  timeBlocks: 'id, start',
});

export { db };
