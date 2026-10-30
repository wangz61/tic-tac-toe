import { other } from '../engine/board';
import type { Difficulty, GameRecord } from '../engine/types';

export type Outcome = 'win' | 'draw' | 'loss';

export interface Tally {
  win: number;
  draw: number;
  loss: number;
}

export const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard', 'master'];

const emptyTally = (): Tally => ({ win: 0, draw: 0, loss: 0 });

export const total = (t: Tally) => t.win + t.draw + t.loss;

/** This device's player's outcome in a PvE or online record. */
export function humanOutcome(r: GameRecord): Outcome {
  if (r.result === 'draw') return 'draw';
  return r.result === r.human ? 'win' : 'loss';
}

export interface PveStats {
  overall: Tally;
  byDifficulty: Record<Difficulty, Tally>;
  movingFirst: Tally;
  movingSecond: Tally;
  currentStreak: number;
  bestStreak: number;
  /** Up to 20 most recent outcomes, oldest first. */
  recent: { outcome: Outcome; record: GameRecord }[];
}

export interface PvpStats {
  games: number;
  xWins: number;
  oWins: number;
  draws: number;
  firstMoverWins: number;
}

/** `records` is newest first, as stored. */
export function pveStats(records: readonly GameRecord[]): PveStats {
  const pve = records.filter((r) => r.mode === 'pve').slice().reverse();
  const byDifficulty = Object.fromEntries(DIFFICULTIES.map((d) => [d, emptyTally()])) as Record<Difficulty, Tally>;
  const overall = emptyTally();
  const movingFirst = emptyTally();
  const movingSecond = emptyTally();
  let streak = 0;
  let best = 0;

  for (const r of pve) {
    const o = humanOutcome(r);
    overall[o]++;
    if (r.difficulty) byDifficulty[r.difficulty][o]++;
    (r.firstPlayer === r.human ? movingFirst : movingSecond)[o]++;
    streak = o === 'win' ? streak + 1 : 0;
    best = Math.max(best, streak);
  }

  return {
    overall,
    byDifficulty,
    movingFirst,
    movingSecond,
    currentStreak: streak,
    bestStreak: best,
    recent: pve.slice(-20).map((record) => ({ outcome: humanOutcome(record), record })),
  };
}

export function pvpStats(records: readonly GameRecord[]): PvpStats {
  const pvp = records.filter((r) => r.mode === 'pvp');
  return {
    games: pvp.length,
    xWins: pvp.filter((r) => r.result === 'X').length,
    oWins: pvp.filter((r) => r.result === 'O').length,
    draws: pvp.filter((r) => r.result === 'draw').length,
    firstMoverWins: pvp.filter((r) => r.result === r.firstPlayer).length,
  };
}

export interface OnlineStats {
  tally: Tally;
  opponents: number;
}

export function onlineStats(records: readonly GameRecord[]): OnlineStats {
  const online = records.filter((r) => r.mode === 'online');
  const tally = emptyTally();
  for (const r of online) tally[humanOutcome(r)]++;
  return { tally, opponents: new Set(online.map(opponentOf)).size };
}

export const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

/** Opponent name for a PvE or online record, e.g. "Hard Bot". */
export const opponentOf = (r: GameRecord) => (r.human ? r.players[other(r.human)] : r.players.O);
