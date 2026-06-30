import { useEffect, useState } from 'react';
import './App.css';
import { useBlockStore } from './store/blockStore';
import { useViewStore } from './store/viewStore';
import { useSync } from './sync/useSync';
import { AnalysisScreen } from './ui/AnalysisScreen';
import { AuthControl } from './ui/AuthControl';
import { EditScreen } from './ui/EditScreen';
import { Nav } from './ui/Nav';
import { RecordScreen } from './ui/RecordScreen';

/**
 * ルート。view 状態を見て画面を出し分ける（detailed-design 5.3）。
 * UI は Repository を直接叩かず BlockStore 越しにデータへ触る。
 */
function App() {
  const blocks = useBlockStore((s) => s.blocks);
  const load = useBlockStore((s) => s.load);
  const view = useViewStore((s) => s.view);
  const [loaded, setLoaded] = useState(false);

  // 認証時に背景同期を起動（未構成/未ログインなら no-op）。
  useSync();

  useEffect(() => {
    load().then(() => setLoaded(true));
  }, [load]);

  return (
    <main className="app">
      <h1>lasdo</h1>
      <AuthControl />
      <Nav />
      {!loaded ? (
        <p className="status">読み込み中…</p>
      ) : view === 'analysis' ? (
        <AnalysisScreen blocks={blocks} />
      ) : view === 'edit' ? (
        <EditScreen />
      ) : (
        <RecordScreen blocks={blocks} />
      )}
    </main>
  );
}

export default App;
