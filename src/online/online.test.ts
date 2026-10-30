import { describe, expect, it } from 'vitest';
import type { GameRecord } from '../engine/types';
import { onlineStats } from '../utils/stats';
import { normalizeCode } from './protocol';

describe('normalizeCode', () => {
  it('uppercases, drops characters outside the alphabet and caps the length', () => {
    expect(normalizeCode('k7qm2p')).toBe('K7QM2P');
    expect(normalizeCode(' k7-qm 2p ')).toBe('K7QM2P');
    expect(normalizeCode('O0I1L')).toBe('');
    expect(normalizeCode('ABCDEFGH')).toBe('ABCDEF');
  });
});

describe('onlineStats', () => {
  const rec = (id: string, human: 'X' | 'O', result: GameRecord['result'], opponent: string): GameRecord => ({
    id,
    mode: 'online',
    human,
    players: human === 'X' ? { X: 'Me', O: opponent } : { X: opponent, O: 'Me' },
    firstPlayer: 'X',
    moves: [],
    result,
    startedAt: 0,
    endedAt: 0,
  });

  it('scores games from this device player side and counts opponents', () => {
    const s = onlineStats([
      rec('1', 'X', 'X', 'Ben'),
      rec('2', 'O', 'X', 'Ben'),
      rec('3', 'O', 'draw', 'Cara'),
      { ...rec('4', 'X', 'X', 'Dan'), mode: 'pvp' },
    ]);
    expect(s.tally).toEqual({ win: 1, draw: 1, loss: 1 });
    expect(s.opponents).toBe(2);
  });
});
