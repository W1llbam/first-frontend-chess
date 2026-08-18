import asyncio

from app.database import InviteDatabase
from app.main import create_app
from app.realtime import MatchConnection, MatchConnectionManager
from fastapi.testclient import TestClient


class FakeWebSocket:
    def __init__(self, should_fail=False):
        self.should_fail = should_fail
        self.events = []

    async def send_json(self, event):
        if self.should_fail:
            raise RuntimeError("socket disconnected")
        self.events.append(event)

    async def close(self):
        pass


def create_ready_match(tmp_path):
    database_path = tmp_path / "test.db"
    client = TestClient(create_app(database_path))
    invite = client.post(
        "/api/invites",
        json={"color": "white", "timeControl": "unlimited"},
    ).json()
    opponent = client.post(f"/api/invites/{invite['id']}/join").json()
    return invite, opponent, database_path


def test_failed_client_is_removed_without_blocking_other_clients(tmp_path):
    invite, opponent, database_path = create_ready_match(tmp_path)
    database = InviteDatabase(database_path)
    failed_socket = FakeWebSocket(should_fail=True)
    healthy_socket = FakeWebSocket()
    failed_connection = MatchConnection(failed_socket, invite["creatorToken"])
    healthy_connection = MatchConnection(healthy_socket, opponent["playerToken"])
    manager = MatchConnectionManager()

    async def broadcast_twice():
        await manager.add(invite["matchId"], failed_connection)
        await manager.add(invite["matchId"], healthy_connection)
        await manager.broadcast_snapshot(invite["matchId"], database)
        failed_socket.should_fail = False
        await manager.broadcast_snapshot(invite["matchId"], database)

    asyncio.run(broadcast_twice())

    assert len(healthy_socket.events) == 2
    assert len(failed_socket.events) == 0
