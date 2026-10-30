import type { Line, Move, Player, Result } from '../engine/types';

/** Messages the online server accepts. Mirrors server/app.py. */
export type ClientMessage =
  | { type: 'create'; name: string }
  | { type: 'join'; code: string; name: string }
  | { type: 'resume'; code: string; token: string }
  | { type: 'move'; index: number }
  | { type: 'rematch' }
  | { type: 'leave' };

export interface SeatInfo {
  name: string;
  connected: boolean;
}

export interface RoomState {
  type: 'state';
  code: string;
  status: 'waiting' | 'playing' | 'over';
  round: number;
  first: Player;
  turn: Player;
  moves: Move[];
  result: Result | null;
  winLine: Line | null;
  players: Record<Player, SeatInfo | null>;
  score: { X: number; O: number; draw: number };
  rematch: Player[];
}

export type ServerMessage =
  | { type: 'joined'; code: string; you: Player; token: string }
  | RoomState
  | { type: 'error'; code: string; message: string }
  | { type: 'left' };

export const CODE_LENGTH = 6;
/** Same alphabet as the server: no 0/O or 1/I/L. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const normalizeCode = (raw: string) =>
  raw
    .toUpperCase()
    .split('')
    .filter((c) => CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, CODE_LENGTH);

/**
 * WebSocket address of the game server. Same origin when the page is served over
 * http(s) (the server hosts the built game; Vite proxies /ws in dev), otherwise
 * `fallbackHost`, which covers the desktop app loading from file://.
 */
export function serverUrl(host?: string, fallbackHost = 'localhost:8000'): string {
  const { protocol, host: pageHost } = window.location;
  const sameOrigin = protocol === 'http:' || protocol === 'https:';
  const target = host?.trim() || (sameOrigin ? pageHost : fallbackHost);
  const secure = sameOrigin && !host?.trim() ? protocol === 'https:' : false;
  return `${secure ? 'wss' : 'ws'}://${target}/ws`;
}
