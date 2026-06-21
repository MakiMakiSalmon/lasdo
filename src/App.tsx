import { useEffect, useState } from 'react';
import './App.css';
import { useBlockStore } from './store/blockStore';

/**
 * 雛形段階のプレースホルダ画面。
 * State 層の配線確認のため、保存済み区間数だけ表示する（UI は Repository を
 * 直接叩かず BlockStore 越しに触る）。
 * 本来の記録画面（円形タイマー＋今日のタイムライン）は後続 PR で実装する。
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
      <p className="status">
        {loaded ? `保存済みの記録区間: ${blocks.length} 件` : '読み込み中…'}
      </p>
      <p className="note">※ 雛形。記録画面（タイマー）は後続で実装します。</p>
    </main>
  );
}

export default App;
