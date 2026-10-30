import { useState, type MouseEvent } from 'react';
import { pct } from '../utils/stats';
import { cx } from '../utils/format';

export type ChartTone = 'win' | 'draw' | 'loss' | 'x' | 'o';

export interface Segment {
  key: string;
  label: string;
  value: number;
  tone: ChartTone;
}

export function Legend({ items }: { items: Omit<Segment, 'value'>[] }) {
  return (
    <ul className="legend">
      {items.map((s) => (
        <li key={s.key}>
          <span className={cx('legend__swatch', `tone-${s.tone}`)} aria-hidden="true" />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

interface Tip {
  x: number;
  row: number;
  text: string;
}

/** 100%-stacked horizontal bars, one row per group, with a hover tooltip. */
export function StackedBars({ rows }: { rows: { label: string; segments: Segment[] }[] }) {
  const [tip, setTip] = useState<Tip | null>(null);

  const show = (e: MouseEvent<HTMLElement>, row: number, s: Segment, sum: number) => {
    const el = e.currentTarget;
    setTip({ x: el.offsetLeft + el.offsetWidth / 2, row, text: `${s.label}: ${s.value} (${pct(s.value, sum)}%)` });
  };

  return (
    <div className="bars" onMouseLeave={() => setTip(null)}>
      {rows.map((r, ri) => {
        const sum = r.segments.reduce((a, s) => a + s.value, 0);
        const lead = r.segments[0];
        return (
          <div className="bars__row" key={r.label}>
            <span className="bars__label">{r.label}</span>
            <div className="bars__track" aria-label={`${r.label}: ${r.segments.map((s) => `${s.label} ${s.value}`).join(', ')}`} role="img">
              {sum > 0 &&
                r.segments
                  .filter((s) => s.value > 0)
                  .map((s) => (
                    <span
                      key={s.key}
                      className={cx('bars__seg', `tone-${s.tone}`)}
                      style={{ flexGrow: s.value }}
                      onMouseEnter={(e) => show(e, ri, s, sum)}
                    />
                  ))}
              {tip?.row === ri && (
                <span className="tooltip" style={{ left: tip.x }}>
                  {tip.text}
                </span>
              )}
            </div>
            <span className="bars__value">
              {sum ? (
                <>
                  <strong>{pct(lead.value, sum)}%</strong> <span className="muted">of {sum}</span>
                </>
              ) : (
                <span className="muted">—</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Ring chart; hovering a segment swaps the centre readout. */
export function Donut({ segments, centerValue, centerLabel }: { segments: Segment[]; centerValue: string; centerLabel: string }) {
  const [hover, setHover] = useState<Segment | null>(null);
  const sum = segments.reduce((a, s) => a + s.value, 0);
  const r = 42;
  const circ = 2 * Math.PI * r;
  const visible = segments.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? 2.4 : 0;
  let offset = 0;

  return (
    <div className="donut">
      <svg viewBox="0 0 100 100" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(', ')}>
        <circle className="donut__track" cx="50" cy="50" r={r} />
        {visible.map((s) => {
          const len = (s.value / sum) * circ;
          const el = (
            <circle
              key={s.key}
              className={cx('donut__seg', `stroke-${s.tone}`, hover && hover.key !== s.key && 'is-faded')}
              cx="50"
              cy="50"
              r={r}
              strokeDasharray={`${Math.max(len - gap, 0.01)} ${circ}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(null)}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="donut__center" aria-live="polite">
        <strong>{hover ? `${pct(hover.value, sum)}%` : centerValue}</strong>
        <span>{hover ? `${hover.label} · ${hover.value}` : centerLabel}</span>
      </div>
    </div>
  );
}

const LETTER: Record<'win' | 'draw' | 'loss', string> = { win: 'W', draw: 'D', loss: 'L' };

/** Recent-form strip: one tile per game, oldest left. Letters keep it readable without colour. */
export function ResultStrip({ items }: { items: { outcome: 'win' | 'draw' | 'loss'; title: string }[] }) {
  const [tip, setTip] = useState<{ x: number; text: string } | null>(null);
  return (
    <div className="strip" onMouseLeave={() => setTip(null)}>
      {items.map((it, i) => (
        <span
          key={i}
          className={cx('strip__tile', `tone-${it.outcome}`)}
          aria-label={it.title}
          role="img"
          onMouseEnter={(e) => setTip({ x: e.currentTarget.offsetLeft + e.currentTarget.offsetWidth / 2, text: it.title })}
        >
          {LETTER[it.outcome]}
        </span>
      ))}
      {tip && (
        <span className="tooltip tooltip--strip" style={{ left: tip.x }}>
          {tip.text}
        </span>
      )}
    </div>
  );
}
