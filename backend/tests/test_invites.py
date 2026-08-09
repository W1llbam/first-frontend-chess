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

    fetched_response = client.get(f"/api/invites/{created_invite['id']}")
    assert fetched_response.status_code == 200
    assert fetched_response.json() == created_invite


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
