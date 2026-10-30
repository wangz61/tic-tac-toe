# Tic-Tac-Toe

A polished tic-tac-toe game with three ways to play:

- **vs Computer**: four difficulty levels; the top level, Master, never loses.
- **Two Players**: take turns on one device.
- **Play Online**: create a room, share the 6-letter code or an invite link, and play a friend on another device.

The front end uses React, Vite and TypeScript. Online play runs on a small Python server built with FastAPI and WebSockets. There are no accounts and no external APIs. The computer and two-player modes work fully offline. See [PRD.md](PRD.md) for the product spec; section 10 covers online play.

## Run

### Game only (offline modes)

```bash
npm install
npm run dev       # http://localhost:5173
```

### With online play

Online play needs the game server. It requires Python 3.10 or newer.

```bash
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r server/requirements.txt -r server/requirements-dev.txt

npm run build     # build the game into dist/
npm run server    # serve the game and the online server at http://localhost:8000
```

Open `http://localhost:8000` in two browser windows: create a room in one and join from the other.

To play across devices on the same network, run `npm run server` on one computer. On the other device, open `http://<that computer's IP>:8000`. The server listens on all interfaces; you may need to allow port 8000 through the firewall.

For development with hot reload, run `npm run server` and `npm run dev` together. Vite forwards `/ws` to the server on port 8000.

### Tests and builds

```bash
npm test             # engine, AI, game state and online helpers (Vitest)
npm run test:server  # rooms, rules and the WebSocket protocol (pytest)
npm run build        # static build in dist/
npm run app          # run as a desktop app (Electron)
npm run dist         # build release/TicTacToe-<version>-portable.exe
```

The portable `.exe` runs on 64-bit Windows with no install, and its settings and history live in `%APPDATA%\Tic-Tac-Toe`. In the desktop app, Play Online connects to `localhost:8000` by default. Use **Change** in the online lobby to point it at another computer's server.

> If `npm run dist` fails while extracting `winCodeSign` ("Cannot create symbolic link"), the archive contains macOS symlinks that Windows won't create without admin rights. Fix it in two steps:
>
> 1. Inside `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign`, run `node_modules/7zip-bin/win/x64/7za.exe x <archive>.7z -owinCodeSign-2.6.0`. The two symlink errors it reports are harmless.
> 2. Rerun `npm run dist`.

## Features

- **Matches**: single game, best of 3 / 5, or endless. Choose who starts and who starts the next round.
- **Undo / redo / restart**: in vs Computer, undo also takes back the computer's reply.
- **Hints**: colours every empty cell by its outcome with perfect play from that position (win / draw / loss).
- **Online rooms**:
  - The server checks every move: turn order, empty cell, round over.
  - Both players always see the same board.
  - Rematch starts the next round once both players agree, and the first move alternates between rounds.
  - Room codes avoid look-alike characters (no 0/O or 1/I/L).
  - Invite links open the lobby with the code filled in.
- **Reconnects**: a dropped player is held in the room for 60 seconds. A page reload resumes the same seat.
- **Replay** any finished game step by step, including online games.
- **Statistics**:
  - Win rate.
  - Breakdowns by difficulty and by turn order.
  - Recent form and streaks.
  - Two-player results and online results.
- **Settings**: light / dark / system theme, two piece styles, sound and volume, reduced animations.
- **Keyboard**:
  - `1`–`9` place a piece (numeric keypad layout); arrows move between cells.
  - `U` / `Y` undo / redo; `R` restart; `H` hints; `N` next round.

## Online protocol

The client and server talk over `/ws` with JSON messages.

| From | Messages |
| --- | --- |
| Client | `create`, `join`, `resume`, `move`, `rematch`, `leave` |
| Server | `joined` (your seat and reconnect token), `state` (the full room), `error` (stable `code` + readable `message`), `left` |

The server holds rooms in memory, so restarting it clears all rooms. Each `state` message carries the full room, so a client never has to merge partial updates. Message examples are in [PRD.md §10.4](PRD.md).

## Layout

```
server/
├── rooms.py        # rooms, seats, rules, rematch, reconnect grace (pure Python)
├── app.py          # FastAPI app: /ws endpoint, /api/health, serves dist/
└── test_server.py  # pytest: room logic + WebSocket flows
src/
├── engine/      # pure game logic: board rules + minimax AI (no React)
├── online/      # protocol types and the useOnline WebSocket hook
├── state/       # game reducer and the persisted app store
├── components/  # Board, Piece, charts, shared UI
├── pages/       # Menu, Setup, Game, Online, Replay, Stats, Settings
├── hooks/       # Web Audio sound effects
├── utils/       # storage, stats, formatting
└── styles/      # global.css with light/dark design tokens
```
