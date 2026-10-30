import { describe, expect, it } from 'vitest';
import { applyMove, availableMoves, emptyBoard, getOutcome, other, turnOf, WIN_LINES } from './board';
import { bestMoves, chooseMove, evaluateMoves } from './ai';
import type { Board, Cell, Player } from './types';

const parse = (s: string): Cell[] => s.split('').map((c) => (c === 'X' || c === 'O' ? c : null));

describe('board', () => {
  it('detects all eight win lines for both players', () => {
    for (const p of ['X', 'O'] as Player[]) {
      for (const line of WIN_LINES) {
        const b = emptyBoard();
        line.forEach((i) => (b[i] = p));
        expect(getOutcome(b)).toEqual({ result: p, line });
      }
    }
  });

  it('detects a draw and an unfinished game', () => {
    expect(getOutcome(parse('XOXXOOOXX'))).toEqual({ result: 'draw' });
    expect(getOutcome(parse('XO-------'))).toBeNull();
  });

  it('prefers the win over a full-board draw', () => {
    expect(getOutcome(parse('XXXOOXOXO'))?.result).toBe('X');
  });

  it('tracks turns and rejects occupied cells', () => {
    expect(turnOf(parse('X--------'), 'X')).toBe('O');
    expect(turnOf(parse('O--------'), 'O')).toBe('X');
    expect(() => applyMove(parse('X--------'), 0, 'O')).toThrow();
  });
});

describe('ai', () => {
  it('evaluates the empty board as a draw everywhere', () => {
    expect(evaluateMoves(emptyBoard(), 'X').every((e) => e.verdict === 'draw')).toBe(true);
  });

  it('marks immediate wins and losing moves', () => {
    // X to move; cell 2 wins on the spot.
    const evals = evaluateMoves(parse('XX-OO----'), 'X');
    expect(evals.find((e) => e.index === 2)?.verdict).toBe('win');
    // O to move with X threatening 0-1-2: anything but 2 loses.
    const o = evaluateMoves(parse('XX--O----'), 'O');
    expect(o.find((e) => e.index === 2)?.verdict).not.toBe('loss');
    expect(o.filter((e) => e.index !== 2).every((e) => e.verdict === 'loss')).toBe(true);
  });

  it('normal takes wins, then blocks', () => {
    expect(chooseMove(parse('XX-OO----'), 'O', 'normal', () => 0)).toBe(5);
    expect(chooseMove(parse('XX--O----'), 'O', 'normal', () => 0)).toBe(2);
  });

  it('easy only plays legal moves', () => {
    const b = parse('XOX-O-X--');
    for (let k = 0; k < 50; k++) expect(availableMoves(b)).toContain(chooseMove(b, 'O', 'easy'));
  });

  it('hard always finishes an immediate win', () => {
    expect(chooseMove(parse('OO-XX-X--'), 'O', 'hard', () => 0.99)).toBe(2);
  });

  /** Plays every opponent line against every optimal master reply. */
  function masterNeverLoses(board: Board, toMove: Player, ai: Player): boolean {
    const outcome = getOutcome(board);
    if (outcome) return outcome.result !== other(ai);
    const replies = toMove === ai ? bestMoves(board, ai) : availableMoves(board);
    return replies.every((i) => masterNeverLoses(applyMove(board, i, toMove), other(toMove), ai));
  }

  it('master never loses, moving first or second, as X or O', () => {
    for (const ai of ['X', 'O'] as Player[]) {
      for (const first of ['X', 'O'] as Player[]) {
        expect(masterNeverLoses(emptyBoard(), first, ai)).toBe(true);
      }
    }
  });
});
