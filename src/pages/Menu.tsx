import type { Mode } from '../engine/types';
import { Piece } from '../components/Piece';
import { useStore } from '../state/AppStore';

const LOGO: ('X' | 'O' | null)[] = ['X', null, 'O', null, 'X', null, 'O', null, 'X'];

export function Menu({
  onPlay,
  onOnline,
  onStats,
  onSettings,
}: {
  onPlay: (m: Mode) => void;
  onOnline: () => void;
  onStats: () => void;
  onSettings: () => void;
}) {
  const { records } = useStore();
  return (
    <main className="menu">
      <div className="logo" aria-hidden="true">
        {LOGO.map((p, i) => (
          <span key={i} className="logo__cell" style={{ animationDelay: `${i * 70}ms` }}>
            {p && <Piece player={p} />}
          </span>
        ))}
      </div>
      <h1 className="menu__title">Tic-Tac-Toe</h1>
      <p className="menu__subtitle">Three in a row. Simple to learn, impossible to beat on Master.</p>

      <nav className="menu__actions" aria-label="Main menu">
        <button type="button" className="menu-card menu-card--primary" onClick={() => onPlay('pve')}>
          <span className="menu-card__title">vs Computer</span>
          <span className="menu-card__desc">Four difficulty levels, from Easy to Master</span>
        </button>
        <button type="button" className="menu-card" onClick={() => onPlay('pvp')}>
          <span className="menu-card__title">Two Players</span>
          <span className="menu-card__desc">Take turns on the same device</span>
        </button>
        <button type="button" className="menu-card" onClick={onOnline}>
          <span className="menu-card__title">Play Online</span>
          <span className="menu-card__desc">Create a room and invite a friend on another device</span>
        </button>
        <div className="menu__row">
          <button type="button" className="btn btn--soft" onClick={onStats}>
            Statistics{records.length > 0 && <span className="badge">{records.length}</span>}
          </button>
          <button type="button" className="btn btn--soft" onClick={onSettings}>
            Settings
          </button>
        </div>
      </nav>
      <p className="menu__foot">Computer and two-player modes run offline · Progress is saved on this device</p>
    </main>
  );
}
