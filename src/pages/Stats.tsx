import { useMemo, useState } from 'react';
import type { GameRecord } from '../engine/types';
import { Donut, Legend, ResultStrip, StackedBars, type Segment } from '../components/charts';
import { TopBar } from '../components/ui';
import { useStore } from '../state/AppStore';
import { DIFFICULTY_LABEL, timeAgo } from '../utils/format';
import { DIFFICULTIES, humanOutcome, onlineStats, opponentOf, pct, pveStats, pvpStats, total, type Tally } from '../utils/stats';
import { ReplayView } from './Replay';

const OUTCOME_LEGEND = [
  { key: 'win', label: 'Win', tone: 'win' },
  { key: 'draw', label: 'Draw', tone: 'draw' },
  { key: 'loss', label: 'Loss', tone: 'loss' },
] as const;

const tallySegments = (t: Tally): Segment[] => [
  { key: 'win', label: 'Wins', value: t.win, tone: 'win' },
  { key: 'draw', label: 'Draws', value: t.draw, tone: 'draw' },
  { key: 'loss', label: 'Losses', value: t.loss, tone: 'loss' },
];

const OUTCOME_WORD = { win: 'Won', draw: 'Drew', loss: 'Lost' } as const;
const MODE_LABEL = { pve: 'vs Computer', pvp: 'Two players', online: 'Online' } as const;
const fromOwnSide = (r: GameRecord) => r.mode !== 'pvp';

function describe(r: GameRecord): string {
  if (fromOwnSide(r)) return `${OUTCOME_WORD[humanOutcome(r)]} vs ${opponentOf(r)}`;
  return r.result === 'draw' ? `${r.players.X} drew ${r.players.O}` : `${r.players[r.result]} won (${r.result})`;
}

export function Stats({ onBack }: { onBack: () => void }) {
  const { records, clearRecords } = useStore();
  const [confirming, setConfirming] = useState(false);
  const [replay, setReplay] = useState<GameRecord | null>(null);
  const pve = useMemo(() => pveStats(records), [records]);
  const pvp = useMemo(() => pvpStats(records), [records]);
  const online = useMemo(() => onlineStats(records), [records]);
  const onlineGames = total(online.tally);
  const pveGames = total(pve.overall);

  if (replay) return <ReplayView record={replay} onBack={() => setReplay(null)} backLabel="Statistics" />;

  if (!records.length) {
    return (
      <main className="page-wide">
        <TopBar title="Statistics" onBack={onBack} />
        <div className="card empty">
          <p className="empty__title">No games yet</p>
          <p className="muted">Finish a game and your results will show up here.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-wide">
      <TopBar title="Statistics" onBack={onBack} />

      <section className="tiles">
        <div className="tile">
          <span className="tile__label">Games played</span>
          <span className="tile__value">{records.length}</span>
          <span className="tile__sub">{pveGames} vs computer · {pvp.games} two-player{onlineGames > 0 && ` · ${onlineGames} online`}</span>
        </div>
        <div className="tile">
          <span className="tile__label">Win rate vs computer</span>
          <span className="tile__value">{pveGames ? `${pct(pve.overall.win, pveGames)}%` : '—'}</span>
          <span className="tile__sub">{pve.overall.win} won · {pve.overall.draw} drawn · {pve.overall.loss} lost</span>
        </div>
        <div className="tile">
          <span className="tile__label">Current streak</span>
          <span className="tile__value">{pve.currentStreak}</span>
          <span className="tile__sub">wins in a row vs computer</span>
        </div>
        <div className="tile">
          <span className="tile__label">Best streak</span>
          <span className="tile__value">{pve.bestStreak}</span>
          <span className="tile__sub">longest winning run</span>
        </div>
      </section>

      {pveGames > 0 && (
        <section className="card chart-card">
          <header className="chart-card__head">
            <h2>vs Computer</h2>
            <Legend items={[...OUTCOME_LEGEND]} />
          </header>
          <div className="chart-card__grid">
            <Donut segments={tallySegments(pve.overall)} centerValue={`${pct(pve.overall.win, pveGames)}%`} centerLabel="win rate" />
            <div className="chart-card__bars">
              <h3 className="chart-sub">By difficulty <span className="muted">· win %</span></h3>
              <StackedBars
                rows={DIFFICULTIES.map((d) => ({ label: DIFFICULTY_LABEL[d], segments: tallySegments(pve.byDifficulty[d]) }))}
              />
              <h3 className="chart-sub">By turn order <span className="muted">· win %</span></h3>
              <StackedBars
                rows={[
                  { label: 'Moving first', segments: tallySegments(pve.movingFirst) },
                  { label: 'Moving second', segments: tallySegments(pve.movingSecond) },
                ]}
              />
            </div>
          </div>
          <h3 className="chart-sub">Recent form <span className="muted">· last {pve.recent.length}, oldest first</span></h3>
          <ResultStrip
            items={pve.recent.map(({ outcome, record }) => ({
              outcome,
              title: `${OUTCOME_WORD[outcome]} vs ${opponentOf(record)} · ${timeAgo(record.endedAt)}`,
            }))}
          />
        </section>
      )}

      {pvp.games > 0 && (
        <section className="card chart-card">
          <header className="chart-card__head">
            <h2>Two Players</h2>
            <Legend
              items={[
                { key: 'x', label: 'X wins', tone: 'x' },
                { key: 'draw', label: 'Draws', tone: 'draw' },
                { key: 'o', label: 'O wins', tone: 'o' },
              ]}
            />
          </header>
          <StackedBars
            rows={[
              {
                label: 'Results',
                segments: [
                  { key: 'x', label: 'X wins', value: pvp.xWins, tone: 'x' },
                  { key: 'draw', label: 'Draws', value: pvp.draws, tone: 'draw' },
                  { key: 'o', label: 'O wins', value: pvp.oWins, tone: 'o' },
                ],
              },
            ]}
          />
          <p className="muted chart-note">
            The player who moved first won {pct(pvp.firstMoverWins, pvp.games)}% of {pvp.games} games.
          </p>
        </section>
      )}

      {onlineGames > 0 && (
        <section className="card chart-card">
          <header className="chart-card__head">
            <h2>Online</h2>
            <Legend items={[...OUTCOME_LEGEND]} />
          </header>
          <StackedBars rows={[{ label: 'Your results', segments: tallySegments(online.tally) }]} />
          <p className="muted chart-note">
            {pct(online.tally.win, onlineGames)}% won across {onlineGames} {onlineGames === 1 ? 'game' : 'games'} against{' '}
            {online.opponents} {online.opponents === 1 ? 'opponent' : 'different opponents'}.
          </p>
        </section>
      )}

      <section className="card">
        <header className="chart-card__head">
          <h2>Recent games</h2>
          {confirming ? (
            <div className="confirm">
              <span>Delete all {records.length} games?</span>
              <button type="button" className="btn btn--danger btn--sm" onClick={() => { clearRecords(); setConfirming(false); }}>
                Delete
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(true)}>
              Clear statistics
            </button>
          )}
        </header>
        <ul className="history">
          {records.slice(0, 50).map((r) => {
            const tone = fromOwnSide(r) ? humanOutcome(r) : r.result === 'draw' ? 'draw' : r.result.toLowerCase();
            return (
              <li key={r.id} className="history__item">
                <span className={`history__mark tone-${tone}`} aria-hidden="true" />
                <span className="history__text">
                  <span>{describe(r)}</span>
                  <span className="muted">
                    {MODE_LABEL[r.mode]} · {r.moves.length} moves · {timeAgo(r.endedAt)}
                  </span>
                </span>
                <button type="button" className="btn btn--soft btn--sm" onClick={() => setReplay(r)}>
                  Replay
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
