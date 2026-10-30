import { useEffect, useState } from 'react';
import { boardFromMoves } from '../engine/board';
import type { GameRecord } from '../engine/types';
import { Board } from '../components/Board';
import { Timeline, TopBar } from '../components/ui';
import { DIFFICULTY_LABEL } from '../utils/format';

function Icon({ d }: { d: string }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function ReplayView({ record, onBack, backLabel }: { record: GameRecord; onBack: () => void; backLabel: string }) {
  const total = record.moves.length;
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const atEnd = step >= total;

  useEffect(() => {
    if (!playing) return;
    if (atEnd) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 400 : 750);
    return () => clearTimeout(t);
  }, [playing, step, atEnd]);

  const go = (s: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(total, s)));
  };
  const togglePlay = () => {
    if (atEnd) setStep(0);
    setPlaying((p) => !p || atEnd);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const keys: Record<string, () => void> = {
        ArrowLeft: () => go(step - 1),
        ArrowRight: () => go(step + 1),
        Home: () => go(0),
        End: () => go(total),
        ' ': togglePlay,
      };
      if ((e.target as HTMLElement).closest('input, button') && e.key === ' ') return;
      const fn = keys[e.key];
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const moves = record.moves.slice(0, step);
  const r = record.result;
  const resultText = r === 'draw' ? 'Draw' : `${record.players[r]} won`;
  const vs = record.mode === 'pve' && record.difficulty ? ` · ${DIFFICULTY_LABEL[record.difficulty]}` : '';

  return (
    <main className="game">
      <TopBar title="Replay" onBack={onBack} backLabel={backLabel} />
      <p className="replay__meta">
        {record.players.X} <span className="muted">vs</span> {record.players.O}
        {vs} · {resultText} ·{' '}
        <span className="muted">{new Date(record.endedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
      </p>

      <div className="game__layout">
        <section className="game__main">
          <Board
            board={boardFromMoves(moves)}
            interactive={false}
            winLine={atEnd ? record.winLine : undefined}
            winner={atEnd && r !== 'draw' ? r : undefined}
            isDraw={atEnd && r === 'draw'}
            lastIndex={moves[moves.length - 1]?.index}
          />

          <div className="replay__controls">
            <div className="controls">
              <button type="button" className="btn btn--soft btn--icon" onClick={() => go(0)} disabled={step === 0} aria-label="First move">
                <Icon d="M7 6v12M17 6l-6 6 6 6" />
              </button>
              <button type="button" className="btn btn--soft btn--icon" onClick={() => go(step - 1)} disabled={step === 0} aria-label="Previous move">
                <Icon d="M15 6l-6 6 6 6" />
              </button>
              <button type="button" className="btn btn--primary btn--play" onClick={togglePlay}>
                {playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
              </button>
              <button type="button" className="btn btn--soft btn--icon" onClick={() => go(step + 1)} disabled={atEnd} aria-label="Next move">
                <Icon d="M9 6l6 6-6 6" />
              </button>
              <button type="button" className="btn btn--soft btn--icon" onClick={() => go(total)} disabled={atEnd} aria-label="Last move">
                <Icon d="M17 6v12M7 6l6 6-6 6" />
              </button>
            </div>
            <input
              type="range"
              className="range"
              min={0}
              max={total}
              value={step}
              onChange={(e) => go(Number(e.target.value))}
              aria-label="Move"
            />
            <span className="muted replay__step">
              Move {step} of {total}
            </span>
          </div>
        </section>

        <aside className="game__side card">
          <h2 className="side__title">Moves</h2>
          <Timeline moves={record.moves} step={step} onSelect={go} />
        </aside>
      </div>
    </main>
  );
}
