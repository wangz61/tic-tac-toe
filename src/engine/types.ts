export type Player = 'X' | 'O';
export type Cell = Player | null;
export type Board = readonly Cell[];
export type Mode = 'pvp' | 'pve';
/** Online games are recorded too, from this device's player's side. */
export type RecordMode = Mode | 'online';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'master';
export type Result = Player | 'draw';
export type Line = readonly [number, number, number];

export interface Move {
  index: number;
  player: Player;
  at: number;
}

export interface GameRecord {
  id: string;
  mode: RecordMode;
  difficulty?: Difficulty;
  /** Which piece this device's player had, in PvE and online games. */
  human?: Player;
  players: { X: string; O: string };
  firstPlayer: Player;
  moves: Move[];
  result: Result;
  winLine?: Line;
  startedAt: number;
  endedAt: number;
}
