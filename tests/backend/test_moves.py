from concurrent.futures import ThreadPoolExecutor
import sqlite3

import chess
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import create_app


def create_ready_match(tmp_path, color="white"):
    database_path = tmp_path / "test.db"
    client = TestClient(create_app(database_path))
    invite = client.post(
        "/api/invites",
        json={"color": color, "timeControl": "unlimited"},
    ).json()
    opponent = client.post(f"/api/invites/{invite['id']}/join").json()
    return client, invite, opponent, database_path


def test_valid_move_updates_and_persists_match_state(tmp_path):
    client, invite, opponent, database_path = create_ready_match(tmp_path)

    response = client.post(
        f"/api/matches/{invite['matchId']}/moves",
        headers={"X-Player-Token": invite["creatorToken"]},
        json={"from": "e2", "to": "e4"},
    )

    assert response.status_code == 200
    state = response.json()
    assert state["turn"] == "black"
    assert state["moveCount"] == 1
    assert state["lastMove"] == {
        "from": "e2", "to": "e4", "promotion": None, "san": "e4",
    }

    opponent_state = client.get(
        f"/api/matches/{invite['matchId']}",
        headers={"X-Player-Token": opponent["playerToken"]},
    ).json()
    assert opponent_state["fen"] == state["fen"]
    assert opponent_state["moveCount"] == 1

    reloaded_client = TestClient(create_app(database_path))
    reloaded_state = reloaded_client.get(
        f"/api/matches/{invite['matchId']}",
        headers={"X-Player-Token": invite["creatorToken"]},
    ).json()
    assert reloaded_state["fen"] == state["fen"]


def test_authenticated_websocket_receives_initial_and_move_snapshots(tmp_path):
    client, invite, opponent, _ = create_ready_match(tmp_path)
    endpoint = f"/api/matches/{invite['matchId']}/events"

    with client.websocket_connect(f"{endpoint}?playerToken={invite['creatorToken']}") as creator_ws:
        assert creator_ws.receive_json()["match"]["color"] == "white"
        with client.websocket_connect(f"{endpoint}?playerToken={opponent['playerToken']}") as opponent_ws:
            assert opponent_ws.receive_json()["match"]["color"] == "black"

            response = client.post(
                f"/api/matches/{invite['matchId']}/moves",
                headers={"X-Player-Token": invite["creatorToken"]},
                json={"from": "e2", "to": "e4"},
            )

            assert response.status_code == 200
            creator_event = creator_ws.receive_json()
            opponent_event = opponent_ws.receive_json()
            assert creator_event["type"] == "match.updated"
            assert creator_event["match"]["moveCount"] == 1
            assert creator_event["match"]["color"] == "white"
            assert opponent_event["match"]["moveCount"] == 1
            assert opponent_event["match"]["color"] == "black"


def test_join_broadcasts_ready_snapshot_to_connected_creator(tmp_path):
    client = TestClient(create_app(tmp_path / "test.db"))
    invite = client.post(
        "/api/invites",
        json={"color": "white", "timeControl": "unlimited"},
    ).json()
    endpoint = f"/api/matches/{invite['matchId']}/events"

    with client.websocket_connect(f"{endpoint}?playerToken={invite['creatorToken']}") as websocket:
        assert websocket.receive_json()["match"]["status"] == "waiting"
        opponent = client.post(f"/api/invites/{invite['id']}/join").json()
        assert opponent["status"] == "ready"
        event = websocket.receive_json()
        assert event["match"]["status"] == "ready"
        assert event["match"]["color"] == "white"


@pytest.mark.parametrize("query", ["", "?playerToken=invalid"])
def test_websocket_rejects_missing_or_invalid_tokens(tmp_path, query):
    client, invite, _, _ = create_ready_match(tmp_path)

    with pytest.raises(WebSocketDisconnect) as caught_error:
        with client.websocket_connect(f"/api/matches/{invite['matchId']}/events{query}"):
            pass

    assert caught_error.value.code == 1008


def test_move_requires_ready_match_and_valid_token(tmp_path):
    client = TestClient(create_app(tmp_path / "test.db"))
    invite = client.post(
        "/api/invites",
        json={"color": "white", "timeControl": "unlimited"},
    ).json()

    assert client.post(
        f"/api/matches/{invite['matchId']}/moves",
        json={"from": "e2", "to": "e4"},
    ).status_code == 401
    assert client.post(
        f"/api/matches/{invite['matchId']}/moves",
        headers={"X-Player-Token": "invalid"},
        json={"from": "e2", "to": "e4"},
    ).status_code == 404
    assert client.post(
        f"/api/matches/{invite['matchId']}/moves",
        headers={"X-Player-Token": invite["creatorToken"]},
        json={"from": "e2", "to": "e4"},
    ).status_code == 409


def test_wrong_turn_and_illegal_move_are_rejected(tmp_path):
    client, invite, opponent, _ = create_ready_match(tmp_path)
    endpoint = f"/api/matches/{invite['matchId']}/moves"

    assert client.post(
        endpoint,
        headers={"X-Player-Token": opponent["playerToken"]},
        json={"from": "e7", "to": "e5"},
    ).status_code == 409
    assert client.post(
        endpoint,
        headers={"X-Player-Token": invite["creatorToken"]},
        json={"from": "e2", "to": "e5"},
    ).status_code == 409

    assert client.post(
        endpoint,
        headers={"X-Player-Token": invite["creatorToken"]},
        json={"from": "e2", "to": "e4"},
    ).status_code == 200
    assert client.post(
        endpoint,
        headers={"X-Player-Token": invite["creatorToken"]},
        json={"from": "d2", "to": "d4"},
    ).status_code == 409


def test_concurrent_submissions_accept_only_one_move(tmp_path):
    _, invite, _, database_path = create_ready_match(tmp_path)
    clients = [TestClient(create_app(database_path)) for _ in range(2)]
    endpoint = f"/api/matches/{invite['matchId']}/moves"

    def submit(client):
        return client.post(
            endpoint,
            headers={"X-Player-Token": invite["creatorToken"]},
            json={"from": "e2", "to": "e4"},
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(submit, clients))

    assert sorted(response.status_code for response in responses) == [200, 409]
    state = clients[0].get(
        f"/api/matches/{invite['matchId']}",
        headers={"X-Player-Token": invite["creatorToken"]},
    ).json()
    assert state["moveCount"] == 1


def test_invalid_move_shape_and_promotion_are_rejected(tmp_path):
    client, invite, _, _ = create_ready_match(tmp_path)
    endpoint = f"/api/matches/{invite['matchId']}/moves"
    headers = {"X-Player-Token": invite["creatorToken"]}

    assert client.post(endpoint, headers=headers, json={"from": "e9", "to": "e4"}).status_code == 422
    assert client.post(
        endpoint,
        headers=headers,
        json={"from": "e2", "to": "e4", "promotion": "x"},
    ).status_code == 422


def test_promotion_is_validated_and_recorded(tmp_path):
    client, invite, _, database_path = create_ready_match(tmp_path)
    board = chess.Board("7k/4P3/8/8/8/8/8/4K3 w - - 0 1")
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            "UPDATE matches SET fen = ?, move_count = 0 WHERE id = ?",
            (board.fen(), invite["matchId"]),
        )

    response = client.post(
        f"/api/matches/{invite['matchId']}/moves",
        headers={"X-Player-Token": invite["creatorToken"]},
        json={"from": "e7", "to": "e8", "promotion": "q"},
    )

    assert response.status_code == 200
    assert response.json()["lastMove"]["san"] == "e8=Q+"


def test_castling_and_en_passant_are_validated(tmp_path):
    client, invite, _, database_path = create_ready_match(tmp_path)
    endpoint = f"/api/matches/{invite['matchId']}/moves"
    headers = {"X-Player-Token": invite["creatorToken"]}

    with sqlite3.connect(database_path) as connection:
        connection.execute(
            "DELETE FROM match_moves WHERE match_id = ?",
            (invite["matchId"],),
        )
        connection.execute(
            "UPDATE matches SET fen = ?, move_count = 0 WHERE id = ?",
            ("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", invite["matchId"]),
        )
    castling_response = client.post(endpoint, headers=headers, json={"from": "e1", "to": "g1"})
    assert castling_response.status_code == 200
    assert castling_response.json()["lastMove"] == {
        "from": "e1", "to": "g1", "promotion": None, "san": "O-O",
    }

    with sqlite3.connect(database_path) as connection:
        connection.execute(
            "DELETE FROM match_moves WHERE match_id = ?",
            (invite["matchId"],),
        )
        connection.execute(
            "UPDATE matches SET fen = ?, move_count = 0 WHERE id = ?",
            ("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", invite["matchId"]),
        )
    en_passant_response = client.post(endpoint, headers=headers, json={"from": "e5", "to": "d6"})
    assert en_passant_response.status_code == 200
    assert en_passant_response.json()["lastMove"] == {
        "from": "e5", "to": "d6", "promotion": None, "san": "exd6",
    }
    assert "3P4" in en_passant_response.json()["fen"]


def test_game_over_match_rejects_moves(tmp_path):
    client, invite, _, database_path = create_ready_match(tmp_path)
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            "UPDATE matches SET fen = ?, move_count = 0 WHERE id = ?",
            ("7k/6Q1/5K2/8/8/8/8/8 b - - 0 1", invite["matchId"]),
        )

    response = client.post(
        f"/api/matches/{invite['matchId']}/moves",
        headers={"X-Player-Token": invite["creatorToken"]},
        json={"from": "h8", "to": "g8"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "This game is already over."


def test_existing_match_is_backfilled_with_starting_state(tmp_path):
    database_path = tmp_path / "test.db"
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            """
            CREATE TABLE matches (
                id TEXT PRIMARY KEY,
                invite_id TEXT NOT NULL UNIQUE,
                first_color TEXT NOT NULL,
                player_count INTEGER NOT NULL,
                status TEXT NOT NULL,
                creator_token TEXT,
                opponent_token TEXT,
                creator_color TEXT,
                opponent_color TEXT
            )
            """
        )
        connection.execute(
            """
            INSERT INTO matches (
                id, invite_id, first_color, player_count, status,
                creator_token, opponent_token, creator_color, opponent_color
            ) VALUES ('match-1', 'invite-1', 'white', 2, 'ready',
                      'creator-token', 'opponent-token', 'white', 'black')
            """
        )

    client = TestClient(create_app(database_path))
    response = client.get(
        "/api/matches/match-1",
        headers={"X-Player-Token": "creator-token"},
    )

    assert response.status_code == 200
    assert response.json()["fen"].startswith("rnbqkbnr/pppppppp")
    assert response.json()["moveCount"] == 0
    assert response.json()["lastMove"] is None
