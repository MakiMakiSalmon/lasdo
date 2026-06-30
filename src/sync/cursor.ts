/**
 * pull カーソル（最後に取り込んだサーバ updated_at の ISO）をユーザー別に保持する。
 * localStorage に置くので、リロードしても全件再 pull せず差分だけ取れる。
 */
const key = (userId: string) => `lasdo:syncCursor:${userId}`;

export function makeCursorStore(userId: string) {
  return {
    get: (): string | null => localStorage.getItem(key(userId)),
    set: (cursor: string | null): void => {
      if (cursor) localStorage.setItem(key(userId), cursor);
    },
  };
}
