import { cellPosition } from '../engine/board';
import type { Difficulty } from '../engine/types';

/** Cell name in A1 notation: columns A–C, rows 1–3 from the top. */
export function cellName(i: number): string {
  const { row, col } = cellPosition(i);
  return `${'ABC'[col - 1]}${row}`;
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  master: 'Master',
};

export const botName = (d: Difficulty) => `${DIFFICULTY_LABEL[d]} Bot`;

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.round((now - ts) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
