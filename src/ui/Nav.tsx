import { useViewStore, type View } from '../store/viewStore';
import styles from './Nav.module.css';

/** 画面ナビ。view 状態で出し分ける（detailed-design 5.3）。 */
const ITEMS: ReadonlyArray<{ view: View; label: string }> = [
  { view: 'record', label: '記録' },
  { view: 'analysis', label: '分析' },
];

export function Nav() {
  const view = useViewStore((s) => s.view);
  const go = useViewStore((s) => s.go);

  return (
    <nav className={styles.nav}>
      {ITEMS.map((item) => (
        <button
          key={item.view}
          type="button"
          className={`${styles.item} ${view === item.view ? styles.active : ''}`}
          onClick={() => go(item.view)}
          aria-current={view === item.view ? 'page' : undefined}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
