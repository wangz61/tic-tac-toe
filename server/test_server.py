"""Server tests. Run from the project root: python -m pytest server"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from server import app as server_app
from server.rooms import CODE_ALPHABET, CODE_LENGTH, RECONNECT_GRACE_S, GameError, Lobby, Room, Seat


def seated_room() -> Room:
    room = Room(code="ABCDEF")
    room.seats["X"] = Seat(name="Alice")
    room.seats["O"] = Seat(name="Ben")
    return room


def play_all(room: Room, moves: list[int]) -> None:
    for i in moves:
        room.play(room.turn(), i, 0)


# --- Pure room logic -------------------------------------------------------

def test_codes_use_unambiguous_alphabet():
    lobby = Lobby()
    room, player, _ = lobby.create("Alice")
    assert player == "X"
    assert len(room.code) == CODE_LENGTH
    assert set(room.code) <= set(CODE_ALPHABET)
    assert not set("01ILO") & set(CODE_ALPHABET)


@pytest.mark.parametrize(
    "moves, result, line",
    [
        ([0, 3, 1, 4, 2], "X", [0, 1, 2]),
        ([0, 1, 3, 2, 6], "X", [0, 3, 6]),
        ([0, 1, 4, 2, 8], "X", [0, 4, 8]),
        ([0, 2, 1, 4, 3, 6], "O", [2, 4, 6]),
        ([0, 1, 2, 4, 3, 5, 7, 6, 8], "draw", None),
    ],
)
def test_outcomes(moves, result, line):
    room = seated_room()
    play_all(room, moves)
    snap = room.snapshot()
    assert snap["result"] == result
    assert snap["winLine"] == line
    assert snap["status"] == "over"
    assert room.score[result] == 1


@pytest.mark.parametrize(
    "setup, player, index, code",
    [
        ([], "O", 4, "not_your_turn"),
        ([4], "O", 4, "cell_taken"),
        ([], "X", 9, "bad_request"),
        ([], "X", "4", "bad_request"),
        ([], "X", True, "bad_request"),
        ([0, 3, 1, 4, 2], "O", 8, "game_over"),
    ],
)
def test_illegal_moves_are_rejected(setup, player, index, code):
    room = seated_room()
    play_all(room, setup)
    with pytest.raises(GameError) as e:
        room.play(player, index, 0)
    assert e.value.code == code
    assert len(room.moves) == len(setup)


def test_cannot_move_before_opponent_joins():
    lobby = Lobby()
    room, _, _ = lobby.create("Alice")
    with pytest.raises(GameError) as e:
        room.play("X", 0, 0)
    assert e.value.code == "waiting"


def test_rematch_needs_both_votes_and_alternates_first_player():
    room = seated_room()
    with pytest.raises(GameError):
        room.request_rematch("X")
    play_all(room, [0, 3, 1, 4, 2])
    assert room.request_rematch("X") is False
    assert room.snapshot()["rematch"] == ["X"]
    assert room.request_rematch("O") is True
    assert (room.round, room.first, room.moves, room.turn()) == (2, "O", [], "O")
    assert room.score == {"X": 1, "O": 0, "draw": 0}


def test_join_errors():
    lobby = Lobby()
    with pytest.raises(GameError) as e:
        lobby.join("NOPE42", "Ben")
    assert e.value.code == "not_found"
    room, _, _ = lobby.create("Alice")
    lobby.join(room.code.lower(), "Ben")  # codes are case-insensitive
    with pytest.raises(GameError) as e:
        lobby.join(room.code, "Cara")
    assert e.value.code == "room_full"


def test_names_are_cleaned():
    lobby = Lobby()
    room, _, seat = lobby.create("   ")
    assert seat.name == "Player X"
    _, _, seat = lobby.join(room.code, "  A   very  long name that keeps going ")
    assert seat.name == "A very long name tha"


def test_resume_within_grace_and_expiry_after():
    lobby = Lobby()
    room, _, x = lobby.create("Alice")
    lobby.join(room.code, "Ben")
    lobby.disconnect(room.code, "X", now=100.0)
    assert room.snapshot()["players"]["X"]["connected"] is False
    assert lobby.sweep(100.0 + RECONNECT_GRACE_S - 1) == []
    with pytest.raises(GameError) as e:
        lobby.resume(room.code, "wrong-token")
    assert e.value.code == "invalid_token"
    _, player, _ = lobby.resume(room.code, x.token)
    assert player == "X" and room.seats["X"].connected

    lobby.disconnect(room.code, "X", now=200.0)
    assert lobby.sweep(200.0 + RECONNECT_GRACE_S) == [room]
    assert "X" not in room.seats and room.status() == "waiting"


def test_room_is_removed_when_everyone_leaves_or_expires():
    lobby = Lobby()
    room, _, _ = lobby.create("Alice")
    lobby.join(room.code, "Ben")
    assert lobby.leave(room.code, "X") is room
    assert lobby.leave(room.code, "O") is None
    assert room.code not in lobby.rooms

    room, _, _ = lobby.create("Cara")
    lobby.disconnect(room.code, "X", now=0.0)
    lobby.sweep(RECONNECT_GRACE_S)
    assert room.code not in lobby.rooms


def test_new_opponent_resets_the_match():
    lobby = Lobby()
    room, _, _ = lobby.create("Alice")
    lobby.join(room.code, "Ben")
    play_all(room, [0, 3, 1, 4, 2])
    lobby.leave(room.code, "O")
    _, player, _ = lobby.join(room.code, "Cara")
    assert player == "O"
    assert room.score == {"X": 0, "O": 0, "draw": 0} and room.moves == []


# --- WebSocket endpoint ------------------------------------------------------

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(server_app, "lobby", Lobby())
    monkeypatch.setattr(server_app, "sockets", {})
    with TestClient(server_app.app) as c:
        yield c


def recv_until(ws, kind: str, where=lambda m: True) -> dict:
    """Read messages until one of `kind` matches `where`; earlier broadcasts are skipped."""
    while True:
        msg = ws.receive_json()
        if msg["type"] == kind and where(msg):
            return msg


def test_health(client):
    assert client.get("/api/health").json() == {"ok": True, "rooms": 0}


def test_full_online_game(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        a.send_json({"type": "create", "name": "Alice"})
        joined = recv_until(a, "joined")
        assert joined["you"] == "X" and joined["token"]
        assert recv_until(a, "state")["status"] == "waiting"

        b.send_json({"type": "join", "code": joined["code"], "name": "Ben"})
        assert recv_until(b, "joined")["you"] == "O"
        state = recv_until(a, "state", lambda m: m["status"] == "playing")
        assert state["players"]["O"] == {"name": "Ben", "connected": True}

        b.send_json({"type": "move", "index": 0})
        assert recv_until(b, "error")["code"] == "not_your_turn"

        for n, (ws, i) in enumerate([(a, 0), (b, 3), (a, 1), (b, 4), (a, 2)], 1):
            ws.send_json({"type": "move", "index": i})
            recv_until(a, "state", lambda m: len(m["moves"]) == n)
            last = recv_until(b, "state", lambda m: len(m["moves"]) == n)
        assert last["result"] == "X" and last["winLine"] == [0, 1, 2]
        assert last["score"] == {"X": 1, "O": 0, "draw": 0}

        a.send_json({"type": "rematch"})
        assert recv_until(b, "state")["rematch"] == ["X"]
        b.send_json({"type": "rematch"})
        state = recv_until(a, "state", lambda m: m["round"] == 2)
        assert (state["round"], state["first"], state["turn"], state["moves"]) == (2, "O", "O", [])


def test_disconnect_and_resume(client):
    with client.websocket_connect("/ws") as a:
        a.send_json({"type": "create", "name": "Alice"})
        joined = recv_until(a, "joined")
        with client.websocket_connect("/ws") as b:
            b.send_json({"type": "join", "code": joined["code"], "name": "Ben"})
            o = recv_until(b, "joined")
        # b's socket closed: a hears about it.
        recv_until(a, "state", lambda m: m["players"]["O"] and not m["players"]["O"]["connected"])

        with client.websocket_connect("/ws") as b2:
            b2.send_json({"type": "resume", "code": joined["code"], "token": o["token"]})
            assert recv_until(b2, "joined")["you"] == "O"
            recv_until(a, "state", lambda m: m["players"]["O"]["connected"])


def test_errors_over_the_socket(client):
    with client.websocket_connect("/ws") as a:
        a.send_json({"type": "move", "index": 0})
        assert recv_until(a, "error")["code"] == "not_in_room"
        a.send_json({"type": "join", "code": "ZZZZZZ", "name": "Ben"})
        assert recv_until(a, "error")["code"] == "not_found"
        a.send_json({"type": "dance"})
        assert recv_until(a, "error")["code"] == "bad_request"


def test_leave_frees_the_seat(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        a.send_json({"type": "create", "name": "Alice"})
        code = recv_until(a, "joined")["code"]
        b.send_json({"type": "join", "code": code, "name": "Ben"})
        recv_until(b, "joined")
        b.send_json({"type": "leave"})
        recv_until(b, "left")
        state = recv_until(a, "state", lambda m: m["players"]["O"] is None)
        assert state["status"] == "waiting"
