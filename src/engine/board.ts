import type { Board, Cell, Line, Move, Player, Result } from './types';

export const SIZE = 3;
export const CELLS = SIZE * SIZE;

export const WIN_LINES: readonly Line[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export const emptyBoard = (): Cell[] => Array<Cell>(CELLS).fill(null);

export const other = (p: Player): Player => (p === 'X' ? 'O' : 'X');

export function boardFromMoves(moves: readonly Move[]): Cell[] {
  const board = emptyBoard();
  for (const m of moves) board[m.index] = m.player;
  return board;
}

export function availableMoves(board: Board): number[] {
  const out: number[] = [];
  board.forEach((c, i) => c === null && out.push(i));
  return out;
}

export function applyMove(board: Board, index: number, player: Player): Cell[] {
  if (board[index] !== null) throw new Error(`Cell ${index} is occupied`);
  const next = board.slice();
  next[index] = player;
  return next;
}

export function findWin(board: Board): { winner: Player; line: Line } | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const v = board[a];
    if (v && v === board[b] && v === board[c]) return { winner: v, line };
  }
  return null;
}

export function getOutcome(board: Board): { result: Result; line?: Line } | null {
  const win = findWin(board);
  if (win) return { result: win.winner, line: win.line };
  if (board.every((c) => c !== null)) return { result: 'draw' };
  return null;
}

/** Whose turn it is, given who moved first. */
export function turnOf(board: Board, first: Player): Player {
  const filled = board.filter((c) => c !== null).length;
  return filled % 2 === 0 ? first : other(first);
}

/** Row/column (1-based) for labels. */
export const cellPosition = (i: number) => ({ row: Math.floor(i / SIZE) + 1, col: (i % SIZE) + 1 });
