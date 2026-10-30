import { useRef, useState, type KeyboardEvent } from 'react';
import type { MoveEvaluation } from '../engine/ai';
import { cellPosition } from '../engine/board';
import type { Cell, Line, Player } from '../engine/types';
import { useStore } from '../state/AppStore';
import { cx } from '../utils/format';
import { Piece } from './Piece';

interface Props {
  board: Cell[];
  onCell?: (index: number) => void;
  /** Whether empty cells accept clicks right now. */
  interactive: boolean;
  /** Piece shown as a hover preview on empty cells. */
  ghost?: Player | null;
  winLine?: Line;
  winner?: Player;
  isDraw?: boolean;
  hints?: Map<number, MoveEvaluation>;
  lastIndex?: number;
}

const VERDICT_LABEL = { win: 'Win', draw: 'Draw', loss: 'Loss' } as const;

export function Board({ board, onCell, interactive, ghost, winLine, winner, isDraw, hints, lastIndex }: Props) {
  const { settings } = useStore();
  const [focus, setFocus] = useState(4);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const moveFocus = (e: KeyboardEvent, i: number) => {
    const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
    const d = delta[e.key];
    if (d === undefined) return;
    e.preventDefault();
    let next = i + d;
    // Wrap within the row for left/right, within the column for up/down.
    if (Math.abs(d) === 1 && Math.floor(next / 3) !== Math.floor(i / 3)) next = i - d * 2;
    if (next < 0) next += 9;
    if (next > 8) next -= 9;
    setFocus(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      className={cx('board', `board--${settings.pieceStyle}`, isDraw && 'board--draw', winLine && 'board--won')}
      role="grid"
      aria-label="Game board"
    >
      <svg className="board__grid" viewBox="0 0 300 300" aria-hidden="true">
        <line x1="100" y1="10" x2="100" y2="290" pathLength={1} />
        <line x1="200" y1="10" x2="200" y2="290" pathLength={1} />
        <line x1="10" y1="100" x2="290" y2="100" pathLength={1} />
        <line x1="10" y1="200" x2="290" y2="200" pathLength={1} />
      </svg>

      <div className="board__cells">
        {board.map((cell, i) => {
          const { row, col } = cellPosition(i);
          const hint = cell === null ? hints?.get(i) : undefined;
          const playable = interactive && cell === null;
          return (
            <button
              key={i}
              ref={(el) => (refs.current[i] = el)}
              type="button"
              role="gridcell"
              className={cx(
                'cell',
                playable && 'cell--playable',
                winLine?.includes(i) && 'cell--win',
                winLine && !winLine.includes(i) && 'cell--dim',
                lastIndex === i && 'cell--last',
                hint && `cell--hint-${hint.verdict}`,
              )}
              tabIndex={i === focus ? 0 : -1}
              aria-label={`Row ${row}, column ${col}, ${cell ?? 'empty'}${hint ? `, hint: ${VERDICT_LABEL[hint.verdict]}` : ''}`}
              aria-disabled={!playable}
              onFocus={() => setFocus(i)}
              onKeyDown={(e) => moveFocus(e, i)}
              onClick={() => playable && onCell?.(i)}
            >
              {cell ? (
                <Piece key={cell} player={cell} />
              ) : (
                playable && ghost && <Piece player={ghost} ghost animate={false} />
              )}
              {hint && <span className="cell__hint">{VERDICT_LABEL[hint.verdict]}</span>}
            </button>
          );
        })}
      </div>

      {winLine && <WinLine line={winLine} winner={winner} />}
    </div>
  );
}

function WinLine({ line, winner }: { line: Line; winner?: Player }) {
  const at = (i: number) => ({ x: (i % 3) * 100 + 50, y: Math.floor(i / 3) * 100 + 50 });
  const a = at(line[0]);
  const c = at(line[2]);
  const len = Math.hypot(c.x - a.x, c.y - a.y);
  const ext = 34;
  const ux = (c.x - a.x) / len;
  const uy = (c.y - a.y) / len;
  return (
    <svg className="board__winline" viewBox="0 0 300 300" aria-hidden="true">
      <line
        className={cx('winline', winner && `winline--${winner.toLowerCase()}`)}
        x1={a.x - ux * ext}
        y1={a.y - uy * ext}
        x2={c.x + ux * ext}
        y2={c.y + uy * ext}
        pathLength={1}
      />
    </svg>
  );
}
