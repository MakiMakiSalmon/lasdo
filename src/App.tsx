import { useEffect, useState } from 'react';
import './App.css';
import { timeBlockRepository } from './data/repository';
import type { TimeBlock } from './domain/timeBlock';

/**
 * 雛形段階のプレースホルダ画面。
 * Repository 配線の疎通確認のため、保存済み区間数だけ表示する。
 * 本来の記録画面（円形タイマー＋今日のタイムライン）は後続 PR で実装する。
 */
function App() {
  const [blocks, setBlocks] = useState<TimeBlock[] | null>(null);

  useEffect(() => {
    timeBlockRepository.list().then(setBlocks);
  }, []);

  return (
    <main className="app">
      <h1>lasdo</h1>
      <p>実績を記録し、活動リズムを可視化するツール。</p>
      <p className="status">
        {blocks === null
          ? '読み込み中…'
          : `保存済みの記録区間: ${blocks.length} 件`}
      </p>
      <p className="note">※ 雛形。記録画面（タイマー）は後続で実装します。</p>
    </main>
  );
}

export default App;
