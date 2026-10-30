import { useState } from 'react';
import { other } from '../engine/board';
import type { Difficulty, Mode, Player } from '../engine/types';
import { Piece } from '../components/Piece';
import { Segmented, TopBar, type Option } from '../components/ui';
import { useStore } from '../state/AppStore';
import type { BestOf, FirstRule, GameConfig, NextFirstRule } from '../state/game';
import { botName } from '../utils/format';

const DIFFICULTY_OPTIONS: Option<Difficulty>[] = [
  { value: 'easy', label: 'Easy', hint: 'Plays random moves.' },
  { value: 'normal', label: 'Normal', hint: 'Takes wins and blocks your threats, otherwise random.' },
  { value: 'hard', label: 'Hard', hint: 'Plays the best move most of the time, but slips occasionally.' },
  { value: 'master', label: 'Master', hint: 'Perfect play. The best you can do is a draw.' },
];

const NEXT_FIRST_OPTIONS: Option<NextFirstRule>[] = [
  { value: 'alternate', label: 'Alternate' },
  { value: 'loser', label: 'Loser starts' },
  { value: 'same', label: 'Same' },
];

const BEST_OF_OPTIONS: Option<BestOf>[] = [
  { value: 1, label: 'Single' },
  { value: 3, label: 'Best of 3' },
  { value: 5, label: 'Best of 5' },
  { value: 0, label: 'Endless' },
];

const pieceOpt = (p: Player, text?: string): Option<Player> => ({
  value: p,
  label: (
    <span className="opt-piece">
      <Piece player={p} animate={false} />
      {text}
    </span>
  ),
});

export function Setup({ mode, onBack, onStart }: { mode: Mode; onBack: () => void; onStart: (c: GameConfig) => void }) {
  const { lastConfig, saveConfig } = useStore();
  const [cfg, setCfg] = useState<GameConfig>({ ...lastConfig, mode });
  const [yourName, setYourName] = useState(lastConfig.mode === 'pve' ? lastConfig.names[lastConfig.human] : 'You');
  const [pvpNames, setPvpNames] = useState(lastConfig.mode === 'pvp' ? lastConfig.names : { X: 'Player X', O: 'Player O' });
  const set = <K extends keyof GameConfig>(k: K, v: GameConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const start = () => {
    const clean = (s: string, fallback: string) => s.trim().slice(0, 16) || fallback;
    const names =
      mode === 'pvp'
        ? { X: clean(pvpNames.X, 'Player X'), O: clean(pvpNames.O, 'Player O') }
        : ({ [cfg.human]: clean(yourName, 'You'), [other(cfg.human)]: botName(cfg.difficulty) } as GameConfig['names']);
    const config = { ...cfg, mode, names };
    saveConfig(config);
    onStart(config);
  };

  const firstOptions: Option<FirstRule>[] =
    mode === 'pve'
      ? [
          { value: cfg.human, label: 'You' },
          { value: other(cfg.human), label: 'Computer' },
          { value: 'random', label: 'Random' },
        ]
      : [pieceOpt('X', 'X'), pieceOpt('O', 'O'), { value: 'random', label: 'Random' }];

  return (
    <main className="page-narrow">
      <TopBar title={mode === 'pve' ? 'vs Computer' : 'Two Players'} onBack={onBack} />
      <form
        className="card setup"
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
      >
        {mode === 'pve' ? (
          <>
            <div className="field">
              <label className="field__label" htmlFor="name">Your name</label>
              <input id="name" className="input" value={yourName} maxLength={16} onChange={(e) => setYourName(e.target.value)} />
            </div>
            <Segmented
              label="Play as"
              options={[pieceOpt('X', 'X'), pieceOpt('O', 'O')]}
              value={cfg.human}
              onChange={(h) => setCfg((c) => ({ ...c, human: h, first: c.first === 'random' ? 'random' : c.first === c.human ? h : other(h) }))}
            />
            <Segmented label="Difficulty" options={DIFFICULTY_OPTIONS} value={cfg.difficulty} onChange={(v) => set('difficulty', v)} />
          </>
        ) : (
          <div className="field-row">
            {(['X', 'O'] as Player[]).map((p) => (
              <div className="field" key={p}>
                <label className="field__label" htmlFor={`name-${p}`}>
                  <Piece player={p} animate={false} className="field__piece" /> Player {p}
                </label>
                <input
                  id={`name-${p}`}
                  className="input"
                  value={pvpNames[p]}
                  maxLength={16}
                  onChange={(e) => setPvpNames((n) => ({ ...n, [p]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}

        <Segmented label="First move" options={firstOptions} value={cfg.first} onChange={(v) => set('first', v)} />
        <Segmented label="Match" options={BEST_OF_OPTIONS} value={cfg.bestOf} onChange={(v) => set('bestOf', v)} />
        {cfg.bestOf !== 1 && (
          <Segmented label="Next round starts" options={NEXT_FIRST_OPTIONS} value={cfg.nextFirst} onChange={(v) => set('nextFirst', v)} />
        )}

        <button type="submit" className="btn btn--primary btn--lg">
          Start game
        </button>
      </form>
    </main>
  );
}
