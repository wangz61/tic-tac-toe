"""Online play server: a WebSocket endpoint for rooms, plus the built game if dist/ exists.

Run from the project root:  uvicorn server.app:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import asyncio
import contextlib
import time
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from .rooms import GameError, Lobby, Player

DIST_DIR = Path(__file__).resolve().parent.parent / "dist"
SWEEP_INTERVAL_S = 5

lobby = Lobby()
# Live sockets per room and seat. A seat has at most one socket; a newer one replaces it.
sockets: dict[str, dict[Player, WebSocket]] = {}


def now_ms() -> int:
    return int(time.time() * 1000)


async def send(ws: WebSocket, payload: dict) -> None:
    with contextlib.suppress(Exception):
        await ws.send_json(payload)


async def broadcast(code: str) -> None:
    room = lobby.rooms.get(code)
    if not room:
        return
    state = room.snapshot()
    for ws in list(sockets.get(code, {}).values()):
        await send(ws, state)


async def sweeper() -> None:
    while True:
        await asyncio.sleep(SWEEP_INTERVAL_S)
        for room in lobby.sweep(time.time()):
            await broadcast(room.code)
        for code in list(sockets):
            if code not in lobby.rooms:
                sockets.pop(code, None)


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(sweeper())
    yield
    task.cancel()


app = FastAPI(title="Tic-Tac-Toe online", lifespan=lifespan)


@app.get("/api/health")
async def health() -> dict:
    return {"ok": True, "rooms": len(lobby.rooms)}


@app.websocket("/ws")
async def play(ws: WebSocket) -> None:
    await ws.accept()
    seat: tuple[str, Player] | None = None  # (room code, player) once seated

    async def take_seat(code: str, player: Player, token: str) -> None:
        nonlocal seat
        previous = sockets.setdefault(code, {}).get(player)
        sockets[code][player] = ws
        if previous is not None and previous is not ws:
            with contextlib.suppress(Exception):
                await previous.close(code=4000)
        seat = (code, player)
        await send(ws, {"type": "joined", "code": code, "you": player, "token": token})
        await broadcast(code)

    try:
        while True:
            msg = await ws.receive_json()
            kind = msg.get("type") if isinstance(msg, dict) else None
            try:
                if kind in ("create", "join", "resume"):
                    if seat:
                        raise GameError("bad_request", "You're already in a room.")
                    if kind == "create":
                        room, player, s = lobby.create(msg.get("name"))
                    elif kind == "join":
                        room, player, s = lobby.join(msg.get("code"), msg.get("name"))
                    else:
                        room, player, s = lobby.resume(msg.get("code"), msg.get("token"))
                    await take_seat(room.code, player, s.token)
                elif kind in ("move", "rematch", "leave"):
                    if not seat:
                        raise GameError("not_in_room", "Join a room first.")
                    code, player = seat
                    room = lobby.get(code)
                    if kind == "move":
                        room.play(player, msg.get("index"), now_ms())
                    elif kind == "rematch":
                        room.request_rematch(player)
                    else:
                        sockets.get(code, {}).pop(player, None)
                        seat = None
                        lobby.leave(code, player)
                        await send(ws, {"type": "left"})
                    await broadcast(code)
                else:
                    raise GameError("bad_request", "Unknown message type.")
            except GameError as e:
                await send(ws, {"type": "error", "code": e.code, "message": e.message})
    except (WebSocketDisconnect, RuntimeError):
        pass
    except ValueError:
        # Malformed JSON: drop the connection, the seat stays reserved for a reconnect.
        with contextlib.suppress(Exception):
            await ws.close(code=1003)
    finally:
        if seat:
            code, player = seat
            # Only the seat's current socket may mark it away; a replaced socket must not.
            if sockets.get(code, {}).get(player) is ws:
                sockets[code].pop(player, None)
                lobby.disconnect(code, player, time.time())
                await broadcast(code)


if DIST_DIR.is_dir():
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="game")
