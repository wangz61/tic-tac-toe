import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { chooseMove, evaluateMoves } from '../engine/ai';
import type { GameRecord } from '../engine/types';
import { Board } from '../components/Board';
import { Dialog, Kbd, ScoreBoard, Timeline, Toggle, TopBar, toneOf } from '../components/ui';
import { placeSound, useSound } from '../hooks/useSound';
import { useStore } from '../state/AppStore';
import { canRedo, canUndo, derive, gameReducer, initGame, type GameConfig } from '../state/game';
import { DIFFICULTY_LABEL } from '../utils/format';
import { ReplayView } from './Replay';

/** Number keys follow the numeric keypad: 7 8 9 is the top row. */
const keyToCell = (n: number) => (n >= 7 ? n - 7 : n >= 4 ? n - 1 : n + 5);

export function Game({ config, onMenu }: { config: GameConfig; onMenu: () => void }) {
  const { settings, updateSettings, addRecord } = useStore();
  const play = useSound();
  const [state, dispatch] = useReducer(gameReducer, config, (c) => initGame(c, Date.now()));
  const d = derive(state);
  const [showResult, setShowResult] = useState(false);
  const [replay, setReplay] = useState<GameRecord | null>(null);
  const reduced = settings.motion === 'reduced';
  const human = config.mode === 'pve' ? config.human : undefined;
  const { names } = config;
  const roundId = `${state.startedAt}-${state.round}`;
  const result = d.outcome?.result;

  const record = useMemo<GameRecord | null>(() => {
    if (!d.outcome) return null;
    return {
      id: roundId,
      mode: config.mode,
      difficulty: human ? config.difficulty : undefined,
      human,
      players: names,
      firstPlayer: state.first,
      moves: state.moves,
      result: d.outcome.result,
      winLine: d.outcome.line,
      startedAt: state.startedAt,
      endedAt: state.moves[state.moves.length - 1]?.at ?? state.startedAt,
    };
    // The round's moves only change while the round is unfinished.
  }, [roundId, result]);

  // Computer move.
  useEffect(() => {
    if (!d.aiTurn) return;
    const delay = reduced ? 220 : 380 + Math.random() * 340;
    const t = setTimeout(() => {
      dispatch({ type: 'move', index: chooseMove(d.board, d.turn, config.difficulty), at: Date.now() });
    }, delay);
    return () => clearTimeout(t);
  }, [state]);

  // Placement sound for every new piece.
  const prevCount = useRef(0);
  useEffect(() => {
    const n = state.moves.length;
    if (n > prevCount.current) play(placeSound(state.moves[n - 1].player));
    prevCount.current = n;
  }, [state.moves, play]);

  // Round finished: save it, play the result sound, then show the dialog.
  useEffect(() => {
    if (!record) {
      setShowResult(false);
      return;
    }
    addRecord(record);
    const sound = record.result === 'draw' ? 'draw' : human && record.result !== human ? 'lose' : 'win';
    const s = setTimeout(() => play(sound), 160);
    const t = setTimeout(() => setShowResult(true), reduced ? 300 : 1000);
    return () => {
      clearTimeout(s);
      clearTimeout(t);
    };
  }, [record]);

  const hints = useMemo(() => {
    if (!settings.hints || d.outcome || d.aiTurn) return undefined;
    return new Map(evaluateMoves(d.board, d.turn).map((e) => [e.index, e]));
  }, [settings.hints, state.moves, state.first]);

  const now = () => Date.now();
  const humanMove = (index: number) => {
    if (!d.outcome && !d.aiTurn) dispatch({ type: 'move', index, at: now() });
  };
  const matchOver = d.seriesWinner !== null;
  const continueMatch = () => dispatch(matchOver ? { type: 'newSeries', at: now() } : { type: 'nextRound', at: now() });

  // Keyboard shortcuts.
  const keyState = useRef({ d, humanMove, continueMatch, replay, hints: settings.hints });
  keyState.current = { d, humanMove, continueMatch, replay, hints: settings.hints };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keyState.current;
      if (e.ctrlKey || e.metaKey || e.altKey || k.replay) return;
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      const key = e.key.toLowerCase();
      if (/^[1-9]$/.test(key)) k.humanMove(keyToCell(Number(key)));
      else if (key === 'u') dispatch({ type: 'undo' });
      else if (key === 'y') dispatch({ type: 'redo' });
      else if (key === 'r') dispatch({ type: 'restart', at: Date.now() });
      else if (key === 'h') updateSettings({ hints: !k.hints });
      else if (key === 'n' && k.d.outcome) k.continueMatch();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [updateSettings]);

  if (replay) {
    return <ReplayView record={replay} onBack={() => setReplay(null)} backLabel="Game" />;
  }

  const roundTitle = () => {
    if (result === 'draw') return "It's a draw";
    if (!result) return '';
    if (human) return result === human ? 'You win!' : `${names[result]} wins`;
    return `${names[result]} wins!`;
  };

  const matchTitle = () => {
    const w = d.seriesWinner;
    if (!w || config.bestOf === 1) return roundTitle();
    if (w === 'tie') return 'Match tied';
    if (human) return w === human ? 'You win the match!' : `${names[w]} takes the match`;
    return `${names[w]} wins the match!`;
  };

  const subtitle = () => {
    if (config.bestOf !== 1) {
      return (
        <>
          {names.X} <strong>{state.score.X}</strong> – <strong>{state.score.O}</strong> {names.O}
          {state.score.draw > 0 && <span className="muted"> · {state.score.draw} drawn</span>}
        </>
      );
    }
    if (result === 'draw' && config.mode === 'pve' && config.difficulty === 'master') return 'Nobody beats Master. A draw is the best result.';
    return `Finished in ${state.moves.length} moves.`;
  };

  const status = d.outcome
    ? roundTitle()
    : d.aiTurn
      ? `${names[d.turn]} is thinking…`
      : human
        ? 'Your move'
        : `${names[d.turn]} to move`;

  const roundLabel =
    config.bestOf === 1 ? null : `Round ${state.round}${config.bestOf ? ` · Best of ${config.bestOf}` : ''}`;
  const lastIndex = state.moves[state.moves.length - 1]?.index;

  return (
    <main className="game">
      <TopBar
        title={config.mode === 'pve' ? `vs Computer · ${DIFFICULTY_LABEL[config.difficulty]}` : 'Two Players'}
        onBack={onMenu}
        right={roundLabel && <span className="chip">{roundLabel}</span>}
      />

      <div className="game__layout">
        <section className="game__main">
          <ScoreBoard names={names} score={state.score} turn={d.turn} thinking={d.aiTurn} over={!!d.outcome} />

          <Board
            board={d.board}
            interactive={!d.outcome && !d.aiTurn}
            ghost={d.turn}
            onCell={humanMove}
            winLine={d.outcome?.line}
            winner={result === 'draw' ? undefined : result}
            isDraw={result === 'draw'}
            hints={hints}
            lastIndex={lastIndex}
          />

          <p className="game__status" aria-live="polite">
            {status}
          </p>

          <div className="controls">
            {d.outcome ? (
              <>
                <button type="button" className="btn btn--primary" onClick={continueMatch}>
                  {matchOver ? 'Play again' : 'Next round'}
                </button>
                <button type="button" className="btn btn--soft" onClick={() => record && setReplay(record)}>
                  Replay
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn--soft" disabled={!canUndo(state)} onClick={() => dispatch({ type: 'undo' })}>
                  Undo
                </button>
                <button type="button" className="btn btn--soft" disabled={!canRedo(state)} onClick={() => dispatch({ type: 'redo' })}>
                  Redo
                </button>
                <button
                  type="button"
                  className="btn btn--soft"
                  disabled={!state.moves.length}
                  onClick={() => dispatch({ type: 'restart', at: now() })}
                >
                  Restart
                </button>
              </>
            )}
          </div>
        </section>

        <aside className="game__side card">
          <h2 className="side__title">Moves</h2>
          <Timeline moves={state.moves} />
          <div className="side__divider" />
          <Toggle
            label="Show hints"
            hint="Colours each empty cell by its outcome with perfect play from here."
            checked={settings.hints}
            onChange={(v) => updateSettings({ hints: v })}
          />
          {settings.hints && (
            <ul className="hint-legend">
              <li><span className="hint-dot hint-dot--win" />Win</li>
              <li><span className="hint-dot hint-dot--draw" />Draw</li>
              <li><span className="hint-dot hint-dot--loss" />Loss</li>
            </ul>
          )}
          <div className="side__divider" />
          <dl className="shortcuts">
            <div><dt><Kbd>1</Kbd>–<Kbd>9</Kbd></dt><dd>Place (keypad layout)</dd></div>
            <div><dt><Kbd>U</Kbd> <Kbd>Y</Kbd></dt><dd>Undo / redo</dd></div>
            <div><dt><Kbd>R</Kbd></dt><dd>Restart round</dd></div>
            <div><dt><Kbd>H</Kbd></dt><dd>Toggle hints</dd></div>
            <div><dt><Kbd>N</Kbd></dt><dd>Next round</dd></div>
          </dl>
        </aside>
      </div>

      {showResult && result && (
        <Dialog tone={toneOf(result, human)} title={matchTitle()} subtitle={subtitle()}>
          <button type="button" className="btn btn--primary" onClick={continueMatch}>
            {matchOver ? 'Play again' : 'Next round'}
          </button>
          <button type="button" className="btn btn--soft" onClick={() => record && setReplay(record)}>
            Replay
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setShowResult(false)}>
            View board
          </button>
          <button type="button" className="btn btn--ghost" onClick={onMenu}>
            Menu
          </button>
        </Dialog>
      )}
    </main>
  );
}
