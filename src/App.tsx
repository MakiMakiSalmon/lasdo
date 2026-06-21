import { useEffect, useState } from 'react';
import './App.css';
import { useBlockStore } from './store/blockStore';
import { useViewStore } from './store/viewStore';
import { RecordScreen } from './ui/RecordScreen';

/**
 * ルート。view 状態を見て画面を出し分ける（detailed-design 5.3）。
 * UI は Repository を直接叩かず BlockStore 越しにデータへ触る。
 * 分析/編集画面は後続 PR で追加する。
 */
function App() {
  const blocks = useBlockStore((s) => s.blocks);
  const load = useBlockStore((s) => s.load);
  const view = useViewStore((s) => s.view);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    load().then(() => setLoaded(true));
  }, [load]);

  return (
    <main className="app">
      <h1>lasdo</h1>
      {!loaded ? (
        <p className="status">読み込み中…</p>
      ) : view === 'record' ? (
        <RecordScreen blocks={blocks} />
      ) : (
        <p className="note">この画面は後続 PR で実装します。</p>
      )}
    </main>
  );
}

export default App;
