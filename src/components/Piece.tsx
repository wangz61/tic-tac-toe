import type { Player } from '../engine/types';
import { cx } from '../utils/format';

interface Props {
  player: Player;
  /** Draw the strokes in on mount. */
  animate?: boolean;
  ghost?: boolean;
  className?: string;
}

export function Piece({ player, animate = true, ghost = false, className }: Props) {
  return (
    <svg
      className={cx('piece', `piece--${player.toLowerCase()}`, animate && 'piece--draw', ghost && 'piece--ghost', className)}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      {player === 'X' ? (
        <>
          <line x1="26" y1="26" x2="74" y2="74" pathLength={1} />
          <line x1="74" y1="26" x2="26" y2="74" pathLength={1} className="piece__second" />
        </>
      ) : (
        <circle cx="50" cy="50" r="26" pathLength={1} transform="rotate(-90 50 50)" />
      )}
    </svg>
  );
}
