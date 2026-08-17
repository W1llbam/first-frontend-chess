from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.database import InviteDatabase
from app.main import create_app
from app.models import CreateInviteRequest


def create_client(tmp_path):
    return TestClient(create_app(tmp_path / "test.db"))


def test_create_invite_persists_and_returns_it(tmp_path):
    client = create_client(tmp_path)

    response = client.post(
        "/api/invites",
        json={"color": "random", "timeControl": "10-minutes"},
    )

    assert response.status_code == 201
    created_invite = response.json()
    assert created_invite["status"] == "pending"
    assert created_invite["color"] == "random"
    assert created_invite["timeControl"] == "10-minutes"
    assert created_invite["id"]
    assert created_invite["matchId"]
    assert created_invite["creatorToken"]
    assert created_invite["creatorColor"] in {"white", "black"}

    fetched_response = client.get(f"/api/invites/{created_invite['id']}")
    assert fetched_response.status_code == 200
    assert fetched_response.json() == {
        key: created_invite[key]
        for key in ("id", "status", "color", "timeControl", "expiresAt")
    }


def test_create_invite_rejects_invalid_settings(tmp_path):
    client = create_client(tmp_path)

    response = client.post(
        "/api/invites",
        json={"color": "purple", "timeControl": "unlimited"},
    )

    assert response.status_code == 422


def test_get_unknown_invite_returns_not_found(tmp_path):
    client = create_client(tmp_path)

    response = client.get("/api/invites/does-not-exist")

    assert response.status_code == 404


def test_get_expired_invite_returns_gone(tmp_path):
    database_path = tmp_path / "test.db"
    app = create_app(database_path)
    database = InviteDatabase(database_path)
    created_invite = database.create_invite(
        CreateInviteRequest(color="white", timeControl="unlimited"),
        now=datetime.now(timezone.utc) - timedelta(minutes=11),
    )
    client = TestClient(app)

    response = client.get(f"/api/invites/{created_invite.id}")

    assert response.status_code == 410
    assert response.json()["detail"] == "This invite has expired."


def test_creator_cannot_join_and_opponent_completes_match(tmp_path):
    client = create_client(tmp_path)
    invite = client.post(
        "/api/invites",
        json={"color": "white", "timeControl": "unlimited"},
    ).json()

    creator_response = client.post(
        f"/api/invites/{invite['id']}/join",
        headers={"X-Player-Token": invite["creatorToken"]},
    )
    opponent_response = client.post(f"/api/invites/{invite['id']}/join")

    assert creator_response.status_code == 409
    assert opponent_response.status_code == 200
    assert opponent_response.json()["matchId"] == invite["matchId"]
    assert opponent_response.json()["color"] == "black"
    assert opponent_response.json()["status"] == "ready"

    creator_status = client.get(
        f"/api/matches/{invite['matchId']}",
        headers={"X-Player-Token": invite["creatorToken"]},
    )
    opponent_status = client.get(
        f"/api/matches/{invite['matchId']}",
        headers={"X-Player-Token": opponent_response.json()["playerToken"]},
    )
    assert creator_status.json()["color"] == "white"
    assert creator_status.json()["status"] == "ready"
    assert opponent_status.json()["color"] == "black"


def test_join_full_invite_returns_conflict(tmp_path):
    client = create_client(tmp_path)
    invite = client.post(
        "/api/invites",
        json={"color": "black", "timeControl": "unlimited"},
    ).json()

    client.post(f"/api/invites/{invite['id']}/join")
    response = client.post(f"/api/invites/{invite['id']}/join")

    assert response.status_code == 409


def test_match_status_requires_a_valid_player_token(tmp_path):
    client = create_client(tmp_path)
    invite = client.post(
        "/api/invites",
        json={"color": "random", "timeControl": "unlimited"},
    ).json()

    assert client.get(f"/api/matches/{invite['matchId']}").status_code == 401
    assert client.get(
        f"/api/matches/{invite['matchId']}",
        headers={"X-Player-Token": "invalid"},
    ).status_code == 404


def test_join_expired_invite_returns_gone(tmp_path):
    database_path = tmp_path / "test.db"
    app = create_app(database_path)
    database = InviteDatabase(database_path)
    invite = database.create_invite(
        CreateInviteRequest(color="white", timeControl="unlimited"),
        now=datetime.now(timezone.utc) - timedelta(minutes=11),
    )

    response = TestClient(app).post(f"/api/invites/{invite.id}/join")

    assert response.status_code == 410
