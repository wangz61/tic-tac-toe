import { useCallback, useEffect, useRef, useState } from 'react';
import type { Player } from '../engine/types';
import type { ClientMessage, RoomState, ServerMessage } from './protocol';

/** Per tab, so two tabs in one browser are two different players; survives a reload. */
const SESSION_KEY = 'ttt:v1:online-seat';
const RETRY_MS = [500, 1000, 2000, 4000, 5000];

interface Seat {
  url: string;
  code: string;
  token: string;
}

function loadSeat(url: string): Seat | null {
  try {
    const seat = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as Seat | null;
    return seat && seat.url === url ? seat : null;
  } catch {
    return null;
  }
}

function saveSeat(seat: Seat | null) {
  try {
    if (seat) sessionStorage.setItem(SESSION_KEY, JSON.stringify(seat));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage blocked: the game still works, it just can't resume after a reload.
  }
}

/** Whether this tab holds a seat in an online room, e.g. after a reload. */
export function hasSeat(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) !== null;
  } catch {
    return false;
  }
}

export interface OnlineView {
  /** lobby: not in a room · connecting: waiting for the server · room: seated */
  status: 'lobby' | 'connecting' | 'room';
  you: Player | null;
  room: RoomState | null;
  /** False while a seated player's connection is down and being retried. */
  linked: boolean;
  /** Last refusal or connection problem, for the lobby or a short in-game notice. */
  error: { code: string; message: string; at: number } | null;
}

export function useOnline(url: string) {
  const [view, setView] = useState<OnlineView>(() => ({
    status: loadSeat(url) ? 'connecting' : 'lobby',
    you: null,
    room: null,
    linked: true,
    error: null,
  }));
  const ws = useRef<WebSocket | null>(null);
  const queue = useRef<ClientMessage[]>([]);
  const attempt = useRef(0);
  const retryTimer = useRef<number>();
  const disposed = useRef(false);

  const fail = (code: string, message: string) =>
    setView((v) => ({ ...v, status: v.status === 'room' ? 'room' : 'lobby', error: { code, message, at: Date.now() } }));

  const handle = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case 'joined':
          saveSeat({ url, code: msg.code, token: msg.token });
          setView((v) => ({ ...v, status: 'room', you: msg.you, linked: true, error: null }));
          break;
        case 'state':
          setView((v) => ({ ...v, status: 'room', room: msg, linked: true }));
          break;
        case 'left':
          saveSeat(null);
          setView({ status: 'lobby', you: null, room: null, linked: true, error: null });
          break;
        case 'error':
          // A stale seat (server restarted, or away too long): back to the lobby.
          if (msg.code === 'invalid_token' || (msg.code === 'not_found' && loadSeat(url))) {
            saveSeat(null);
            setView({
              status: 'lobby',
              you: null,
              room: null,
              linked: true,
              error: { code: msg.code, message: 'Your previous game has ended.', at: Date.now() },
            });
          } else fail(msg.code, msg.message);
          break;
      }
    },
    [url],
  );

  const connect = useCallback(() => {
    if (ws.current || disposed.current) return;
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      fail('unreachable', `Can't connect to ${url}.`);
      return;
    }
    ws.current = socket;
    let opened = false;

    socket.onopen = () => {
      opened = true;
      attempt.current = 0;
      const seat = loadSeat(url);
      if (seat) socket.send(JSON.stringify({ type: 'resume', code: seat.code, token: seat.token }));
      for (const m of queue.current.splice(0)) socket.send(JSON.stringify(m));
    };
    socket.onmessage = (e) => {
      try {
        handle(JSON.parse(e.data) as ServerMessage);
      } catch {
        // Ignore anything that isn't a protocol message.
      }
    };
    socket.onclose = () => {
      if (ws.current !== socket) return;
      ws.current = null;
      if (disposed.current) return;
      if (loadSeat(url)) {
        // Seated: keep trying; the server holds the seat for 60 seconds.
        setView((v) => ({ ...v, linked: false }));
        const delay = RETRY_MS[Math.min(attempt.current++, RETRY_MS.length - 1)];
        retryTimer.current = window.setTimeout(connect, delay);
      } else {
        queue.current = [];
        if (!opened) fail('unreachable', "Can't reach the game server. Make sure it's running, then try again.");
        else setView((v) => ({ ...v, status: 'lobby', room: null, you: null }));
      }
    };
  }, [url, handle]);

  // Resume a seat from this tab after a reload; close the socket on unmount.
  // Unmounting doesn't leave the room: the seat is held briefly in case the player comes back.
  useEffect(() => {
    disposed.current = false;
    if (loadSeat(url)) connect();
    return () => {
      disposed.current = true;
      window.clearTimeout(retryTimer.current);
      const s = ws.current;
      ws.current = null;
      s?.close();
    };
  }, [url, connect]);

  const send = useCallback(
    (msg: ClientMessage) => {
      const s = ws.current;
      if (s && s.readyState === WebSocket.OPEN) s.send(JSON.stringify(msg));
      else {
        queue.current.push(msg);
        connect();
      }
    },
    [connect],
  );

  const create = (name: string) => {
    setView((v) => ({ ...v, status: 'connecting', error: null }));
    send({ type: 'create', name });
  };
  const join = (code: string, name: string) => {
    setView((v) => ({ ...v, status: 'connecting', error: null }));
    send({ type: 'join', code, name });
  };
  const move = (index: number) => send({ type: 'move', index });
  const rematch = () => send({ type: 'rematch' });
  const leave = () => {
    const s = ws.current;
    if (s && s.readyState === WebSocket.OPEN) s.send(JSON.stringify({ type: 'leave' }));
    saveSeat(null);
    queue.current = [];
    setView({ status: 'lobby', you: null, room: null, linked: true, error: null });
  };
  const clearError = () => setView((v) => ({ ...v, error: null }));

  return { view, create, join, move, rematch, leave, clearError };
}
