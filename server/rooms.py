"""Room and match logic for online play. Pure Python, no I/O, so it can be tested directly."""

from __future__ import annotations

import secrets
from dataclasses import dataclass, field
from typing import Literal

Player = Literal["X", "O"]
PLAYERS: tuple[Player, Player] = ("X", "O")

# No 0/O, 1/I/L: codes are read aloud and typed by hand.
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6
RECONNECT_GRACE_S = 60
MAX_NAME = 20
MAX_ROOMS = 1000

WIN_LINES = (
    (0, 1, 2), (3, 4, 5), (6, 7, 8),
    (0, 3, 6), (1, 4, 7), (2, 5, 8),
    (0, 4, 8), (2, 4, 6),
)


class GameError(Exception):
    """A request the server refuses. `code` is stable for clients, `message` is for people."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def other(p: Player) -> Player:
    return "O" if p == "X" else "X"


def clean_name(name: object, fallback: str) -> str:
    text = " ".join(str(name or "").split())[:MAX_NAME]
    return text or fallback


@dataclass
class Seat:
    name: str
    token: str = field(default_factory=lambda: secrets.token_urlsafe(16))
    connected: bool = True
    disconnected_at: float | None = None


@dataclass
class Room:
    code: str
    seats: dict[Player, Seat] = field(default_factory=dict)
    round: int = 1
    first: Player = "X"
    moves: list[dict] = field(default_factory=list)
    score: dict[str, int] = field(default_factory=lambda: {"X": 0, "O": 0, "draw": 0})
    rematch: set[Player] = field(default_factory=set)

    # Board and outcome are always rebuilt from `moves`, the single source of truth.
    def board(self) -> list[Player | None]:
        cells: list[Player | None] = [None] * 9
        for m in self.moves:
            cells[m["index"]] = m["player"]
        return cells

    def outcome(self) -> tuple[str | None, tuple[int, int, int] | None]:
        b = self.board()
        for line in WIN_LINES:
            a, c, d = line
            if b[a] and b[a] == b[c] == b[d]:
                return b[a], line
        if len(self.moves) == 9:
            return "draw", None
        return None, None

    @property
    def full(self) -> bool:
        return len(self.seats) == 2

    def turn(self) -> Player:
        return self.first if len(self.moves) % 2 == 0 else other(self.first)

    def status(self) -> str:
        if not self.full:
            return "waiting"
        return "over" if self.outcome()[0] else "playing"

    def reset_match(self) -> None:
        self.round = 1
        self.first = "X"
        self.moves = []
        self.score = {"X": 0, "O": 0, "draw": 0}
        self.rematch = set()

    def play(self, player: Player, index: object, at: int) -> None:
        if not self.full:
            raise GameError("waiting", "Wait for your opponent to join.")
        if self.outcome()[0]:
            raise GameError("game_over", "This round is over.")
        if player != self.turn():
            raise GameError("not_your_turn", "It's not your turn.")
        if not isinstance(index, int) or isinstance(index, bool) or not 0 <= index <= 8:
            raise GameError("bad_request", "Pick a cell from 0 to 8.")
        if self.board()[index] is not None:
            raise GameError("cell_taken", "That cell is already taken.")
        self.moves.append({"index": index, "player": player, "at": at})
        result, _ = self.outcome()
        if result:
            self.score[result] += 1

    def request_rematch(self, player: Player) -> bool:
        """Record a rematch vote. Returns True when both voted and the next round started."""
        if not self.outcome()[0]:
            raise GameError("bad_request", "The round isn't over yet.")
        self.rematch.add(player)
        if self.rematch != set(PLAYERS):
            return False
        self.round += 1
        self.first = other(self.first)
        self.moves = []
        self.rematch = set()
        return True

    def snapshot(self) -> dict:
        result, line = self.outcome()
        return {
            "type": "state",
            "code": self.code,
            "status": self.status(),
            "round": self.round,
            "first": self.first,
            "turn": self.turn(),
            "moves": list(self.moves),
            "result": result,
            "winLine": list(line) if line else None,
            "players": {
                p: ({"name": s.name, "connected": s.connected} if (s := self.seats.get(p)) else None)
                for p in PLAYERS
            },
            "score": dict(self.score),
            "rematch": sorted(self.rematch),
        }


class Lobby:
    """All rooms on this server, keyed by code."""

    def __init__(self) -> None:
        self.rooms: dict[str, Room] = {}

    def _new_code(self) -> str:
        while True:
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
            if code not in self.rooms:
                return code

    def get(self, code: object) -> Room:
        room = self.rooms.get(str(code or "").strip().upper())
        if not room:
            raise GameError("not_found", "No room with that code. Check it and try again.")
        return room

    def create(self, name: object) -> tuple[Room, Player, Seat]:
        if len(self.rooms) >= MAX_ROOMS:
            raise GameError("server_full", "The server is busy. Try again in a minute.")
        room = Room(code=self._new_code())
        seat = Seat(name=clean_name(name, "Player X"))
        room.seats["X"] = seat
        self.rooms[room.code] = room
        return room, "X", seat

    def join(self, code: object, name: object) -> tuple[Room, Player, Seat]:
        room = self.get(code)
        if room.full:
            raise GameError("room_full", "That room already has two players.")
        player: Player = "O" if "X" in room.seats else "X"
        seat = Seat(name=clean_name(name, f"Player {player}"))
        room.seats[player] = seat
        # A new opponent starts a fresh match.
        room.reset_match()
        return room, player, seat

    def resume(self, code: object, token: object) -> tuple[Room, Player, Seat]:
        room = self.get(code)
        for player, seat in room.seats.items():
            if secrets.compare_digest(seat.token, str(token or "")):
                seat.connected = True
                seat.disconnected_at = None
                return room, player, seat
        raise GameError("invalid_token", "Your seat in that room has expired.")

    def disconnect(self, code: str, player: Player, now: float) -> None:
        room = self.rooms.get(code)
        seat = room.seats.get(player) if room else None
        if seat:
            seat.connected = False
            seat.disconnected_at = now

    def leave(self, code: str, player: Player) -> Room | None:
        """Free the seat. Returns the room if someone is still in it."""
        room = self.rooms.get(code)
        if not room:
            return None
        room.seats.pop(player, None)
        room.reset_match()
        if not room.seats:
            del self.rooms[code]
            return None
        return room

    def sweep(self, now: float) -> list[Room]:
        """Free seats whose owners stayed away past the grace period. Returns rooms that changed and still have people."""
        changed: list[Room] = []
        for code, room in list(self.rooms.items()):
            expired = [
                p for p, s in room.seats.items()
                if not s.connected and s.disconnected_at is not None and now - s.disconnected_at >= RECONNECT_GRACE_S
            ]
            if not expired:
                continue
            for p in expired:
                room.seats.pop(p)
            room.reset_match()
            if not room.seats:
                del self.rooms[code]
            else:
                changed.append(room)
        return changed
