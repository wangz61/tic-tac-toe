import { describe, expect, it } from 'vitest';
import { canUndo, derive, gameReducer, initGame, seriesWinner, type GameConfig, type GameState } from './game';

const base: GameConfig = {
  mode: 'pvp',
  difficulty: 'master',
  names: { X: 'Player X', O: 'Player O' },
  human: 'X',
  first: 'X',
  nextFirst: 'alternate',
  bestOf: 3,
};

const play = (s: GameState, ...cells: number[]) =>
  cells.reduce((st, index) => gameReducer(st, { type: 'move', index, at: 0 }), s);

describe('game reducer', () => {
  it('alternates turns and scores a win', () => {
    const s = play(initGame(base, 0), 0, 3, 1, 4, 2);
    const d = derive(s);
    expect(d.outcome?.result).toBe('X');
    expect(d.outcome?.line).toEqual([0, 1, 2]);
    expect(s.score).toEqual({ X: 1, O: 0, draw: 0 });
  });

  it('ignores moves on occupied cells and after the game ends', () => {
    let s = play(initGame(base, 0), 0);
    expect(play(s, 0)).toBe(s);
    s = play(s, 3, 1, 4, 2);
    expect(play(s, 8)).toBe(s);
  });

  it('undoes and redoes a single move in PvP', () => {
    let s = play(initGame(base, 0), 4, 0);
    s = gameReducer(s, { type: 'undo' });
    expect(s.moves.map((m) => m.index)).toEqual([4]);
    expect(derive(s).turn).toBe('O');
    s = gameReducer(s, { type: 'redo' });
    expect(s.moves.map((m) => m.index)).toEqual([4, 0]);
  });

  it('undoes the human move together with the AI reply in PvE', () => {
    const pve = { ...base, mode: 'pve' as const, human: 'O' as const, first: 'X' as const };
    // X = AI moves first, O = human.
    let s = play(initGame(pve, 0), 4, 0, 8);
    s = gameReducer(s, { type: 'undo' });
    expect(s.moves.map((m) => m.index)).toEqual([4]);
    expect(derive(s).aiTurn).toBe(false);
    // Only the AI has moved: nothing of the human's left to undo.
    expect(canUndo(s)).toBe(false);
  });

  it('locks undo once the round is over', () => {
    const s = play(initGame(base, 0), 0, 3, 1, 4, 2);
    expect(gameReducer(s, { type: 'undo' })).toBe(s);
  });

  it('applies the next-first rule between rounds', () => {
    const won = play(initGame(base, 0), 0, 3, 1, 4, 2); // X wins
    expect(gameReducer(won, { type: 'nextRound', at: 1 }).first).toBe('O');
    const loser = { ...won, config: { ...base, nextFirst: 'loser' as const } };
    expect(gameReducer(loser, { type: 'nextRound', at: 1 }).first).toBe('O');
    const same = { ...won, config: { ...base, nextFirst: 'same' as const } };
    expect(gameReducer(same, { type: 'nextRound', at: 1 }).first).toBe('X');
  });

  it('decides a series', () => {
    expect(seriesWinner({ X: 2, O: 0, draw: 0 }, 3)).toBe('X');
    expect(seriesWinner({ X: 1, O: 1, draw: 0 }, 3)).toBeNull();
    expect(seriesWinner({ X: 1, O: 1, draw: 1 }, 3)).toBe('tie');
    expect(seriesWinner({ X: 0, O: 0, draw: 1 }, 1)).toBe('tie');
    expect(seriesWinner({ X: 9, O: 0, draw: 0 }, 0)).toBeNull();
  });
});
