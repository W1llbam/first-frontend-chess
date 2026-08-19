import sqlite3

from fastapi.testclient import TestClient

from app.main import create_app


def create_ready_match(tmp_path):
    database_path = tmp_path / "test.db"
    client = TestClient(create_app(database_path))
    invite = client.post(
        "/api/invites",
        json={"color": "white", "timeControl": "unlimited"},
    ).json()
    opponent = client.post(f"/api/invites/{invite['id']}/join").json()
    return client, invite, opponent, database_path


def set_position(database_path, match_id, fen):
    with sqlite3.connect(database_path) as connection:
        connection.execute("DELETE FROM match_moves WHERE match_id = ?", (match_id,))
        connection.execute(
            "UPDATE matches SET fen = ?, move_count = 0 WHERE id = ?",
            (fen, match_id),
        )


def test_check_is_reported_without_ending_the_game(tmp_path):
    client, invite, _, database_path = create_ready_match(tmp_path)
    set_position(database_path, invite["matchId"], "4k3/8/8/8/8/8/4R3/4K3 w - - 0 1")

    response = client.post(
        f"/api/matches/{invite['matchId']}/moves",
        headers={"X-Player-Token": invite["creatorToken"]},
        json={"from": "e2", "to": "e7"},
    )

    assert response.status_code == 200
    assert response.json()["gameStatus"] == "check"
    assert response.json()["winner"] is None


def test_checkmate_persists_correct_winner_across_refresh(tmp_path):
    client, invite, _, database_path = create_ready_match(tmp_path)
    set_position(database_path, invite["matchId"], "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1")

    response = client.post(
        f"/api/matches/{invite['matchId']}/moves",
        headers={"X-Player-Token": invite["creatorToken"]},
        json={"from": "f7", "to": "g7"},
    )

    assert response.status_code == 200
    assert response.json()["gameStatus"] == "checkmate"
    assert response.json()["winner"] == "white"

    reloaded_client = TestClient(create_app(database_path))
    refreshed = reloaded_client.get(
        f"/api/matches/{invite['matchId']}",
        headers={"X-Player-Token": invite["creatorToken"]},
    ).json()
    assert refreshed["gameStatus"] == "checkmate"
    assert refreshed["winner"] == "white"

    with reloaded_client.websocket_connect(
        f"/api/matches/{invite['matchId']}/events?playerToken={invite['creatorToken']}"
    ) as websocket:
        event = websocket.receive_json()
        assert event["match"]["gameStatus"] == "checkmate"
        assert event["match"]["winner"] == "white"

    rejected = reloaded_client.post(
        f"/api/matches/{invite['matchId']}/moves",
        headers={"X-Player-Token": invite["creatorToken"]},
        json={"from": "h8", "to": "h7"},
    )
    assert rejected.status_code == 409
    assert rejected.json()["detail"] == "This game is already over."


def test_stalemate_is_reported_as_a_draw(tmp_path):
    client, invite, _, database_path = create_ready_match(tmp_path)
    set_position(database_path, invite["matchId"], "7k/5K2/6Q1/8/8/8/8/8 b - - 0 1")
    client = TestClient(create_app(database_path))

    refreshed = client.get(
        f"/api/matches/{invite['matchId']}",
        headers={"X-Player-Token": invite["creatorToken"]},
    ).json()

    assert refreshed["gameStatus"] == "stalemate"
    assert refreshed["winner"] is None
    assert refreshed["drawReason"] == "stalemate"


def test_insufficient_material_and_seventy_five_move_draws_are_reported(tmp_path):
    client, invite, _, database_path = create_ready_match(tmp_path)
    set_position(database_path, invite["matchId"], "7k/8/8/8/8/8/8/K7 w - - 0 1")
    client = TestClient(create_app(database_path))
    insufficient = client.get(
        f"/api/matches/{invite['matchId']}",
        headers={"X-Player-Token": invite["creatorToken"]},
    ).json()
    assert insufficient["gameStatus"] == "draw"
    assert insufficient["drawReason"] == "insufficient-material"

    set_position(database_path, invite["matchId"], "7k/8/8/8/8/8/6R1/K7 w - - 150 80")
    client = TestClient(create_app(database_path))
    seventy_five = client.get(
        f"/api/matches/{invite['matchId']}",
        headers={"X-Player-Token": invite["creatorToken"]},
    ).json()
    assert seventy_five["gameStatus"] == "draw"
    assert seventy_five["drawReason"] == "seventy-five-move"


def test_fivefold_repetition_is_detected_from_replayed_move_history(tmp_path):
    client, invite, opponent, _ = create_ready_match(tmp_path)
    endpoint = f"/api/matches/{invite['matchId']}/moves"
    white_headers = {"X-Player-Token": invite["creatorToken"]}
    black_headers = {"X-Player-Token": opponent["playerToken"]}

    cycle = [
        (white_headers, {"from": "g1", "to": "f3"}),
        (black_headers, {"from": "g8", "to": "f6"}),
        (white_headers, {"from": "f3", "to": "g1"}),
        (black_headers, {"from": "f6", "to": "g8"}),
    ]
    responses = []
    for _ in range(4):
        for headers, move in cycle:
            responses.append(client.post(endpoint, headers=headers, json=move))

    assert all(response.status_code == 200 for response in responses)
    assert responses[-1].json()["gameStatus"] == "draw"
    assert responses[-1].json()["drawReason"] == "fivefold-repetition"


def test_fifty_move_claimability_does_not_end_the_game(tmp_path):
    client, invite, _, database_path = create_ready_match(tmp_path)
    set_position(database_path, invite["matchId"], "7k/8/8/8/8/8/6R1/K7 w - - 100 55")
    client = TestClient(create_app(database_path))

    refreshed = client.get(
        f"/api/matches/{invite['matchId']}",
        headers={"X-Player-Token": invite["creatorToken"]},
    ).json()

    assert refreshed["gameStatus"] == "active"
    assert refreshed["drawReason"] is None
