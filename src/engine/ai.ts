import { availableMoves, applyMove, findWin, other } from './board';
import type { Board, Difficulty, Player } from './types';

/**
 * Exact game value for the player about to move: positive = forced win,
 * negative = forced loss, 0 = draw. Faster wins (and slower losses) score
 * higher in magnitude, so the AI finishes quickly and resists longest.
 */
const memo = new Map<string, number>();

function valueFor(board: Board, toMove: Player): number {
  const key = board.map((c) => c ?? '-').join('') + toMove;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;

  let value: number;
  const filled = board.filter((c) => c !== null).length;
  if (findWin(board)) {
    // The previous mover just won.
    value = -(100 - filled);
  } else if (filled === board.length) {
    value = 0;
  } else {
    value = -Infinity;
    for (const i of availableMoves(board)) {
      value = Math.max(value, -valueFor(applyMove(board, i, toMove), other(toMove)));
    }
  }
  memo.set(key, value);
  return value;
}

export type Verdict = 'win' | 'draw' | 'loss';

export interface MoveEvaluation {
  index: number;
  score: number;
  verdict: Verdict;
}

/** Evaluates every legal move for `player`. Used by the AI and the hint heatmap. */
export function evaluateMoves(board: Board, player: Player): MoveEvaluation[] {
  return availableMoves(board).map((index) => {
    const score = -valueFor(applyMove(board, index, player), other(player));
    const verdict: Verdict = score > 0 ? 'win' : score < 0 ? 'loss' : 'draw';
    return { index, score, verdict };
  });
}

type Rng = () => number;

const pick = <T,>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)];

function bestMoves(board: Board, player: Player): number[] {
  const evals = evaluateMoves(board, player);
  const top = Math.max(...evals.map((e) => e.score));
  return evals.filter((e) => e.score === top).map((e) => e.index);
}

/** A move that completes three-in-a-row for `player`, if any. */
function immediateWin(board: Board, player: Player): number | undefined {
  return availableMoves(board).find((i) => findWin(applyMove(board, i, player))?.winner === player);
}

export const HARD_ACCURACY = 0.7;

export function chooseMove(board: Board, player: Player, difficulty: Difficulty, rng: Rng = Math.random): number {
  const moves = availableMoves(board);
  if (moves.length === 0) throw new Error('No moves available');

  switch (difficulty) {
    case 'easy':
      return pick(moves, rng);

    case 'normal': {
      const win = immediateWin(board, player);
      if (win !== undefined) return win;
      const block = immediateWin(board, other(player));
      if (block !== undefined) return block;
      return pick(moves, rng);
    }

    case 'hard': {
      const win = immediateWin(board, player);
      if (win !== undefined) return win;
      const best = bestMoves(board, player);
      if (rng() < HARD_ACCURACY) return pick(best, rng);
      const rest = moves.filter((m) => !best.includes(m));
      return pick(rest.length ? rest : best, rng);
    }

    case 'master':
      return pick(bestMoves(board, player), rng);
  }
}

export { bestMoves };
