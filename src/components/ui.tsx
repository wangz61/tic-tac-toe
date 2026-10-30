import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Move, Player, Result } from '../engine/types';
import type { Score } from '../state/game';
import { cellName, cx } from '../utils/format';
import { Piece } from './Piece';

export interface Option<T> {
  value: T;
  label: ReactNode;
  hint?: string;
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const active = options.find((o) => o.value === value);
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={cx('segmented__opt', o.value === value && 'is-active')}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {active?.hint && <span className="field__hint">{active.hint}</span>}
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="toggle">
      <span className="toggle__text">
        <span>{label}</span>
        {hint && <span className="field__hint">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" aria-hidden="true" />
    </label>
  );
}

export function TopBar({
  title,
  onBack,
  backLabel = 'Menu',
  right,
}: {
  title: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
}) {
  return (
    <header className="topbar">
      {onBack ? (
        <button type="button" className="btn btn--ghost topbar__back" onClick={onBack}>
          <span aria-hidden="true">←</span> {backLabel}
        </button>
      ) : (
        <span />
      )}
      <h1 className="topbar__title">{title}</h1>
      <div className="topbar__right">{right}</div>
    </header>
  );
}

export function ScoreBoard({
  names,
  score,
  turn,
  thinking,
  over,
  statusFor,
}: {
  names: { X: string; O: string };
  score: Score;
  turn: Player;
  thinking: boolean;
  over: boolean;
  /** Replaces the default "Your move" line under each name. */
  statusFor?: (p: Player) => ReactNode;
}) {
  const card = (p: Player) => (
    <div className={cx('player', `player--${p.toLowerCase()}`, !over && turn === p && 'is-turn')}>
      <Piece player={p} animate={false} className="player__piece" />
      <div className="player__info">
        <span className="player__name">{names[p]}</span>
        <span className="player__status">
          {statusFor ? statusFor(p) : !over && turn === p ? (thinking ? <Thinking /> : 'Your move') : ' '}
        </span>
      </div>
      <span className="player__score">{score[p]}</span>
    </div>
  );
  return (
    <div className="scoreboard">
      {card('X')}
      <div className="scoreboard__draws">
        <span className="scoreboard__draws-n">{score.draw}</span>
        <span>Draws</span>
      </div>
      {card('O')}
    </div>
  );
}

function Thinking() {
  return (
    <span className="thinking">
      Thinking<span className="thinking__dots" aria-hidden="true"><i /><i /><i /></span>
    </span>
  );
}

export function Timeline({ moves, step, onSelect }: { moves: Move[]; step?: number; onSelect?: (step: number) => void }) {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [moves.length]);

  if (!moves.length) return <p className="timeline__empty">No moves yet.</p>;
  return (
    <ol className="timeline" ref={listRef}>
      {moves.map((m, i) => {
        const content = (
          <>
            <span className="timeline__n">{i + 1}</span>
            <Piece player={m.player} animate={false} className="timeline__piece" />
            <span className="timeline__cell">{cellName(m.index)}</span>
          </>
        );
        return (
          <li key={i} className={cx('timeline__item', step !== undefined && i < step && 'is-played', step === i + 1 && 'is-current')}>
            {onSelect ? (
              <button type="button" className="timeline__btn" onClick={() => onSelect(i + 1)}>
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}

export type Tone = 'win' | 'loss' | 'draw' | 'x' | 'o';

export const toneOf = (result: Result, human?: Player): Tone =>
  result === 'draw' ? 'draw' : human ? (result === human ? 'win' : 'loss') : result === 'X' ? 'x' : 'o';

export function Dialog({ tone, title, subtitle, children }: { tone: Tone; title: string; subtitle?: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, []);
  // Portalled so no transformed ancestor can confine the fixed overlay.
  return createPortal(
    <div className="overlay">
      <div ref={ref} className={cx('dialog', `dialog--${tone}`)} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog__badge" aria-hidden="true" />
        <h2 id="dialog-title" className="dialog__title">{title}</h2>
        {subtitle && <p className="dialog__subtitle">{subtitle}</p>}
        <div className="dialog__actions">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
