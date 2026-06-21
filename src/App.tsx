import { useEffect, useState } from 'react';
import './App.css';
import { useBlockStore } from './store/blockStore';
import { TodayTimeline } from './ui/TodayTimeline';

/**
 * 記録画面の組み立て途中（detailed-design 6）。
 * 現状は今日のタイムラインのみ。円形タイマーは後続 PR で中央に据える。
 * UI は Repository を直接叩かず BlockStore 越しにデータへ触る。
 */
function App() {
  const blocks = useBlockStore((s) => s.blocks);
  const load = useBlockStore((s) => s.load);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    load().then(() => setLoaded(true));
  }, [load]);

  return (
    <main className="app">
      <h1>lasdo</h1>
      <p>実績を記録し、活動リズムを可視化するツール。</p>
      {loaded ? (
        <TodayTimeline blocks={blocks} />
      ) : (
        <p className="status">読み込み中…</p>
      )}
      <p className="note">※ 円形タイマーは後続 PR で実装します。</p>
    </main>
  );
}

export default App;
