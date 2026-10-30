import { useEffect, useMemo, useRef, useState } from 'react';
import { boardFromMoves, other } from '../engine/board';
import type { Player } from '../engine/types';
import { Board } from '../components/Board';
import { Piece } from '../components/Piece';
import { Dialog, ScoreBoard, Timeline, TopBar, toneOf } from '../components/ui';
import { placeSound, useSound } from '../hooks/useSound';
import { CODE_LENGTH, normalizeCode, serverUrl, type RoomState } from '../online/protocol';
import { useOnline, type OnlineView } from '../online/useOnline';
import { useStore } from '../state/AppStore';
import { load, save } from '../utils/storage';

/** Shareable link that opens the lobby with the code filled in; null where the page has no web address. */
function inviteLink(code: string): string | null {
  const { protocol, origin, pathname } = window.location;
  return protocol === 'http:' || protocol === 'https:' ? `${origin}${pathname}?room=${code}` : null;
}

export function Online({ onBack, initialCode = '' }: { onBack: () => void; initialCode?: string }) {
  const [host, setHost] = useState(() => load('online-server', ''));
  const url = useMemo(() => serverUrl(host), [host]);
  const online = useOnline(url);
  const { view } = online;
  const leaveToMenu = () => {
    if (view.status === 'room') online.leave();
    onBack();
  };

  // Remember who we were playing, to say so when they leave and the room reopens.
  const opponentRef = useRef<string | null>(null);
  const room = view.room;
  const opponentSeat = room && view.you ? room.players[other(view.you)] : null;
  let leftName: string | null = null;
  if (opponentSeat) opponentRef.current = opponentSeat.name;
  else if (room?.status === 'waiting') leftName = opponentRef.current;
  if (view.status !== 'room') opponentRef.current = null;

  if (view.status === 'room' && view.room && view.you) {
    return view.room.status === 'waiting' ? (
      <Waiting room={view.room} view={view} leftName={leftName} onLeave={online.leave} onMenu={leaveToMenu} />
    ) : (
      <OnlineGame room={view.room} view={view} you={view.you} actions={online} onMenu={leaveToMenu} />
    );
  }
  return (
    <Lobby
      view={view}
      url={url}
      host={host}
      initialCode={initialCode}
      onHost={(h) => {
        save('online-server', h);
        setHost(h);
      }}
      onCreate={online.create}
      onJoin={online.join}
      onBack={leaveToMenu}
    />
  );
}

function Lobby({
  view,
  url,
  host,
  initialCode,
  onHost,
  onCreate,
  onJoin,
  onBack,
}: {
  view: OnlineView;
  url: string;
  host: string;
  initialCode: string;
  onHost: (host: string) => void;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(() => load('online-name', ''));
  const [code, setCode] = useState(() => normalizeCode(initialCode));
  const busy = view.status === 'connecting';
  const playerName = () => {
    const n = name.trim();
    save('online-name', n);
    return n || 'Player';
  };

  return (
    <main className="page-narrow">
      <TopBar title="Play Online" onBack={onBack} />
      <div className="card setup online-lobby">
        <div className="field">
          <label className="field__label" htmlFor="online-name">Your name</label>
          <input
            id="online-name"
            className="input"
            value={name}
            maxLength={20}
            placeholder="Player"
            autoComplete="nickname"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <button type="button" className="btn btn--primary btn--lg" disabled={busy} onClick={() => onCreate(playerName())}>
          {busy ? 'Connecting…' : 'Create a room'}
        </button>

        <div className="online-lobby__or"><span>or join a friend</span></div>

        <form
          className="online-join"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === CODE_LENGTH) onJoin(code, playerName());
          }}
        >
          <label className="field__label" htmlFor="room-code">Room code</label>
          <div className="online-join__row">
            <input
              id="room-code"
              className="input input--code"
              value={code}
              placeholder="K7QM2P"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
            />
            <button type="submit" className="btn btn--soft" disabled={busy || code.length !== CODE_LENGTH}>
              Join
            </button>
          </div>
        </form>

        {view.error && (
          <p className="notice notice--error" role="alert">
            {view.error.message}
          </p>
        )}
      </div>
      <ServerSetting url={url} host={host} onHost={onHost} />
      <p className="online-foot muted">The player who creates the room plays X; the friend who joins plays O.</p>
    </main>
  );
}

function ServerSetting({ url, host, onHost }: { url: string; host: string; onHost: (host: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(host);
  const shown = url.replace(/^wss?:\/\//, '').replace(/\/ws$/, '');

  if (!editing) {
    return (
      <p className="online-foot muted">
        Server <code>{shown}</code>{' '}
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setDraft(host);
            setEditing(true);
          }}
        >
          Change
        </button>
      </p>
    );
  }
  return (
    <form
      className="online-server"
      onSubmit={(e) => {
        e.preventDefault();
        // Accept a pasted URL too: keep only host[:port].
        onHost(draft.trim().replace(/^(wss?|https?):\/\//, '').replace(/\/.*$/, ''));
        setEditing(false);
      }}
    >
      <label className="field__label" htmlFor="online-server">Server address</label>
      <div className="online-join__row">
        <input
          id="online-server"
          className="input"
          value={draft}
          placeholder="192.168.1.20:8000"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn btn--soft">Save</button>
      </div>
      <span className="field__hint">Host and port of a computer running the game server. Leave empty to use the default.</span>
    </form>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API unavailable (e.g. plain http on another device): fall back to a hidden textarea.
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
  };

  return (
    <button type="button" className="btn btn--soft btn--sm" onClick={copy}>
      {copied ? 'Copied' : label}
    </button>
  );
}

function Waiting({
  room,
  view,
  leftName,
  onLeave,
  onMenu,
}: {
  room: RoomState;
  view: OnlineView;
  leftName: string | null;
  onLeave: () => void;
  onMenu: () => void;
}) {
  const link = inviteLink(room.code);
  return (
    <main className="page-narrow">
      <TopBar title="Play Online" onBack={onMenu} />
      <div className="card online-wait">
        {leftName && <p className="notice">{leftName} left the room. The score starts over when someone new joins.</p>}
        <p className="field__label">Room code</p>
        <div className="code-tiles" aria-label={`Room code ${room.code.split('').join(' ')}`}>
          {room.code.split('').map((c, i) => (
            <span key={i} className="code-tiles__c">{c}</span>
          ))}
        </div>
        <p className="online-wait__hint">Share this code with a friend. The game starts as soon as they join.</p>
        <div className="online-wait__actions">
          <CopyButton text={room.code} label="Copy code" />
          {link && <CopyButton text={link} label="Copy invite link" />}
        </div>
        <p className="online-wait__status">
          <span className="pulse" aria-hidden="true" /> Waiting for an opponent…
        </p>
        {!view.linked && <p className="notice">Connection lost. Reconnecting…</p>}
        <button type="button" className="btn btn--ghost" onClick={onLeave}>
          Leave room
        </button>
      </div>
    </main>
  );
}

function OnlineGame({
  room,
  view,
  you,
  actions,
  onMenu,
}: {
  room: RoomState;
  view: OnlineView;
  you: Player;
  actions: ReturnType<typeof useOnline>;
  onMenu: () => void;
}) {
  const { addRecord } = useStore();
  const play = useSound();
  const them = other(you);
  const names = { X: room.players.X?.name ?? 'Player X', O: room.players.O?.name ?? 'Player O' };
  const opponent = room.players[them];
  const over = room.status === 'over';
  const myTurn = !over && room.turn === you;
  const canPlay = myTurn && view.linked;
  const roundKey = `${room.code}-${room.round}`;
  const [dialogFor, setDialogFor] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  // Placement sound for each new piece, from either player.
  const seenMoves = useRef(room.moves.length);
  useEffect(() => {
    const n = room.moves.length;
    if (n > seenMoves.current) play(placeSound(room.moves[n - 1].player));
    seenMoves.current = n;
  }, [room.moves, play]);

  // Round finished: save it to this device's history (the id dedupes a resumed round) and play the result sound.
  useEffect(() => {
    if (!over || !room.result || !room.moves.length) return;
    const first = room.moves[0];
    const last = room.moves[room.moves.length - 1];
    addRecord({
      id: `online-${room.code}-${room.round}-${first.at}`,
      mode: 'online',
      human: you,
      players: names,
      firstPlayer: room.first,
      moves: room.moves,
      result: room.result,
      winLine: room.winLine ?? undefined,
      startedAt: first.at,
      endedAt: last.at,
    });
    const result = room.result;
    const t = setTimeout(() => play(result === 'draw' ? 'draw' : result === you ? 'win' : 'lose'), 160);
    return () => clearTimeout(t);
  }, [over, roundKey]);

  // Open the result dialog shortly after the winning line draws.
  useEffect(() => {
    if (!over) return;
    const t = setTimeout(() => setDialogFor(roundKey), 900);
    return () => clearTimeout(t);
  }, [over, roundKey]);

  // In-game refusals (e.g. a move sent just as the turn changed) fade after a moment.
  useEffect(() => {
    if (!view.error) return;
    const t = setTimeout(actions.clearError, 2500);
    return () => clearTimeout(t);
  }, [view.error]);

  const iVoted = room.rematch.includes(you);
  const theyVoted = room.rematch.includes(them);
  const resultTitle =
    room.result === 'draw' ? "It's a draw" : room.result === you ? 'You win!' : `${names[them]} wins`;

  const status = over
    ? resultTitle
    : !opponent?.connected
      ? `${names[them]} lost connection. Waiting for them to come back…`
      : myTurn
        ? 'Your move'
        : `Waiting for ${names[them]}…`;

  const rematchButton = (
    <button type="button" className="btn btn--primary" disabled={iVoted || !opponent?.connected} onClick={actions.rematch}>
      {iVoted ? `Waiting for ${names[them]}…` : theyVoted ? 'Accept rematch' : 'Rematch'}
    </button>
  );

  return (
    <main className="game">
      <TopBar
        title={<>Online · <span className="mono">{room.code}</span></>}
        onBack={onMenu}
        backLabel="Leave"
        right={<span className="chip">Round {room.round}</span>}
      />

      <div className="game__layout">
        <section className="game__main">
          <ScoreBoard
            names={names}
            score={room.score}
            turn={room.turn}
            thinking={false}
            over={over}
            statusFor={(p) => {
              const seat = room.players[p];
              if (seat && !seat.connected) return <span className="status-away">Disconnected</span>;
              if (over || room.turn !== p) return p === you ? 'You' : ' ';
              return p === you ? 'Your move' : 'Their move';
            }}
          />

          <Board
            board={boardFromMoves(room.moves)}
            interactive={canPlay}
            ghost={you}
            onCell={actions.move}
            winLine={room.winLine ?? undefined}
            winner={room.result && room.result !== 'draw' ? room.result : undefined}
            isDraw={room.result === 'draw'}
            lastIndex={room.moves[room.moves.length - 1]?.index}
          />

          <p className="game__status" aria-live="polite">
            {status}
          </p>
          {!view.linked && <p className="notice">Connection lost. Reconnecting…</p>}
          {view.error && view.linked && <p className="notice notice--error">{view.error.message}</p>}
          {over && theyVoted && !iVoted && <p className="notice">{names[them]} wants a rematch.</p>}

          <div className="controls">
            {over ? rematchButton : null}
            <button type="button" className="btn btn--soft" onClick={onMenu}>
              Leave
            </button>
          </div>
        </section>

        <aside className="game__side card">
          <div className="online-you">
            <Piece player={you} animate={false} className="online-you__piece" />
            <div>
              <strong>You play {you}</strong>
              <span className="muted">{room.first === you ? 'You move first this round' : `${names[them]} moves first this round`}</span>
            </div>
          </div>
          <div className="side__divider" />
          <h2 className="side__title">Moves</h2>
          <Timeline moves={room.moves} />
        </aside>
      </div>

      {over && room.result && dialogFor === roundKey && dismissed !== roundKey && (
        <Dialog
          tone={toneOf(room.result, you)}
          title={resultTitle}
          subtitle={
            <>
              {names.X} <strong>{room.score.X}</strong> – <strong>{room.score.O}</strong> {names.O}
              {room.score.draw > 0 && <span className="muted"> · {room.score.draw} drawn</span>}
            </>
          }
        >
          {rematchButton}
          <button type="button" className="btn btn--ghost" onClick={() => setDismissed(roundKey)}>
            View board
          </button>
          <button type="button" className="btn btn--ghost" onClick={onMenu}>
            Leave
          </button>
        </Dialog>
      )}
    </main>
  );
}
