import { boardFromMoves, getOutcome, other, turnOf } from '../engine/board';
import type { Cell, Difficulty, Line, Mode, Move, Player, Result } from '../engine/types';

export type FirstRule = Player | 'random';
export type NextFirstRule = 'alternate' | 'loser' | 'same';
export type BestOf = 1 | 3 | 5 | 0; // 0 = endless

export interface GameConfig {
  mode: Mode;
  difficulty: Difficulty;
  names: { X: string; O: string };
  /** The human's piece in PvE. */
  human: Player;
  first: FirstRule;
  nextFirst: NextFirstRule;
  bestOf: BestOf;
}

export interface Score {
  X: number;
  O: number;
  draw: number;
}

export interface GameState {
  config: GameConfig;
  first: Player;
  moves: Move[];
  /** Groups of moves removed by undo, most recent last. */
  redo: Move[][];
  score: Score;
  round: number;
  startedAt: number;
}

export type GameAction =
  | { type: 'move'; index: number; at: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'restart'; at: number }
  | { type: 'nextRound'; at: number }
  | { type: 'newSeries'; at: number; rng?: () => number };

const resolveFirst = (rule: FirstRule, rng: () => number = Math.random): Player =>
  rule === 'random' ? (rng() < 0.5 ? 'X' : 'O') : rule;

export function initGame(config: GameConfig, at: number, rng?: () => number): GameState {
  return {
    config,
    first: resolveFirst(config.first, rng),
    moves: [],
    redo: [],
    score: { X: 0, O: 0, draw: 0 },
    round: 1,
    startedAt: at,
  };
}

export interface Derived {
  board: Cell[];
  turn: Player;
  outcome: { result: Result; line?: Line } | null;
  /** True when it's the computer's move in PvE. */
  aiTurn: boolean;
  seriesWinner: Player | 'tie' | null;
}

export function seriesWinner(score: Score, bestOf: BestOf): Player | 'tie' | null {
  if (bestOf === 0) return null;
  const need = Math.ceil(bestOf / 2);
  if (score.X >= need) return 'X';
  if (score.O >= need) return 'O';
  // Draws can exhaust the scheduled rounds before anyone reaches the target.
  if (score.X + score.O + score.draw >= bestOf) {
    return score.X === score.O ? 'tie' : score.X > score.O ? 'X' : 'O';
  }
  return null;
}

export function derive(state: GameState): Derived {
  const board = boardFromMoves(state.moves);
  const outcome = getOutcome(board);
  const turn = turnOf(board, state.first);
  return {
    board,
    turn,
    outcome,
    aiTurn: state.config.mode === 'pve' && !outcome && turn !== state.config.human,
    seriesWinner: outcome ? seriesWinner(state.score, state.config.bestOf) : null,
  };
}

/** In PvE an undo rewinds to the human's previous move, taking the AI reply with it. */
function undoGroupSize(state: GameState): number {
  if (state.config.mode === 'pvp') return state.moves.length ? 1 : 0;
  const human = state.config.human;
  for (let i = state.moves.length - 1; i >= 0; i--) {
    if (state.moves[i].player === human) return state.moves.length - i;
  }
  return 0;
}

export const canUndo = (state: GameState) => !derive(state).outcome && undoGroupSize(state) > 0;
export const canRedo = (state: GameState) => !derive(state).outcome && state.redo.length > 0;

function nextFirst(state: GameState, result: Result): Player {
  switch (state.config.nextFirst) {
    case 'same':
      return state.first;
    case 'loser':
      return result === 'draw' ? other(state.first) : other(result);
    case 'alternate':
      return other(state.first);
  }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  const { board, outcome, turn } = derive(state);

  switch (action.type) {
    case 'move': {
      if (outcome || board[action.index] !== null) return state;
      const moves = [...state.moves, { index: action.index, player: turn, at: action.at }];
      const after = getOutcome(boardFromMoves(moves));
      const score = after
        ? { ...state.score, [after.result]: state.score[after.result] + 1 }
        : state.score;
      return { ...state, moves, redo: [], score };
    }

    case 'undo': {
      const n = outcome ? 0 : undoGroupSize(state);
      if (!n) return state;
      const cut = state.moves.length - n;
      return { ...state, moves: state.moves.slice(0, cut), redo: [...state.redo, state.moves.slice(cut)] };
    }

    case 'redo': {
      if (outcome || !state.redo.length) return state;
      const group = state.redo[state.redo.length - 1];
      return { ...state, moves: [...state.moves, ...group], redo: state.redo.slice(0, -1) };
    }

    case 'restart':
      // Restarting an unfinished round doesn't touch the score.
      if (outcome) return state;
      return { ...state, moves: [], redo: [], startedAt: action.at };

    case 'nextRound': {
      if (!outcome) return state;
      if (seriesWinner(state.score, state.config.bestOf)) return state;
      return {
        ...state,
        first: nextFirst(state, outcome.result),
        moves: [],
        redo: [],
        round: state.round + 1,
        startedAt: action.at,
      };
    }

    case 'newSeries':
      return initGame(state.config, action.at, action.rng);
  }
}
